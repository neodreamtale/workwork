import prisma from '../../lib/db';

export type StepHandler = (
  input: Record<string, any>
) => Promise<Record<string, any>>;

export interface ExecutionResult {
  status: 'SUCCESS' | 'FAILED' | 'FINISHED' | 'NO_HANDLER';
  result?: any;
  reason?: string;
}

// ========================================================================
// 数据库操作隔离层 (Database Access Layer)
// 通过将查询移出类，并使用 any 强制隔离，彻底解决 TS 实例化过深的问题。
// ========================================================================
const db = prisma as any;

async function db_getInstance(id: string) {
  return await db.chainInstance.findUnique({
    where: { id },
    select: { id: true, chainPayload: true, handlerUrl: true, parentStepInstanceId: true, status: true }
  });
}

async function db_getPendingStep(instanceId: string) {
  return await db.stepInstance.findMany({
    where: { chainInstanceId: instanceId, status: 'PENDING' },
    orderBy: { sortOrder: 'asc' },
    take: 2,
    select: {
      id: true,
      stepId: true,
      step: {
        select: { id: true, bizKey: true, name: true, handlerUrl: true, isAuto: true }
      }
    }
  });
}

async function db_getSubChain(parentStepId: string) {
  return await db.chainInstance.findFirst({
    where: { parentStepInstanceId: parentStepId },
    select: { id: true, status: true }
  });
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
    const instance: any = await db_getInstance(instanceId);
    if (!instance) throw new Error(`找不到实例: ${instanceId}`);

    const sInstances: any[] = await db_getPendingStep(instanceId);

    if (sInstances.length === 0) {
      await db.chainInstance.update({ where: { id: instanceId }, data: { status: 'COMPLETED' } });
      return { status: 'FINISHED' };
    }

    const sInstance = sInstances[0];
    const subChainInstance: any = await db_getSubChain(sInstance.id);

    if (subChainInstance && subChainInstance.status !== 'COMPLETED') {
      const subRes = await this.executeNext(subChainInstance.id);

      if (subRes.status === 'FINISHED') {
        const finishedSub: any = await db.chainInstance.findUnique({
          where: { id: subChainInstance.id },
          select: { chainPayload: true }
        });

        await db.stepInstance.update({ where: { id: sInstance.id }, data: { status: 'COMPLETED' } });

        await db.chainInstance.update({
          where: { id: instanceId },
          data: {
            chainPayload: {
              ...(instance.chainPayload || {}),
              ...(finishedSub?.chainPayload || {})
            }
          }
        });

        return this.executeNext(instanceId);
      }
      return subRes;
    }

    const bizKey = sInstance.step.bizKey;
    let input = (instance.chainPayload as Record<string, any>) || {};

    if (instance.parentStepInstanceId) {
      const parentData = await this.getAncestorsData(instanceId);
      input = { ...parentData, ...input };
    }

    let handler: StepHandler | undefined;
    if (bizKey) handler = this.handlers[bizKey];

    if (!handler) {
      const rootInstance = await this.getRootChainInstance(instanceId);
      const effectiveUrl = sInstance.step.handlerUrl || instance.handlerUrl || rootInstance.handlerUrl;

      if (effectiveUrl) {
        handler = async (inputData) => {
          const response = await fetch(effectiveUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payload: inputData,
              context: {
                stepId: sInstance.stepId,
                bizKey: sInstance.step.bizKey,
                stepName: sInstance.step.name,
                instanceId: instance.id,
                rootInstanceId: rootInstance.id
              }
            })
          });
          const responseData = await response.json();
          return responseData.data || responseData;
        };
      }
    }

    if (!handler) {
      const reason = `未找到处理器: [${bizKey || sInstance.step.name}]`;
      await this.markFailed(sInstance.id, reason);
      return { status: 'NO_HANDLER', reason };
    }

    try {
      const updateResult: any = await db.stepInstance.updateMany({
        where: { id: sInstance.id, status: 'PENDING' },
        data: { status: 'RUNNING' }
      });

      if (updateResult.count === 0) return { status: 'FAILED', reason: '任务已被抢占' };

      const startTime = Date.now();
      console.log(`\n>>> [STEP START] ${bizKey || sInstance.step.name} (${sInstance.id})`);
      console.log(`    Input:  ${JSON.stringify(input)}`);

      const result = await handler(input);
      const duration = Date.now() - startTime;

      await db.stepInstance.update({
        where: { id: sInstance.id },
        data: { status: 'COMPLETED', payload: result as any }
      });

      console.log(`<<< [STEP COMPLETED] ${bizKey || sInstance.step.name} in ${duration}ms`);
      console.log(`    Output: ${JSON.stringify(result)}`);

      const updatedInstance: any = await db.chainInstance.update({
        where: { id: instanceId },
        data: {
          chainPayload: {
            ...(instance.chainPayload || {}),
            ...(result || {})
          },
          status: 'RUNNING'
        }
      });

      return { status: 'SUCCESS', result: updatedInstance };

    } catch (error: any) {
      const reason = error.message || '未知错误';
      await this.markFailed(sInstance.id, reason);
      return { status: 'FAILED', reason };
    }
  }

  async peekNextStep(instanceId: string): Promise<any> {
    const nextSteps: any[] = await db_getPendingStep(instanceId);
    const sInstance = nextSteps[0];
    if (!sInstance) return null;

    const subChainInstance: any = await db_getSubChain(sInstance.id);

    if (subChainInstance && subChainInstance.status !== 'COMPLETED') {
      const nextSubStep = await this.peekNextStep(subChainInstance.id);
      if (!nextSubStep) {
        return nextSteps[1]?.step || null;
      }
      return nextSubStep;
    }

    return sInstance.step;
  }

  private async getAncestorsData(instanceId: string): Promise<Record<string, any>> {
    const instance: any = await db_getInstance(instanceId);
    if (!instance) return {};

    let currentData = (instance.chainPayload as Record<string, any>) || {};

    if (instance.parentStepInstanceId) {
      const parentStep: any = await db.stepInstance.findUnique({
        where: { id: instance.parentStepInstanceId },
        select: { chainInstanceId: true }
      });
      if (parentStep) {
        const parentData = await this.getAncestorsData(parentStep.chainInstanceId);
        currentData = { ...parentData, ...currentData };
      }
    }
    return currentData;
  }

  private async getRootChainInstance(instanceId: string): Promise<any> {
    const instance: any = await db_getInstance(instanceId);
    if (!instance) throw new Error(`找不到实例: ${instanceId}`);
    if (!instance.parentStepInstanceId) return instance;

    const parentStep: any = await db.stepInstance.findUnique({
      where: { id: instance.parentStepInstanceId },
      select: { chainInstanceId: true }
    });
    if (!parentStep) return instance;
    return this.getRootChainInstance(parentStep.chainInstanceId);
  }

  private async markFailed(stepInstanceId: string, reason: string) {
    const stepInstance: any = await db.stepInstance.update({
      where: { id: stepInstanceId },
      data: { status: 'FAILED', payload: { error: reason } as any }
    });
    await db.chainInstance.update({
      where: { id: stepInstance.chainInstanceId },
      data: { status: 'FAILED' }
    });
    await this.propagateErrorToRoot(stepInstance.chainInstanceId, stepInstance.stepId, reason);
  }

  private async propagateErrorToRoot(chainInstanceId: string, stepId: string, reason: string) {
    const chainInstance: any = await db.chainInstance.findUnique({
      where: { id: chainInstanceId },
      select: { id: true, error: true, parentStepInstanceId: true }
    });
    if (!chainInstance) return;
    const currentErrorMap = (chainInstance.error as Record<string, string>) || {};
    currentErrorMap[stepId] = reason;
    await db.chainInstance.update({
      where: { id: chainInstanceId },
      data: { error: currentErrorMap, status: 'FAILED' }
    });
    if (chainInstance.parentStepInstanceId) {
      const parentStep: any = await db.stepInstance.findUnique({
        where: { id: chainInstance.parentStepInstanceId },
        select: { chainInstanceId: true }
      });
      if (parentStep) await this.propagateErrorToRoot(parentStep.chainInstanceId, stepId, reason);
    }
  }
}
