import prisma from '../../lib/db';
import { InstanceChain, InstanceStep, JsonValue } from '../../types/WorkFlow';

export type StepHandler = (input: Record<string, JsonValue>) => Promise<Record<string, JsonValue>>;

export interface ExecutionResult {
  status: 'SUCCESS' | 'FAILED' | 'FINISHED' | 'NO_HANDLER';
  result?: JsonValue;
  reason?: string;
}

const db = prisma as any;

// ========================================================================
// 数据库操作隔离层
// ========================================================================
async function db_getInstance(id: string): Promise<InstanceChain | null> {
  const data = await db.chainInstance.findUnique({
    where: { id },
    select: { id: true, templateId: true, chainPayload: true, handlerUrl: true, parentStepInstanceId: true, status: true }
  });
  return data as InstanceChain | null;
}

async function db_getProcessingSteps(instanceId: string): Promise<InstanceStep[]> {
  return await db.stepInstance.findMany({
    where: { 
      chainInstanceId: instanceId, 
      OR: [ { status: 'PENDING' }, { status: 'RUNNING' } ]
    },
    orderBy: { sortOrder: 'asc' },
    take: 2,
    select: {
      id: true, stepId: true, status: true, sortOrder: true,
      step: { select: { id: true, bizKey: true, name: true, handlerUrl: true, isAuto: true } }
    }
  }) as InstanceStep[];
}

async function db_getSubChain(parentStepId: string): Promise<InstanceChain | null> {
  const data = await db.chainInstance.findFirst({
    where: { parentStepInstanceId: parentStepId },
    select: { id: true, status: true }
  });
  return data as InstanceChain | null;
}

// ========================================================================
// 执行器类 (Executor)
// ========================================================================
export class Executor {
  private handlers: Record<string, StepHandler> = {};

  registerHandler(bizKey: string, handler: StepHandler) {
    this.handlers[bizKey] = handler;
  }

  async executeNext(instanceId: string): Promise<ExecutionResult> {
    const chainIns = await db_getInstance(instanceId);
    if (!chainIns) throw new Error(`找不到实例: ${instanceId}`);

    const activeSteps = await db_getProcessingSteps(instanceId);

    if (activeSteps.length === 0) {
      return this.handleWorkflowFinished(chainIns);
    }

    const stepIns = activeSteps[0];
    const subChain = await db_getSubChain(stepIns.id);

    if (subChain) {
      return this.processSubChainStep(chainIns, stepIns, subChain);
    }

    return this.processHandlerStep(chainIns, stepIns);
  }

  private async handleWorkflowFinished(chainIns: InstanceChain): Promise<ExecutionResult> {
    const failedStep = await db.stepInstance.findFirst({
      where: { chainInstanceId: chainIns.id, status: 'FAILED' },
      select: { 
        payload: true, 
        step: { select: { name: true, bizKey: true } } 
      }
    });

    if (failedStep) {
      const errorData = failedStep.payload as any;
      const reason = errorData?.error || `步骤 [${failedStep.step.name || failedStep.step.bizKey}] 执行失败`;
      await db.chainInstance.update({ where: { id: chainIns.id }, data: { status: 'FAILED' } });
      return { status: 'FAILED', reason };
    }

    await db.chainInstance.update({ where: { id: chainIns.id }, data: { status: 'COMPLETED' } });
    return { status: 'FINISHED' };
  }

  private async processSubChainStep(chainIns: InstanceChain, stepIns: InstanceStep, subChain: InstanceChain): Promise<ExecutionResult> {
    if (subChain.status === 'COMPLETED') {
      const finishedSub: any = await db.chainInstance.findUnique({
        where: { id: subChain.id },
        select: { chainPayload: true }
      });

      await db.stepInstance.update({ where: { id: stepIns.id }, data: { status: 'COMPLETED' } });
      await db.chainInstance.update({
        where: { id: chainIns.id },
        data: {
          chainPayload: {
            ...(chainIns.chainPayload as Record<string, JsonValue> || {}),
            ...(finishedSub?.chainPayload as Record<string, JsonValue> || {})
          } as JsonValue
        }
      });
      console.log(`<<< [子流程完成] ${stepIns.step.name || stepIns.step.bizKey}`);
      return this.executeNext(chainIns.id);
    }

    if (stepIns.status === 'PENDING') {
      console.log(`\n>>> [进入子流程] ${stepIns.step.name || stepIns.step.bizKey} (实例: ${subChain.id})`);
      await db.stepInstance.update({ where: { id: stepIns.id }, data: { status: 'RUNNING' } });
    }
    const subRes = await this.executeNext(subChain.id);
    if (subRes.status === 'FINISHED') {
      // 子流程跑完后，这里其实会由上面的 subChain.status === 'COMPLETED' 逻辑在下一次循环处理
      // 但为了直观，我们可以直接在这里触发下一次主流程
      return this.executeNext(chainIns.id);
    }
    return subRes;
  }

