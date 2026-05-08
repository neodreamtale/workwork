import prisma from '../../lib/db';
import Chain from '../types/Chain';
import Step from '../types/Step';
import { Blueprint } from './Blueprint';

export class WorkflowEngine {
    
    // ==========================================
    // 基础流转驱动 API
    // ==========================================

    /**
     * 发起一个全新的工作流实例，并立即驱动它往前跑
     */
    static async startProcess(templateId: string, payload?: any): Promise<string> {
        const chainTemplate = await prisma.chain.findUnique({
            where: { id: templateId },
            include: { steps: true }
        });
        if (!chainTemplate) throw new Error("图纸不存在");
        
        const instance = await prisma.chainInstance.create({
            data: {
                templateId: templateId,
                status: "RUNNING",
                chainPayload: payload ?? null,
            }
        });

        await this.pull(instance.id);
        return instance.id;
    }

    /**
     * 外部系统接口：人工审批/填写表单完成。完成后引擎自动推导下一步！
     */
    static async completeStep(stepInstanceId: string, payload?: any) {
        const stepInstance = await prisma.stepInstance.update({
            where: { id: stepInstanceId },
            data: { status: 'COMPLETED', payload: payload ?? {} }
        });
        
        await this.pull(stepInstance.chainInstanceId);
    }

    /**
     * 节点执行异常、失败
     */
    static async failStep(stepInstanceId: string) {
        await prisma.stepInstance.update({
            where: { id: stepInstanceId },
            data: { status: 'FAILED' }
        });
    }

    // ==========================================
    // 核心大脑逻辑
    // ==========================================

    /**
     * 【一把梭哈】根据运行实例 ID，拉出图纸、历史节点状态
     */
    static async getRunningContext(chainInstanceId: string) {
        const instanceData = await prisma.chainInstance.findUnique({
            where: { id: chainInstanceId },
            include: {
                chain: { include: { steps: { include: { subChain: true } } } },
                stepInstances: true 
            }
        });
        if (!instanceData) throw new Error(`找不到运行实例：${chainInstanceId}`);
        return instanceData;
    }

    /**
     * 驱动工作流流转（核心心脏）
     */
    static async pull(chainInstanceId: string) {
        const data = await this.getRunningContext(chainInstanceId);
        if (data.status !== 'RUNNING') return; 

        // 拿到图纸结构（走 Blueprint 内存加载）
        const chainTemplate = await Blueprint.load(data.templateId);

        // 算命：通过遍历推导出“此时此刻应该亮起哪几个节点？”
        const activeSteps = this.findRunnableSteps(chainTemplate, data.stepInstances);

        if (activeSteps.length === 0) {
            const allCompleted = chainTemplate.steps.every(s => 
                data.stepInstances.some((si: any) => si.stepId === s.template.id && si.status === 'COMPLETED')
            );
            
            if (allCompleted) {
                // 大流程正式宣告竣工！
                await prisma.chainInstance.update({
                    where: { id: chainInstanceId },
                    data: { status: 'COMPLETED' }
                });
                
                // 子流程竣工自动唤醒父流程！
                if (data.parentStepInstanceId) {
                    await this.completeStep(data.parentStepInstanceId, data.chainPayload);
                }
            }
            return;
        }

        // 并发推动所有亮起的节点
        for (const step of activeSteps) {
            if (step.template.subChainId) {
                // 嵌套子流程！黑盒打开！
                const newChildInstanceId = await this.executeSubChainStep(step, chainInstanceId);
                if (newChildInstanceId) {
                    await this.pull(newChildInstanceId);
                }
            } else {
                // 普通节点，让它跑起来
                await this.executeNormalStep(step, chainInstanceId);
            }
        }
    }

    private static async executeNormalStep(step: Step<any>, chainInstanceId: string) {
        let stepInstance = await prisma.stepInstance.findFirst({
            where: { stepId: step.template.id, chainInstanceId }
        });

        if (!stepInstance) {
            stepInstance = await prisma.stepInstance.create({
                data: {
                    stepId: step.template.id,
                    chainInstanceId: chainInstanceId,
                    status: "RUNNING",
                }
            });
        } else {
            stepInstance = await prisma.stepInstance.update({
                where: { id: stepInstance.id },
                data: { status: "RUNNING" }
            });
        }
        // TODO: 如果有绑定的自动化业务回调 (executor)，在这里 await 跑完然后自动 completeStep
    }

    private static async executeSubChainStep(step: Step<any>, chainInstanceId: string): Promise<string | null> {
        if (!step.template.subChainId) return null;

        // 父节点状态切为 RUNNING
        let stepInstance = await prisma.stepInstance.findFirst({
            where: { stepId: step.template.id, chainInstanceId }
        });

        if (!stepInstance) {
            stepInstance = await prisma.stepInstance.create({
                data: { stepId: step.template.id, chainInstanceId, status: "RUNNING" }
            });
        }

        // 创建子流程实例，双向绑定
        const subChainInstance = await prisma.chainInstance.create({
            data: {
                templateId: step.template.subChainId,
                status: "RUNNING",
                parentStepInstanceId: stepInstance.id
            }
        });

        return subChainInstance.id;
    }

    /**
     * 【只读推导】状态即推导：算出哪些节点该跑了
     */
    private static findRunnableSteps(chainTemplate: Chain<any>, existingInstances: any[]): Step<any>[] {
        const runnable: Step<any>[] = [];
        for (const step of chainTemplate.steps) {
            const instance = existingInstances.find(i => i.stepId === step.template.id);
            if (instance?.status === 'COMPLETED' || instance?.status === 'RUNNING') continue;

            if (!step.template.previousId) {
                runnable.push(step);
            } else {
                const prevInstance = existingInstances.find(i => i.stepId === step.template.previousId);
                if (prevInstance?.status === 'COMPLETED') {
                    runnable.push(step);
                }
            }
        }
        return runnable;
    }
}
