import { Step } from './Step';
import { Chain as PrismaChain } from '../generated/client';
import { StepResult } from './StepResult';

/**
 * Runtime Chain — maintains steps and an internal id->step index.
 * Operations on the logical chain should work with IDs; Chain resolves
 * IDs to objects using the _index dictionary.
 */
export class Chain<T = any> {
    steps?: Step<T>[];
    private _index: Record<string, Step<T>> = {};
    /** 当前运行的步骤 id（链上只记录 id，遍历/增删也以 id 为主） */
    nowStepId?: string | null;
    /** chain 级别的最终结果（当某一步失败时设置） */
    result?: StepResult<any>;
    /** 是否完成 */
    finished: boolean = false;

    // accept partial PrismaChain data + optional steps when constructing
    constructor(data?: Partial<PrismaChain> & { steps?: Step<T>[] }) {
        if (data) Object.assign(this, data);
        this.steps = data?.steps ?? [];
        this.rebuildIndex();
    }

    rebuildIndex() {
        this._index = {};
        for (const s of this.steps ?? []) {
            if (s && (s as Step).id) this._index[(s as Step).id] = s;
        }
        // 如果有 parentId，把子 step 挂到父 step 的 includeSteps
        for (const s of this.steps ?? []) {
            const parentId = (s as Step).parentId as string | undefined | null;
            if (parentId) {
                const parent = this._index[parentId];
                if (parent) {
                    parent.includeSteps = parent.includeSteps ?? [];
                    // avoid duplicates
                    if (!parent.includeSteps.find((x) => (x as Step).id === (s as Step).id)) {
                        parent.includeSteps.push(s as Step);
                    }
                }
            }
        }
    }

    getById(id?: string | null) {
        if (!id) return undefined;
        return this._index[id];
    }

    pushStep(step: Step<T>) {
        this.steps = this.steps ?? [];
        this.steps.push(step);
        if ((step as Step).id) this._index[(step as Step).id] = step;
        // 如果该 step 有 parentId，则把它加入父的 includeSteps
        const parentId = (step as Step).parentId as string | undefined | null;
        if (parentId) {
            const parent = this._index[parentId];
            if (parent) {
                parent.includeSteps = parent.includeSteps ?? [];
                if (!parent.includeSteps.find((x) => (x as any).id === (step as any).id)) {
                    parent.includeSteps.push(step as any);
                }
            }
        }
    }

    removeById(id: string) {
        this.steps = (this.steps ?? []).filter(s => (s as any).id !== id);
        delete this._index[id];
        // 也从父 includeSteps 中移除
        for (const k of Object.keys(this._index)) {
            const parent = this._index[k];
            if (parent && parent.includeSteps) {
                parent.includeSteps = parent.includeSteps.filter((c) => (c as any).id !== id);
                if (parent.includeSteps.length === 0) delete parent.includeSteps;
            }
        }
    }

    // readonly view for tests
    get index() {
        return this._index as Readonly<Record<string, Step<T>>>;
    }

    /**
     * 步进到当前 nowStepId 指向的步骤并执行；如果 nowStepId 未设置则从第一步开始。
     * 规则：先执行包含的子步骤（按顺序），子步骤或主步骤任一失败（result.success === false）
     * 则把该 StepResult 记录到 chain.result 并停止步进，返回 null。
     */
    stepForward() {
        // no steps
        if (!this.steps || this.steps.length === 0) return;

        // initialize nowStepId to first step if unset
        if (!this.nowStepId) {
            const first = this.steps[0];
            this.nowStepId = (first as any).id ?? null;
        }

        const step = this.getById(this.nowStepId ?? undefined);
        if (!step) return;

        // execute includeSteps sequentially
        if (step.includeSteps && Array.isArray(step.includeSteps)) {
            for (const sub of step.includeSteps) {
                sub.result = sub.exec(sub.payload);
                if (!sub.result.success) {
                    this.result = sub.result;
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
    }

    /** 返回链是否完成（轻量检查） */
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

