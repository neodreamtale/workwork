import Step from './Step';
import { StepResult } from './StepResult';
import prisma from '../lib/db';
import { Chain as ChainTemplate, ChainInstance } from '../generated/client';

export default class Chain<T = any> {
    // 强制分离：内部只维护这两个 Prisma 对象
    template: ChainTemplate;
    instance?: ChainInstance;

    steps: Step<T>[] = [];
    private idMap: Record<string, Step<T>> = {};
    private tail?: Step<T>;
    result?: StepResult<any>;

    constructor(template?: Partial<ChainTemplate>, instance?: ChainInstance, autoBuild: boolean = true) {
        this.template = {
            id: template?.id ?? crypto.randomUUID(),
            name: template?.name ?? null,
            description: template?.description ?? null,
            chainLength: template?.chainLength ?? 0,
            createdAt: template?.createdAt ?? new Date(),
            updatedAt: template?.updatedAt ?? new Date(),
        };
        if (instance) {
            this.instance = instance;
        }
        this.idMap = {};
        if (autoBuild) this.buildChain();
    }

    /**
     * 根据模板 ID 加载一个工作流蓝图
     */
    static async loadTemplate<U = any>(id: string, withSteps = false): Promise<Chain<U>> {
        const chainData = await prisma.chain.findUnique({
            where: { id },
            include: withSteps ? { steps: true } : undefined,
        });
        
        console.info('Loaded chain template:', chainData?.id);
        if (chainData) {
            const { steps, ...templateProps } = chainData;
            const c = new Chain<U>(templateProps);
            
            if (withSteps && steps) {
                c.steps = steps.map((s: any) => new Step<U>(s));
            }
            c.buildChain();
            return c;
        } else {
            return new Chain<U>({ id });
        }
    }

    /**
     * 加载一个真正运行中的工作流实例
     */
    static async loadInstance<U = any>(instanceId: string): Promise<Chain<U>> {
        const instanceData = await prisma.chainInstance.findUnique({
            where: { id: instanceId },
            include: { chain: { include: { steps: true } } }
        });
        if (!instanceData) throw new Error(`找不到 ID 为 ${instanceId} 的运行实例`);

        const { chain, ...instanceProps } = instanceData;
        const { steps, ...templateProps } = chain;
        
        const c = new Chain<U>(templateProps, instanceProps);
        if (steps) {
            c.steps = steps.map((s: any) => new Step<U>(s));
        }
        c.buildChain();
        return c;
    }

    modifyName(name: string): Chain<T> {
        this.template.name = name;
        return this;
    }

    async progressWithId(nowStepId: string): Promise<Chain<T>> {
        if (!this.instance) {
            throw new Error("当前操作的是一个工作流模板！你需要先为它创建一个运行实例 (ChainInstance) 才能执行进度操作。");
        }
        
        this.instance.nowStepId = nowStepId;
        await prisma.chainInstance.update({
            where: { id: this.instance.id },
            data: { nowStepId }
        });
        return this;
    }

    buildChain(): Chain<T> {
        this.idMap = {};
        for (const s of this.steps) {
            if (s.includeSteps) delete s.includeSteps;
        }
        for (const s of this.steps) {
            if (s.template.id) this.idMap[s.template.id] = s;
        }
        for (const s of this.steps) {
            const parentId = s.template.parentId;
            if (parentId) {
                const parent = this.idMap[parentId] ?? this.steps.find(x => x.template.id === parentId);
                if (parent) {
                    parent.includeSteps = parent.includeSteps ?? [];
                    if (!parent.includeSteps.find((x) => x.template.id === s.template.id)) {
                        parent.includeSteps.push(s);
                    }
                }
            }
        }
        
        // 查找尾节点
        let tempId: string | null | undefined = this.steps[0]?.template.id; 
        while (tempId) {
            const step: Step<T> | undefined = this.idMap[tempId as string];
            if (!step) break;
            tempId = step.template.nextId;
            if (!step.template.nextId) {
                this.tail = step;
            }
        }
        
        try {
            this.persistIndexToDb();
        } catch (e) {}

        return this;
    }

    private async persistIndexToDb(): Promise<void> {
        try {
            await prisma.chain.upsert({
                where: { id: this.template.id },
                create: this.template,
                update: this.template
            });

            const remaining = Array.from(this.steps);
            const created = new Set<string>();
            const maxPass = remaining.length + 2;
            let pass = 0;
            
            while (remaining.length && pass < maxPass) {
                pass++;
                let progressed = false;
                for (let i = 0; i < remaining.length; i++) {
                    const s = remaining[i];
                    const id = s.template.id;
                    const pid = s.template.parentId;
                    
                    if (!pid || created.has(pid) || !this.idMap[pid]) {
                        s.template.chainId = this.template.id;
                        await prisma.step.upsert({ 
                            where: { id }, 
                            create: s.template, 
                            update: s.template 
                        });
                        created.add(id);
                        remaining.splice(i, 1);
                        progressed = true;
                        i--;
                    }
                }
                if (!progressed) break;
            }
        } catch (err: any) {
            console.error('Prisma persist error');
        }
    }

    getById(id?: string | null) {
        if (!id) return undefined;
        return this.idMap[id];
    }

    newStep(step: Step<T>, target: string | null, pos: "before" | "after" | "end" = "end"): Chain<T> {
        const sid = step.template.id;
        if (step.template.parentId) {
            const parent = this.idMap[step.template.parentId];
            if (!parent) {
                throw new Error(`无法找到相关父节点:${step.template.parentId}，无法添加子节点`);
            }
            parent.includeSteps = parent.includeSteps ?? [];
            parent.includeSteps.push(step);
            if (sid) this.idMap[sid] = step;
            step.template.chainId = this.template.id;
        } else {
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
        }
        if (sid) this.idMap[sid] = step;
        return this;
    }

    removeById(id: string) {
        this.steps = this.steps.filter(s => s.template.id !== id);
        delete this.idMap[id];
        for (const parent of this.steps) {
            if (parent && parent.includeSteps) {
                parent.includeSteps = parent.includeSteps.filter(c => c.template.id !== id);
                if (parent.includeSteps.length === 0) delete parent.includeSteps;
            }
        }
    }

    get index() {
        return this.idMap as Readonly<Record<string, Step<T>>>;
    }

    async create() {
        const created = await prisma.chain.create({ data: this.template });
        this.template.id = created.id;
        return created;
    }
}
