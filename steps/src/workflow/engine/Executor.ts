import prisma from '../../lib/db';

export type StepHandler = (
  input: Record<string, any>
) => Promise<Record<string, any>>;

export interface ExecutionResult {
  status: 'SUCCESS' | 'FAILED' | 'FINISHED' | 'NO_HANDLER';
  result?: any;
  reason?: string;
}

export class Executor {
  private handlers: Record<string, StepHandler> = {};

  registerHandler(bizKey: string, handler: StepHandler) {
    this.handlers[bizKey] = handler;
  }

  async executeNext(instanceId: string): Promise<ExecutionResult> {
    // 使用 select 代替 include，通过显式指定字段来降低 TS 类型推导深度
    const instance = await prisma.chainInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        chainPayload: true,
        handlerUrl: true,
        parentStepInstanceId: true,
        status: true,
        stepInstances: {
          where: { status: 'PENDING' },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: {
            id: true,
            stepId: true,
            step: {
              select: {
                id: true,
                bizKey: true,
                name: true,
                handlerUrl: true
              }
            }
          }
        }
      }
    });

    if (!instance) throw new Error(`找不到实例: ${instanceId}`);

    if (instance.stepInstances.length === 0) {
      await prisma.chainInstance.update({
        where: { id: instanceId },
        data: { status: 'COMPLETED' }
      });
      return { status: 'FINISHED' };
    }

    const sInstance = instance.stepInstances[0];
    const subChainInstance = await prisma.chainInstance.findFirst({
      where: { parentStepInstanceId: sInstance.id },
      select: { id: true, status: true } // 同样使用 select
    });

    if (subChainInstance && subChainInstance.status !== 'COMPLETED') {
      const subRes = await this.executeNext(subChainInstance.id);
      
      if (subRes.status === 'FINISHED') {
        const finishedSub = await prisma.chainInstance.findUnique({
          where: { id: subChainInstance.id },
          select: { chainPayload: true }
        });

        await prisma.stepInstance.update({
          where: { id: sInstance.id },
          data: { status: 'COMPLETED' }
        });

        await prisma.chainInstance.update({
          where: { id: instanceId },
          data: {
            chainPayload: {
              ...(instance.chainPayload as Record<string, any> || {}),
              ...(finishedSub?.chainPayload as Record<string, any> || {})
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
      const updateResult = await prisma.stepInstance.updateMany({
        where: { id: sInstance.id, status: 'PENDING' },
        data: { status: 'RUNNING' }
      });

      if (updateResult.count === 0) return { status: 'FAILED', reason: '任务已被抢占' };

      const startTime = Date.now();
      console.log(`\n>>> [STEP START] ${bizKey || sInstance.step.name} (${sInstance.id})`);
      console.log(`    Input:  ${JSON.stringify(input)}`);

      const result = await handler(input);
      const duration = Date.now() - startTime;

      await prisma.stepInstance.update({
        where: { id: sInstance.id },
        data: { status: 'COMPLETED', payload: result as any }
      });

      console.log(`<<< [STEP COMPLETED] ${bizKey || sInstance.step.name} in ${duration}ms`);
      console.log(`    Output: ${JSON.stringify(result)}`);

      const updatedInstance = await prisma.chainInstance.update({
        where: { id: instanceId },
        data: {
          chainPayload: {
            ...(instance.chainPayload as Record<string, any> || {}),
            ...(result as Record<string, any> || {})
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
    const instance = await prisma.chainInstance.findUnique({
      where: { id: instanceId },
      select: {
        stepInstances: {
          where: { status: 'PENDING' },
          orderBy: { sortOrder: 'asc' },
          take: 2,
          select: {
            id: true,
            step: {
              select: {
                id: true,
                bizKey: true,
                name: true,
                isAuto: true,
                handlerUrl: true
              }
            }
          }
        }
      }
    });

    const sInstance = instance?.stepInstances[0];
    if (!sInstance) return null;

    const subChainInstance = await prisma.chainInstance.findFirst({
      where: { parentStepInstanceId: sInstance.id },
      select: { id: true, status: true }
    });

    if (subChainInstance && subChainInstance.status !== 'COMPLETED') {
      const nextSubStep = await this.peekNextStep(subChainInstance.id);
      if (!nextSubStep) {
        return instance?.stepInstances[1]?.step || null;
      }
      return nextSubStep;
    }

    return sInstance.step;
  }

  private async getAncestorsData(instanceId: string): Promise<Record<string, any>> {
    const instance = await prisma.chainInstance.findUnique({
      where: { id: instanceId },
      select: { parentStepInstanceId: true, chainPayload: true }
    });
    if (!instance) return {};

    let currentData = (instance.chainPayload as Record<string, any>) || {};

    if (instance.parentStepInstanceId) {
      const parentStep = await prisma.stepInstance.findUnique({
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
    const instance = await prisma.chainInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, handlerUrl: true, parentStepInstanceId: true }
    });
    if (!instance) throw new Error(`找不到实例: ${instanceId}`);
    if (!instance.parentStepInstanceId) return instance;

    const parentStep = await prisma.stepInstance.findUnique({
      where: { id: instance.parentStepInstanceId },
      select: { chainInstanceId: true }
    });
    if (!parentStep) return instance;
    return this.getRootChainInstance(parentStep.chainInstanceId);
  }

  private async markFailed(stepInstanceId: string, reason: string) {
    const stepInstance = await prisma.stepInstance.update({
      where: { id: stepInstanceId },
      data: { status: 'FAILED', payload: { error: reason } as any }
    });
    await prisma.chainInstance.update({
      where: { id: stepInstance.chainInstanceId },
      data: { status: 'FAILED' }
    });
    await this.propagateErrorToRoot(stepInstance.chainInstanceId, stepInstance.stepId, reason);
  }

  private async propagateErrorToRoot(chainInstanceId: string, stepId: string, reason: string) {
    const chainInstance = await prisma.chainInstance.findUnique({
      where: { id: chainInstanceId },
      select: { id: true, error: true, parentStepInstanceId: true }
    });
    if (!chainInstance) return;
    const currentErrorMap = (chainInstance.error as Record<string, string>) || {};
    currentErrorMap[stepId] = reason;
    await prisma.chainInstance.update({
      where: { id: chainInstanceId },
      data: { error: currentErrorMap, status: 'FAILED' }
    });
    if (chainInstance.parentStepInstanceId) {
      const parentStep = await prisma.stepInstance.findUnique({
        where: { id: chainInstance.parentStepInstanceId },
        select: { chainInstanceId: true }
      });
      if (parentStep) await this.propagateErrorToRoot(parentStep.chainInstanceId, stepId, reason);
    }
  }
}
