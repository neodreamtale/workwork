import { Step as StepTemplate } from '../generated/client';
import prisma from '../lib/db';
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

    // ==========================================
    // 🏃 运行期 API：跑业务专用 (Instance)
    // ==========================================

    async start(
        chainInstanceId: string,
        executor?: (payload: any, step: Step<T>) => Promise<any> | any,
        prismaClient = prisma
    ): Promise<string> {
        let stepInstance = await prismaClient.stepInstance.findFirst({
            where: { stepId: this.template.id, chainInstanceId }
        });

        if (!stepInstance) {
            stepInstance = await prismaClient.stepInstance.create({
                data: {
                    stepId: this.template.id,
                    chainInstanceId: chainInstanceId,
                    status: "RUNNING",
                }
            });
        } else {
            stepInstance = await prismaClient.stepInstance.update({
                where: { id: stepInstance.id },
                data: { status: "RUNNING" }
            });
        }

        if (!executor) {
            return stepInstance.status;
        }

        try {
            const resultPayload = await executor(stepInstance.payload, this);
            await this.complete(stepInstance.id, resultPayload, prismaClient);
            return "COMPLETED";
        } catch (error) {
            console.error(`[Step Execution Failed]: ${this.template.name}`, error);
            await this.fail(stepInstance.id, prismaClient);
            return "FAILED";
        }
    }

    async complete(stepInstanceId: string, payload?: any, prismaClient = prisma) {
        return prismaClient.stepInstance.update({
            where: { id: stepInstanceId },
            data: {
                status: "COMPLETED",
                ...(payload !== undefined ? { payload } : {})
            }
        });
    }

    async fail(stepInstanceId: string, prismaClient = prisma) {
        return prismaClient.stepInstance.update({
            where: { id: stepInstanceId },
            data: { status: "FAILED" }
        });
    }

    async startSubChain(chainInstanceId: string, prismaClient = prisma): Promise<string> {
        if (!this.template.subChainId) {
            throw new Error("该节点并没有配置子流程 (subChainId 为空)，无法启动");
        }

        let stepInstance = await prismaClient.stepInstance.findFirst({
            where: { stepId: this.template.id, chainInstanceId }
        });

        if (!stepInstance) {
            stepInstance = await prismaClient.stepInstance.create({
                data: { stepId: this.template.id, chainInstanceId, status: "RUNNING" }
            });
        }

        // 如果在 buildTemplate 时没有预加载子流程，我们要自己查一下它第一步是谁
        let firstStepId: string | null = null;
        if (this.subChain && this.subChain.steps.length > 0) {
            firstStepId = this.subChain.steps[0].template.id;
        } else {
            const subChainTemplate = await prismaClient.chain.findUnique({
                where: { id: this.template.subChainId },
                include: { steps: true }
            });
            if (!subChainTemplate) throw new Error("子流程模板不存在");
            const firstStep = subChainTemplate.steps.find((s: any) => !s.previousId) || subChainTemplate.steps[0];
            if (firstStep) firstStepId = firstStep.id;
        }

        const subChainInstance = await prismaClient.chainInstance.create({
            data: {
                templateId: this.template.subChainId,
                status: "RUNNING",
                nowStepId: firstStepId,
            }
        });

        await prismaClient.stepInstance.update({
            where: { id: stepInstance.id },
            data: { subChainInstanceId: subChainInstance.id }
        });

        return stepInstance.status;
    }
}