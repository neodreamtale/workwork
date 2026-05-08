/**
 * 工作流生命周期状态 (ChainInstance)
 */
export enum ChainStatus {
  PENDING = 'PENDING',       // 未开始/待触发
  RUNNING = 'RUNNING',       // 进行中
  PAUSED = 'PAUSED',         // 已暂停/挂起
  COMPLETED = 'COMPLETED',   // 已完成/成功
  FAILED = 'FAILED',         // 已失败
  CANCELLED = 'CANCELLED'    // 已取消/被驳回
}

/**
 * 节点生命周期状态 (StepInstance)
 */
export enum StepStatus {
  PENDING = 'PENDING',       // 未开始
  RUNNING = 'RUNNING',       // 处理中
  COMPLETED = 'COMPLETED',   // 已完成
  FAILED = 'FAILED',         // 失败/异常
  SKIPPED = 'SKIPPED'        // 已跳过
}
