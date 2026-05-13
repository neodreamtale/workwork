import { Executor, ExecutionResult } from '../engine/Executor';

/**
 * 自动运行器：实现“响应式连跳”逻辑
 * 当一个步骤执行成功后，它会检查下一步是否标记为 isAuto，如果是则自动继续执行。
 */
export class AutoRunner {
  constructor(private executor: Executor) { }

  /**
   * 启动/继续执行流程实例，直到遇到非自动节点或流程结束
   */
  async run(instanceId: string): Promise<ExecutionResult> {
    // 1. 执行当前一步
    const res = await this.executor.executeNext(instanceId);

    // 2. 检查联动逻辑
    if (res.status === 'SUCCESS') {
      const nextStep = await this.executor.peekNextStep(instanceId);

      // 如果下一步存在，且标记为自动执行，则递归触发
      if (nextStep && nextStep.isAuto) {
        console.log(`[AutoRunner] 发现自动节点，正在驱动下一步: ${nextStep.bizKey || nextStep.name || nextStep.id}`);
        return this.run(instanceId); // 递归调用，实现连跳
      }
    }

    return res;
  }
}
