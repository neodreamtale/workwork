import { Step } from './Step';
import { Chain as PrismaChain } from '../generated/client';
import { StepResult } from './StepResult';
import prisma from '../../lib/db';

export class Chain<T = any> implements Partial<PrismaChain> {
    id?: string;
    name?: string | null;
    nowStepId?: string | null;
    chainPos?: number;
    createdAt?: Date;
    updatedAt?: Date;

    steps?: Step<T>[] = [];
    private idMap: Record<string, Step<T>> = {};
    lastId?: string | null = null;
    result?: StepResult<any>;
    finished: boolean = false;
    private listener: Record<string, (step: Step<T>, chain: Chain<T>) => void> = {};

    constructor(id?: string) {
        if (id) this.id = id;
        this.steps = [];
        this.buildChain();
    }

    static async loadById<U = any>(id: string, withSteps = false): Promise<Chain<U> | null> {
        const chain = await prisma.chain.findUnique({
            where: { id },
            include: withSteps ? { steps: true } : undefined,
        });
        if (!chain) return null;
        const c = new Chain<U>(chain.id);
        c.name = chain.name ?? undefined;
        c.chainPos = chain.chainPos ?? undefined;
        c.nowStepId = chain.nowStepId ?? null;
        c.steps = withSteps ? chain.steps : [];
        c.buildChain();
        return c;
    }

    buildChain() {
        this.idMap = {};
        for (const s of this.steps ?? []) {
            if ((s as Step).includeSteps) delete (s as Step).includeSteps;
        }
        for (const s of this.steps ?? []) {
            const id = (s as any).id;
            if (id) this.idMap[id] = s as Step<T>;
        }
        for (const s of this.steps ?? []) {
            const parentId = (s as Step).parentId as string | undefined | null;
            if (parentId) {
                const parent = this.idMap[parentId] ?? this.steps?.find(x => (x as any).id === parentId);
                if (parent) {
                    parent.includeSteps = parent.includeSteps ?? [];
                    if (!parent.includeSteps.find((x) => (x as Step).id === (s as Step).id)) {
                        parent.includeSteps.push(s as Step);
                    }
                }
            }
        }
        let tempId = this.steps[0].id;
        while (tempId)
    }

    getById(id?: string | null) {
        if (!id) return undefined;
        return this.idMap[id];
    }


    newStep(step: Step<T>, target: string | null, pos: "before" | "after" | "end" = "end") {
        this.steps = this.steps ?? [];
        const sid = (step as Step).id ?? null;
        if (step.parentId) {
            const parent = this.idMap[step.parentId];
            if (!parent) {
                throw new Error(`无法找到相关父节点:${step.parentId}，无法添加子节点`,);
            }
            parent.includeSteps = parent.includeSteps ?? [];
            parent.includeSteps.push(step);
            if (sid) this.idMap[sid] = step;
            if (this.id) (step as Step<T>).chainId = this.id;
        } else {
            // 无 parentId：在主集合中按 target/pos 插入，并更新 previous/next 链接
            if (target && this.idMap[target]) {
                const targetStep = this.idMap[target] as Step<T>;
                if (pos === 'before') {
                    const oldP = targetStep.previous ?? null;
                    step.next = targetStep.id;
                    step.previous = oldP;
                    // 更新原 prev 的 next 指向新 step
                    if (oldP && this.idMap[oldP]) {
                        (this.idMap[oldP] as Step<T>).next = sid;
                    }
                    targetStep.previous = sid;
                } else if (pos === 'after') {
                    const oldN = targetStep.next ?? null;
                    step.previous = targetStep.id;
                    step.next = oldN;
                    if (oldN && this.idMap[oldN]) {
                        (this.idMap[oldN] as Step<T>).previous = sid;
                    }
                    targetStep.next = sid;
                } else {
                    const last = this.steps[this.steps.length - 1];
                    (step as any).previous = last ? (last as any).id ?? null : null;
                    (step as any).next = null;
                    if (last) (last as any).next = sid;
                }

                // 确保在 steps 集合与 idMap 中登记
                if (!this.steps.find(s => (s as any).id === sid)) this.steps.push(step);
                if (sid) this.idMap[sid] = step;
                if (this.id) (step as any).chainId = this.id;
                return;
            }

            // target 不存在或未提供：把 step 作为集合末尾追加
            this.steps.push(step);
            if (sid) this.idMap[sid] = step;
            if (this.id) (step as any).chainId = this.id;
        }
    }

    removeById(id: string) {
        this.steps = (this.steps ?? []).filter(s => (s as any).id !== id);
        delete this.idMap[id];
        for (const parent of this.steps ?? []) {
            if (parent && parent.includeSteps) {
                parent.includeSteps = parent.includeSteps.filter((c) => (c as any).id !== id);
                if (parent.includeSteps.length === 0) delete parent.includeSteps;
            }
        }
    }

    // readonly view
    get index() {
        return this.idMap as Readonly<Record<string, Step<T>>>;
    }

    stepForward() {
        if (!this.steps || this.steps.length === 0) return;
        if (!this.nowStepId) {
            const first = this.steps[0];
            this.nowStepId = (first as any).id ?? null;
        }
        const step = this.getById(this.nowStepId ?? undefined);
        if (!step) return;
        if (step.includeSteps && Array.isArray(step.includeSteps)) {
            for (const sub of step.includeSteps) {
                sub.result = sub.exec(sub.payload);
                // emit step event for sub-step
                if (!sub.result.success) {
                    this.result = sub.result;
                    // emit progress (failed)
                    return;
                }
            }
        }

        step.result = step.exec(step.payload);
        if (!step.result.success) {
            this.result = step.result;
            return;
        }
        const hasNext = !!((step as Step).next);
        const hasInclude = !!(step.includeSteps && step.includeSteps.length > 0);
        if (!hasNext && !hasInclude) {
            this.finished = true;
            this.nowStepId = null;
        } else {
            this.nowStepId = (step as Step).next ?? null;
        }
        // emit progress after advancing
    }

    // compute progress as index / length (0..1). if step not found returns 0.
    private _computeProgress(step: Step<T>): number {
        if (!this.steps || this.steps.length === 0) return 0;
        const idx = this.steps.findIndex(s => (s as any).id === (step as any).id);
        if (idx < 0) return 0;
        return (idx + 1) / this.steps.length;
    }

    async create() {
        const data: any = {
            name: this.name ?? undefined,
            nowStepId: this.nowStepId ?? undefined,
            chainPos: this.chainPos ?? 0,
        };

        const created = await prisma.chain.create({ data });
        this.id = created.id;
        return created;
    }

    isFinished(): boolean {
        if (this.finished) return true;
        if (!this.steps || this.steps.length === 0) return true;
        if (!this.nowStepId) return true;
        const step = this.getById(this.nowStepId ?? undefined);
        if (!step) return true;
        const hasNext = !!((step as any).next);
        const hasInclude = !!(step.includeSteps && step.includeSteps.length > 0);
        return !hasNext && !hasInclude;
    }
}

