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
 * 专注于单步执行的原子性、远程调用、状态更新与错误冒泡
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
   * 原子执行方法：只执行指定实例当前的“第一个”待处理步骤
   */
  async executeNext(instanceId: string): Promise<ExecutionResult> {
    // 1. 获取当前实例及第一个待执行的步骤
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

    // 如果没有 PENDING 步骤了，标记整个流程完成
    if (instance.stepInstances.length === 0) {
      await prisma.chainInstance.update({
        where: { id: instanceId },
        data: { status: 'COMPLETED' }
      });
      return { status: 'FINISHED' };
    }

    const sInstance = instance.stepInstances[0];
    const bizKey = sInstance.step.bizKey;
    const input = (instance.chainPayload as Record<string, any>) || {};

    let handler: StepHandler | undefined;

    // A. 寻找本地处理器
    if (bizKey) {
      handler = this.handlers[bizKey];
    }

    // B. 构建远程回调处理器
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
      const reason = `未找到处理器: [${stepIdentifier}] (本地未注册且无有效回调地址)`;
      await this.markFailed(sInstance.id, reason);
      return { status: 'NO_HANDLER', reason };
    }

    // 3. 开始执行
    try {
      await prisma.stepInstance.update({
        where: { id: sInstance.id },
        data: { status: 'RUNNING' }
      });

      const result = await handler(input);

      // 4. 执行成功：更新步骤状态并同步结果到全局负载 (数据流转)
      await prisma.stepInstance.update({
        where: { id: sInstance.id },
        data: {
          status: 'COMPLETED',
          payload: result as any
        }
      });

      // 将结果合并到 ChainInstance 的全局负载中，实现“雪球式”数据流转
      await prisma.chainInstance.update({
        where: { id: instanceId },
        data: {
          chainPayload: {
            ...(instance.chainPayload as Record<string, any> || {}),
            ...(result as Record<string, any> || {})
          },
          status: 'RUNNING' // 只要跑过一步，状态就是 RUNNING
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
   * 预检下一步的配置（供 Runner 使用）
   */
  async peekNextStep(instanceId: string) {
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
    return instance?.stepInstances[0]?.step;
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
      data: {
        status: 'FAILED',
        payload: { error: reason } as any
      }
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
      data: {
        error: currentErrorMap,
        status: 'FAILED'
      }
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
