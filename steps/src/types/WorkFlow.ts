/**
 * 基础模板步骤类型
 */
export type WorkflowStep = {
  id: string;
  bizKey: string | null;
  name: string | null;
  sortOrder: number;
  isAuto: boolean;
  handlerUrl: string | null;
  subChainId: string | null;
};

/**
 * 基础模板链类型
 */
export type WorkflowChain = {
  id: string;
  name: string | null;
  description: string | null;
  steps: WorkflowStep[];
};

/**
 * 实例化的步骤类型 (对应数据库 StepInstance)
 */
export type InstanceStep = {
  id: string;
  stepId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'READY' | 'SKIPPED';
  payload?: any;
  sortOrder: number;
  step: {
    id: string;
    bizKey: string | null;
    name: string | null;
    handlerUrl: string | null;
    isAuto: boolean;
  };
};

/**
 * 实例化的流程链类型 (对应数据库 ChainInstance)
 */
export type InstanceChain = {
  id: string;
  templateId: string;
  status: string;
  handlerUrl: string | null;
  chainPayload: any;
  parentStepInstanceId: string | null;
  stepInstances?: InstanceStep[];
};
