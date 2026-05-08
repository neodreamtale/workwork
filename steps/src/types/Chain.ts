import Step from './Step';
import { Chain as ChainTemplate } from '../../generated/client';

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
}
