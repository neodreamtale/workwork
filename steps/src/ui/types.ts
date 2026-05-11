import { Chain as ChainTemplate, Step as StepTemplate } from '../../generated/client';

/**
 * 扁平化的步骤类型：直接包含 Template 的所有字段 + 子流程
 */
export type WorkflowStep = StepTemplate & {
  /** 
   * 子流程数据：
   * - undefined: 尚未加载 (Lazy Load)
   * - null: 没有关联子流程
   * - WorkflowChain: 已加载的数据
   */
  subChain?: WorkflowChain | null;
};

/**
 * 扁平化的流程链类型：直接包含 Template 的所有字段 + 步骤数组
 */
export type WorkflowChain = ChainTemplate & {
  steps: WorkflowStep[];
};
