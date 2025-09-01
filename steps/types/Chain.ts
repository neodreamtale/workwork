import { Step } from './Step';
import { Chain as PrismaChain } from '../generated/client';

/**
 * Runtime Chain — maintains steps and an internal id->step index.
 * Operations on the logical chain should work with IDs; Chain resolves
 * IDs to objects using the _index dictionary.
 */
export class Chain<T = any> {
    steps?: Step<T>[];
    private _index: Record<string, Step<T>> = {};

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
}

