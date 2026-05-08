import { Step as StepTemplate } from '../../generated/client';
import type Chain from './Chain';

export default class Step<T = any> {
    template: StepTemplate;
    subChain?: Chain<T>; // 预加载的子流程蓝图

    constructor(template?: Partial<StepTemplate>) {
        this.template = {
            id: template?.id ?? crypto.randomUUID(),
            name: template?.name ?? null,
            previousId: template?.previousId ?? null,
            nextId: template?.nextId ?? null,
            chainId: template?.chainId ?? '',
            subChainId: template?.subChainId ?? null,
            createdAt: template?.createdAt ?? new Date(),
            updatedAt: template?.updatedAt ?? new Date(),
        } as StepTemplate;
    }
}