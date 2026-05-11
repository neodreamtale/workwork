import prisma from '../../lib/db';

import Chain from '../types/Chain';
import Step from '../types/Step';

export class Blueprint {
    /**
     * 构建图纸 tree：一次性拉取整条链、所有节点，并且【预加载】子流程结构！拒绝 N+1 循环查询！
     */
    static async load<U = any>(templateId: string, prismaClient = prisma): Promise<Chain<U>> {
        const chainData = await prismaClient.chain.findUnique({
            where: { id: templateId },
            include: {
                steps: {
                    orderBy: { sortOrder: 'asc' },
                }
            },
        });
        if (!chainData) throw new Error(`找不到 ID 为 ${templateId} 的流程模板`);

        const { steps, ...templateProps } = chainData;
        const c = new Chain<U>(templateProps);

        if (steps) {
            c.steps = steps.map((sData: any) => new Step<U>(sData));
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
                // 注意：只有当 s.subChain 被明确加载（非 undefined）或被清空（null）时才处理
                if (s.subChain !== undefined) {
                    if (s.subChain) {
                        await this.save(s.subChain, tx as any);
                        // 确保步骤模板里的子流程 ID 也是最新的
                        s.template.subChainId = s.subChain.template.id;
                    } else {
                        s.template.subChainId = null;
                    }
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

    /**
     * 查询所有模板列表 (带分页)
     */
    static async findAll(page = 1, pageSize = 10, prismaClient = prisma) {
        const skip = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            prismaClient.chain.findMany({
                skip,
                take: pageSize,
                orderBy: { updatedAt: 'desc' }
            }),
            prismaClient.chain.count()
        ]);

        return { items, total };
    }

    /**
     * 实例化一个模板
     */
    static async instantiate(templateId: string, prismaClient = prisma) {
        return await prismaClient.$transaction(async (tx) => {
            // 1. 获取模板数据
            const template = await tx.chain.findUnique({
                where: { id: templateId },
                include: { steps: { orderBy: { sortOrder: 'asc' } } }
            });
            if (!template) throw new Error("模板不存在");

            // 2. 创建工作流实例
            const instance = await tx.chainInstance.create({
                data: {
                    templateId: template.id,
                    status: 'PENDING',
                }
            });

            // 3. 创建步骤实例（打快照）
            if (template.steps.length > 0) {
                await tx.stepInstance.createMany({
                    data: template.steps.map(s => ({
                        stepId: s.id,
                        chainInstanceId: instance.id,
                        sortOrder: s.sortOrder,
                        status: 'PENDING',
                    }))
                });
            }

            return instance;
        });
    }
}
