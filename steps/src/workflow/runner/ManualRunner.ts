import { Executor, ExecutionResult } from '../engine/Executor';

/**
 * 手动运行器：点一下，走一步
 * 无论下一步是否标记为 isAuto，它都只执行当前待处理的那一步。
 * 适用于：人工审核触发、单步调试、或者精确控制执行节奏的场景。
 */
export class ManualRunner {
  constructor(private executor: Executor) {}

  /**
   * 仅执行当前实例的下一个 PENDING 步骤
   */
  async run(instanceId: string): Promise<ExecutionResult> {
    console.log(`[ManualRunner] 正在手动驱动实例的一步: ${instanceId}`);
    // 直接调用引擎的原子执行能力，不进行任何递归
    return await this.executor.executeNext(instanceId);
  }
}
