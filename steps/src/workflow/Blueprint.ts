import prisma from '../../lib/db';
import Chain from '../types/Chain';
import Step from '../types/Step';

export class Blueprint {
    /**
     * 构建图纸树：一次性拉取整条链、所有节点，并且【预加载】子流程结构！拒绝 N+1 循环查询！
     */
    static async load<U = any>(templateId: string, prismaClient = prisma): Promise<Chain<U>> {
        const chainData = await prismaClient.chain.findUnique({
            where: { id: templateId },
            include: {
                steps: {
                    // 核心1：如果某步骤是子流程，用 Prisma 级联查询一把梭把子图纸拉出来
                    include: { subChain: { include: { steps: true } } }
                }
            },
        });

        if (!chainData) throw new Error(`找不到 ID 为 ${templateId} 的流程模板`);

        const { steps, ...templateProps } = chainData;
        const c = new Chain<U>(templateProps);

        // 同步装配节点，拒绝发额外 SQL
        if (steps) {
            c.steps = steps.map((sData: any) => {
                const { subChain, ...stepProps } = sData;
                const step = new Step<U>(stepProps);

                // 如果存在嵌套子流程，直接拿刚才查好的数据在内存里拼装
                if (subChain) {
                    const subC = new Chain<U>(subChain);
                    if (subChain.steps) {
                        subC.steps = subChain.steps.map((ss: any) => new Step<U>(ss));
                        subC.buildChain();
                    }
                    step.subChain = subC;
                }
                return step;
            });
            c.buildChain();
        }
        return c;
    }

    /**
     * 将在内存中画好、改好的图纸持久化到数据库
     */
    static async save(chain: Chain<any>, prismaClient = prisma): Promise<void> {
        await prismaClient.chain.upsert({
            where: { id: chain.template.id },
            create: chain.template,
            update: chain.template
        });

        for (const s of chain.steps) {
            s.template.chainId = chain.template.id;
            await prismaClient.step.upsert({
                where: { id: s.template.id },
                create: s.template,
                update: s.template
            });
        }
    }
}
