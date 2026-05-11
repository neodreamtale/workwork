import prisma from '../../lib/db';

import Chain from '../types/Chain';
import Step from '../types/Step';

export class Blueprint {
    /**
     * 构建图纸 tree：一次性拉取整条链、所有节点
     */
    static async load<U = any>(templateId: string, prismaClient: any = prisma): Promise<Chain<U>> {
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
     * 持久化到数据库
     */
    static async save(chain: Chain<any>, prismaClient: any = prisma): Promise<void> {
        await prismaClient.$transaction(async (tx: any) => {
            await tx.chain.upsert({
                where: { id: chain.template.id },
                create: chain.template,
                update: chain.template
            });

            const currentStepIds = chain.steps.map(s => s.template.id);
            await tx.step.deleteMany({
                where: {
                    chainId: chain.template.id,
                    id: { notIn: currentStepIds }
                }
            });

            for (const s of chain.steps) {
                if (s.subChain !== undefined) {
                    if (s.subChain) {
                        await this.save(s.subChain, tx);
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
     * 查询所有主模板列表
     */
    static async findMainTemplates(page = 1, pageSize = 10, prismaClient: any = prisma) {
        const skip = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            prismaClient.chain.findMany({
                where: { isMain: true },
                skip,
                take: pageSize,
                orderBy: { updatedAt: 'desc' }
            }),
            prismaClient.chain.count({
                where: { isMain: true }
            })
        ]);

        return { items, total };
    }

    /**
     * 实例化一个模板
     */
    static async instantiate(templateId: string, prismaClient: any = prisma) {
        return await prismaClient.$transaction(async (tx: any) => {
            const template = await tx.chain.findUnique({
                where: { id: templateId },
                include: { steps: { orderBy: { sortOrder: 'asc' } } }
            });
            if (!template) throw new Error("模板不存在");

            const instance = await tx.chainInstance.create({
                data: {
                    templateId: template.id,
                    status: 'PENDING',
                }
            });

            if (template.steps.length > 0) {
                await tx.stepInstance.createMany({
                    data: template.steps.map((s: any) => ({
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

    /**
     * 深度加载：一次性递归拉取整棵树的所有子流程
     */
    static async loadDeep<U = any>(templateId: string, prismaClient: any = prisma): Promise<Chain<U>> {
        const chainData = await prismaClient.chain.findUnique({
            where: { id: templateId },
            include: {
                steps: {
                    orderBy: { sortOrder: 'asc' },
                }
            },
        });
        if (!chainData) throw new Error(`找不到模板 ${templateId}`);

        const { steps, ...props } = chainData;
        const chain = new Chain<U>(props);

        if (steps && steps.length > 0) {
            const loadedSteps = await Promise.all(steps.map(async (sData: any) => {
                const step = new Step<U>(sData);
                if (sData.subChainId) {
                    // 递归调用
                    step.subChain = await Blueprint.loadDeep(sData.subChainId, prismaClient);
                }
                return step;
            }));
            chain.steps = loadedSteps;
            chain.buildChain(true);
        }
        return chain;
    }
}
