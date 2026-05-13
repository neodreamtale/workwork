import prisma from '../../lib/db';

/**
 * 业务处理器接口：纯粹的 Json 处理函数
 */
export type StepHandler = (
  input: Record<string, any>
) => Promise<Record<string, any>>;

/**
 * 执行结果包装器
 */
export interface ExecutionResult {
  status: 'SUCCESS' | 'FAILED' | 'FINISHED' | 'NO_HANDLER';
  result?: any;
  reason?: string;
}

/**
 * 工作流执行内核
 * 支持递归钻取 (Drill-down) 执行子流程
 */
export class Executor {
  private handlers: Record<string, StepHandler> = {};

  /**
   * 注册业务处理器
   */
  registerHandler(bizKey: string, handler: StepHandler) {
    this.handlers[bizKey] = handler;
  }

  /**
   * 执行指定实例及其层级下当前的“第一个”待处理原子步骤
   * 实现深度优先的递归调度
   */
  async executeNext(instanceId: string): Promise<ExecutionResult> {
    // 1. 获取当前层级的实例及第一个待执行的步骤
    const instance = await prisma.chainInstance.findUnique({
      where: { id: instanceId },
      include: {
        stepInstances: {
          where: { status: 'PENDING' },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          include: { step: true }
        }
      }
    });

    if (!instance) throw new Error(`找不到实例: ${instanceId}`);

    // 如果当前层级没有 PENDING 步骤了，标记当前层级完成
    if (instance.stepInstances.length === 0) {
      await prisma.chainInstance.update({
        where: { id: instanceId },
        data: { status: 'COMPLETED' }
      });
      return { status: 'FINISHED' };
    }

    const sInstance = instance.stepInstances[0];

    // ---------------------------------------------------------
    // 核心逻辑：检查是否存在子流程实例挂载在此步骤上
    // ---------------------------------------------------------
    const subChainInstance = await prisma.chainInstance.findFirst({
      where: { parentStepInstanceId: sInstance.id }
    });

    // 如果有子流程且没跑完，绞盘向下钻取
    if (subChainInstance && subChainInstance.status !== 'COMPLETED') {
      console.log(`[Executor] 发现子流程实例 ${subChainInstance.id}, 正在向下钻取...`);
      const subRes = await this.executeNext(subChainInstance.id);
      
      // 如果子流程刚刚跑完最后一步
      if (subRes.status === 'FINISHED') {
        console.log(`[Executor] 子流程 ${subChainInstance.id} 执行完毕，回归父层级。`);
        // 标记父层级的这个复合步骤为完成
        await prisma.stepInstance.update({
          where: { id: sInstance.id },
          data: { status: 'COMPLETED' }
        });
        // 尾递归：继续跑父层级的下一步
        return this.executeNext(instanceId);
      }
      return subRes;
    }

    // ---------------------------------------------------------
    // 原子执行逻辑：如果没有子流程，则执行当前步骤的 Handler
    // ---------------------------------------------------------
    const bizKey = sInstance.step.bizKey; 
    const input = (instance.chainPayload as Record<string, any>) || {};

    let handler: StepHandler | undefined;
    if (bizKey) {
      handler = this.handlers[bizKey];
    }

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
          if (!response.ok) {
            throw new Error(`远程调用失败(${response.status}): ${await response.text()}`);
          }
          const responseData = await response.json();
          return responseData.data || responseData;
        };
      }
    }

    if (!handler) {
      const stepIdentifier = bizKey || sInstance.step.name || sInstance.stepId;
      const reason = `未找到处理器: [${stepIdentifier}] (无本地 Handler 且无有效远程 URL)`;
      await this.markFailed(sInstance.id, reason);
      return { status: 'NO_HANDLER', reason };
    }

    try {
      // 原子抢占锁
      const updateResult = await prisma.stepInstance.updateMany({
        where: { id: sInstance.id, status: 'PENDING' },
        data: { status: 'RUNNING' }
      });

      if (updateResult.count === 0) {
        return { status: 'FAILED', reason: '任务已被抢占' };
      }

      const result = await handler(input);

      // 执行成功：更新状态并同步数据流 (雪球合并)
      await prisma.stepInstance.update({
        where: { id: sInstance.id },
        data: { status: 'COMPLETED', payload: result as any }
      });

      await prisma.chainInstance.update({
        where: { id: instanceId },
        data: {
          chainPayload: {
            ...(instance.chainPayload as Record<string, any> || {}),
            ...(result as Record<string, any> || {})
          },
          status: 'RUNNING'
        }
      });

      return { status: 'SUCCESS', result };

    } catch (error: any) {
      const reason = error.message || '未知错误';
      await this.markFailed(sInstance.id, reason);
      return { status: 'FAILED', reason };
    }
  }

  /**
   * 预检下一步的配置：支持递归钻取，确保看到的是当前真正待执行的原子步骤
   */
  async peekNextStep(instanceId: string): Promise<any> {
    const instance = await prisma.chainInstance.findUnique({
      where: { id: instanceId },
      include: {
        stepInstances: {
          where: { status: 'PENDING' },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          include: { step: true }
        }
      }
    });

    const sInstance = instance?.stepInstances[0];
    if (!sInstance) return null;

    // 检查是否存在挂载在此步骤上的子流程实例
    const subChainInstance = await prisma.chainInstance.findFirst({
      where: { parentStepInstanceId: sInstance.id }
    });

    // 如果有子流程且没跑完，向下钻取预检
    if (subChainInstance && subChainInstance.status !== 'COMPLETED') {
      return this.peekNextStep(subChainInstance.id);
    }

    return sInstance.step;
  }

  /**
   * 递归寻找根 ChainInstance
   */
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
      if (parentStep) {
        await this.propagateErrorToRoot(parentStep.chainInstanceId, stepId, reason);
      }
    }
  }
}