  private async processHandlerStep(chainIns: InstanceChain, stepIns: InstanceStep): Promise<ExecutionResult> {
    if (stepIns.status === 'RUNNING') return { status: 'FAILED', reason: '该任务正在处理中' };

    const grab = await db.stepInstance.updateMany({
      where: { id: stepIns.id, status: 'PENDING' },
      data: { status: 'RUNNING' }
    });
    if (grab.count === 0) return { status: 'FAILED', reason: '该任务已被抢占' };

    const bizKey = stepIns.step.bizKey;
    const handler = await this.getEffectiveHandler(chainIns, stepIns);

    if (!handler) {
      const reason = `未找到处理器: [${bizKey || stepIns.step.name}]`;
      await this.markFailed(stepIns.id, reason);
      return { status: 'NO_HANDLER', reason };
    }

    try {
      console.log(`\n>>> [开始执行] ${bizKey || stepIns.step.name} (${stepIns.id})`);
      const input = await this.getMergedInput(chainIns);
      const result = await handler(input);

      await db.stepInstance.update({
        where: { id: stepIns.id },
        data: { status: 'COMPLETED', payload: result as any }
      });

      const updated = await db.chainInstance.update({
        where: { id: chainIns.id },
        data: {
          chainPayload: { ...(chainIns.chainPayload as any || {}), ...(result || {}) } as JsonValue,
          status: 'RUNNING'
        }
      });

      console.log(`<<< [执行完成] ${bizKey || stepIns.step.name}`);
      return { status: 'SUCCESS', result: updated.chainPayload as JsonValue };

    } catch (error: any) {
      const reason = error.message || '未知错误';
      await this.markFailed(stepIns.id, reason);
      return { status: 'FAILED', reason };
    }
  }

  private async getEffectiveHandler(chainIns: InstanceChain, stepIns: InstanceStep): Promise<StepHandler | null> {
    const bizKey = stepIns.step.bizKey;
    if (bizKey && this.handlers[bizKey]) return this.handlers[bizKey];
    const root = await this.getRootChainInstance(chainIns.id);
    const url = stepIns.step.handlerUrl || chainIns.handlerUrl || root.handlerUrl;
    if (!url) return null;
    return async (inputData) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: inputData, context: { stepId: stepIns.stepId, bizKey, instanceId: chainIns.id } })
      });
      const json = await res.json();
      return json.data || json;
    };
  }

  private async getMergedInput(chainIns: InstanceChain): Promise<Record<string, JsonValue>> {
    let input = (chainIns.chainPayload as Record<string, JsonValue>) || {};
    if (chainIns.parentStepInstanceId) {
      const parentData = await this.getAncestorsData(chainIns.id);
      input = { ...parentData, ...input };
    }
    return input;
  }

  async peekNextStep(instanceId: string): Promise<any> {
    const nextSteps = await db_getProcessingSteps(instanceId);
    const stepIns = nextSteps[0];
    if (!stepIns) return null;
    const subChain = await db_getSubChain(stepIns.id);
    if (subChain && subChain.status !== 'COMPLETED') {
      const nextSub = await this.peekNextStep(subChain.id);
      return nextSub || nextSteps[1]?.step || null;
    }
    return stepIns.step;
  }

  private async getAncestorsData(instanceId: string): Promise<Record<string, JsonValue>> {
    const chainIns = await db_getInstance(instanceId);
    if (!chainIns || !chainIns.parentStepInstanceId) return (chainIns?.chainPayload as any) || {};
    const parentStep: any = await db.stepInstance.findUnique({ where: { id: chainIns.parentStepInstanceId }, select: { chainInstanceId: true } });
    return { ...(await this.getAncestorsData(parentStep.chainInstanceId)), ...(chainIns.chainPayload as any || {}) };
  }

  private async getRootChainInstance(instanceId: string): Promise<InstanceChain> {
    const chainIns = await db_getInstance(instanceId);
    if (!chainIns || !chainIns.parentStepInstanceId) return chainIns!;
    const parentStep: any = await db.stepInstance.findUnique({ where: { id: chainIns.parentStepInstanceId }, select: { chainInstanceId: true } });
    return this.getRootChainInstance(parentStep.chainInstanceId);
  }

  private async markFailed(stepInstanceId: string, reason: string) {
    const stepIns: any = await db.stepInstance.update({ where: { id: stepInstanceId }, data: { status: 'FAILED', payload: { error: reason } as any } });
    await db.chainInstance.update({ where: { id: stepIns.chainInstanceId }, data: { status: 'FAILED' } });
    await this.propagateErrorToRoot(stepIns.chainInstanceId, stepIns.stepId, reason);
  }

  private async propagateErrorToRoot(chainInstanceId: string, stepId: string, reason: string) {
    const chainIns: any = await db.chainInstance.findUnique({ where: { id: chainInstanceId }, select: { id: true, error: true, parentStepInstanceId: true } });
    if (!chainIns) return;
    const currentErrorMap = (chainIns.error as Record<string, string>) || {};
    currentErrorMap[stepId] = reason;
    await db.chainInstance.update({ where: { id: chainInstanceId }, data: { error: currentErrorMap, status: 'FAILED' } });
    if (chainIns.parentStepInstanceId) {
      const parentStep: any = await db.stepInstance.findUnique({ where: { id: chainIns.parentStepInstanceId }, select: { chainInstanceId: true } });
      if (parentStep) await this.propagateErrorToRoot(parentStep.chainInstanceId, stepId, reason);
    }
  }
}
