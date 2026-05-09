import { Chain as ChainTemplate, Step as StepTemplate } from '../../generated/client';

/**
 * 扁平化的步骤类型：直接包含 Template 的所有字段 + 子流程
 */
export type WorkflowStep = StepTemplate & {
  subChain: WorkflowChain | null;
};

/**
 * 扁平化的流程链类型：直接包含 Template 的所有字段 + 步骤数组
 */
export type WorkflowChain = ChainTemplate & {
  steps: WorkflowStep[];
};
