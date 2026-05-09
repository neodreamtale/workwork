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
                        subC.buildChain(true);
                    }
                    step.subChain = subC;
                }
                return step;
            });
            c.buildChain(true);
        }
        return c;
    }

    /**
     * 将在内存中画好、改好的图纸持久化到数据库
     * 采用递归保存策略，支持深层嵌套子流程
     */
    static async save(chain: Chain<any>, prismaClient = prisma): Promise<void> {
        await prismaClient.$transaction(async (tx) => {
            // 1. 保存当前链的元数据
            await tx.chain.upsert({
                where: { id: chain.template.id },
                create: chain.template,
                update: chain.template
            });

            // 2. 清理：删除那些已经不在内存数组里的数据库步骤 (物理删除)
            const currentStepIds = chain.steps.map(s => s.template.id);
            await tx.step.deleteMany({
                where: {
                    chainId: chain.template.id,
                    id: { notIn: currentStepIds }
                }
            });

            // 3. 递归保存每个步骤
            for (const s of chain.steps) {
                // 如果步骤有关联的子流程图纸，先递归保存子流程
                if (s.subChain) {
                    await this.save(s.subChain, tx as any);
                    // 确保步骤模板里的子流程 ID 也是最新的
                    s.template.subChainId = s.subChain.template.id;
                } else {
                    s.template.subChainId = null;
                }

                s.template.chainId = chain.template.id;
                await tx.step.upsert({
                    where: { id: s.template.id },
                    create: s.template,
                    update: s.template
                });
            }
        });
    }
}
