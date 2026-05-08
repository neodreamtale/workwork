import { Chain as ChainTemplate, Step as StepTemplate } from '../../generated/client';

/**
 * 步骤的 DTO 表现形式（前端交互用）
 */
export interface WorkflowStep {
  template: StepTemplate;
  subChain: WorkflowChain | null;
}

/**
 * 流程链的 DTO 表现形式（前端交互用）
 */
export interface WorkflowChain {
  template: ChainTemplate;
  steps: WorkflowStep[];
}
