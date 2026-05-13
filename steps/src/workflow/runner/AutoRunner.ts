import { Executor, ExecutionResult } from '../engine/Executor';

/**
 * 自动运行器：实现“响应式连跳”逻辑
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
        return this.run(instanceId); // 递归调用，实现连跳
      } 
      
      // 【新增】：如果没有下一步了，再拉一次绞盘，触发内核的“完成 (FINISHED)”逻辑
      if (!nextStep) {
        await this.executor.executeNext(instanceId);
      }
    }

    return res;
  }
}
