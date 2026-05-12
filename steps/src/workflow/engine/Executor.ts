import prisma from '../../../lib/db';

/**
 * 执行上下文：提供除了业务数据外的系统级信息
 */
export interface ExecutionContext {
  instanceId: string;
  stepInstanceId: string;
  templateId?: string;
}

/**
 * 业务处理器接口：支持输入和输出的泛型约束
 */
export type StepHandler<TInput = any, TOutput = any> = (
  input: TInput, 
  context: ExecutionContext
) => Promise<TOutput>;

/**
 * 执行结果包装器
 */
export interface ExecutionResult<T = any> {
  status: 'SUCCESS' | 'FAILED' | 'FINISHED' | 'NO_HANDLER';
  result?: T;
  reason?: string;
}

/**
 * 工作流执行引擎
 */
export class Executor {
  // 内部存储时使用 any 兼容多种步骤类型
  private handlers: Record<string, StepHandler<any, any>> = {};

  /**
   * 注册业务处理器 (带类型约束)
   */
  registerHandler<I = any, O = any>(stepName: string, handler: StepHandler<I, O>) {
    this.handlers[stepName] = handler;
  }

  /**
   * 执行指定实例的“下一个”待处理步骤
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

    const currentStepInstance = instance.stepInstances[0];
    const stepName = currentStepInstance.step.name || 'Unknown Step';

    // 2. 找到处理器
    const handler = this.handlers[stepName];
    if (!handler) {
      await this.markFailed(currentStepInstance.id, `未注册处理器: ${stepName}`);
      return { status: 'NO_HANDLER', reason: `未注册处理器: ${stepName}` };
    }

    // 3. 开始执行
    try {
      await prisma.stepInstance.update({
        where: { id: currentStepInstance.id },
        data: { status: 'RUNNING' }
      });

      // 组装上下文
      const context: ExecutionContext = {
        instanceId,
        stepInstanceId: currentStepInstance.id,
        templateId: currentStepInstance.stepId
      };

      // 获取输入数据 (目前演示从全局 payload 获取，后续可支持从上一步获取)
      const input = instance.chainPayload || {};
      
      // 调用业务方法 (由于内部存储是 any，这里直接调用)
      const result = await handler(input, context);

      // 4. 执行成功
      await prisma.stepInstance.update({
        where: { id: currentStepInstance.id },
        data: { 
          status: 'COMPLETED',
          payload: result as any 
        }
      });

      return { status: 'SUCCESS', result };

    } catch (error: any) {
      // 5. 执行失败
      await this.markFailed(currentStepInstance.id, error.message);
      return { status: 'FAILED', reason: error.message };
    }
  }

  private async markFailed(stepInstanceId: string, reason: string) {
    await prisma.stepInstance.update({
      where: { id: stepInstanceId },
      data: { 
        status: 'FAILED',
        payload: { error: reason } as any
      }
    });
  }
}
