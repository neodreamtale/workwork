import Step from './Step';
import prisma from '../lib/db';
import { Chain as ChainTemplate } from '../generated/client';

export default class Chain<T = any> {
    template: ChainTemplate;
    steps: Step<T>[] = [];
    private idMap: Record<string, Step<T>> = {};
    private tail?: Step<T>;

    constructor(template?: Partial<ChainTemplate>) {
        this.template = {
            id: template?.id ?? crypto.randomUUID(),
            name: template?.name ?? null,
            description: template?.description ?? null,
            chainLength: template?.chainLength ?? 0,
            createdAt: template?.createdAt ?? new Date(),
            updatedAt: template?.updatedAt ?? new Date(),
        };
        this.idMap = {};
    }

    // ==========================================
    // 🎨 设计期 API：画图纸专用 (Template)
    // ==========================================

    /**
     * 构建图纸树：一次性拉取整条链、所有节点，并且【预加载】子流程结构！拒绝 N+1 循环查询！
     */
    static async buildTemplate<U = any>(templateId: string, prismaClient = prisma): Promise<Chain<U>> {
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

    async saveTemplate(prismaClient = prisma): Promise<void> {
        await prismaClient.chain.upsert({
            where: { id: this.template.id },
            create: this.template,
            update: this.template
        });

        for (const s of this.steps) {
            s.template.chainId = this.template.id;
            await prismaClient.step.upsert({
                where: { id: s.template.id },
                create: s.template,
                update: s.template
            });
        }
    }

    newStep(step: Step<T>, target: string | null, pos: "before" | "after" | "end" = "end"): Chain<T> {
        const sid = step.template.id;
        step.template.chainId = this.template.id;

        if (target && this.idMap[target]) {
            const targetStep = this.idMap[target];
            if (pos === 'before') {
                const oldP = targetStep.template.previousId;
                step.template.nextId = targetStep.template.id;
                step.template.previousId = oldP;
                if (oldP && this.idMap[oldP]) {
                    this.idMap[oldP].template.nextId = sid;
                }
                targetStep.template.previousId = sid;
            } else if (pos === 'after') {
                const oldN = targetStep.template.nextId;
                step.template.previousId = targetStep.template.id;
                step.template.nextId = oldN;
                if (oldN && this.idMap[oldN]) {
                    this.idMap[oldN].template.previousId = sid;
                }
                targetStep.template.nextId = sid;
            } else if (pos === 'end' && this.tail) {
                const last = this.idMap[this.tail.template.id];
                last.template.nextId = sid;
                step.template.previousId = this.tail.template.id;
                this.tail = step;
            }
        } else {
            this.steps.push(step);
        }
        if (sid) this.idMap[sid] = step;
        return this;
    }

    buildChain(): Chain<T> {
        this.idMap = {};
        for (const s of this.steps) {
            if (s.template.id) this.idMap[s.template.id] = s;
        }
        let tempId: string | null | undefined = this.steps[0]?.template.id;
        while (tempId) {
            const step: Step<T> | undefined = this.idMap[tempId as string];
            if (!step) break;
            tempId = step.template.nextId;
            if (!step.template.nextId) {
                this.tail = step;
            }
        }
        return this;
    }

    getById(id?: string | null) {
        if (!id) return undefined;
        return this.idMap[id];
    }

    removeById(id: string) {
        this.steps = this.steps.filter(s => s.template.id !== id);
        delete this.idMap[id];
    }

    get index() {
        return this.idMap as Readonly<Record<string, Step<T>>>;
    }

    // ==========================================
    // 🏃 运行期 API：跑业务专用 (Instance)
    // ==========================================

    /**
     * 【新车下线】根据图纸发车！生成一个全新的工作流运行实例
     */
    static async createInstance(templateId: string, chainPayload?: any, prismaClient = prisma): Promise<string> {
        const chainTemplate = await prismaClient.chain.findUnique({
            where: { id: templateId },
            include: { steps: true }
        });
        if (!chainTemplate) throw new Error("图纸不存在");
        const firstStep = chainTemplate.steps.find((s: any) => !s.previousId) || chainTemplate.steps[0];
        const instance = await prismaClient.chainInstance.create({
            data: {
                templateId: templateId,
                status: "RUNNING",
                chainPayload: chainPayload ?? null,
                nowStepId: firstStep?.id ?? null,
            }
        });
        return instance.id;
    }

    /**
     * 【老车点火】根据运行实例 ID，一把拉出图纸、历史节点状态
     */
    static async resumeInstance(chainInstanceId: string, prismaClient = prisma) {
        // 核心2：一把梭哈，效率拉满
        const instanceData = await prismaClient.chainInstance.findUnique({
            where: { id: chainInstanceId },
            include: {
                // 1. 图纸全拉出来 (连带步骤配置)
                chain: {
                    include: {
                        steps: { include: { subChain: true } }
                    }
                },
                // 2. 所有实际跑过的节点状态全拉出来
                stepInstances: true
            }
        });
        if (!instanceData) throw new Error(`找不到运行实例：${chainInstanceId}`);

        return instanceData;
    }
}
