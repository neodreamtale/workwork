import { Step as StepTemplate, StepInstance } from '../generated/client';
import { StepResult } from './StepResult';
import prisma from '../lib/db';

export default class Step<T = any> {
    // 强制分离蓝图与运行实例
    template: StepTemplate;
    instance?: StepInstance;

    // 内存运行时的状态
    result?: StepResult<T>;
    includeSteps?: Step<T>[];

    constructor(template?: Partial<StepTemplate>, instance?: StepInstance) {
        this.template = {
            id: template?.id ?? crypto.randomUUID(),
            name: template?.name ?? null,
            previousId: template?.previousId ?? null,
            nextId: template?.nextId ?? null,
            chainId: template?.chainId ?? '',
            parentId: template?.parentId ?? null,
            subChainId: template?.subChainId ?? null,
            defaultPayload: template?.defaultPayload ?? null,
            createdAt: template?.createdAt ?? new Date(),
            updatedAt: template?.updatedAt ?? new Date(),
        };
        if (instance) {
            this.instance = instance;
        }
    }

    // 持久化模板定义
    async save(prismaClient = prisma) {
        return prismaClient.step.upsert({
            where: { id: this.template.id },
            create: this.template,
            update: this.template,
        });
    }
}