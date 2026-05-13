/**
 * 符合 JSON 规范的递归类型，确保数据可序列化存储
 */
export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

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
  subChain?: WorkflowChain | null; // 【新增】允许携带嵌套的子流程对象
  createdAt?: any;
  updatedAt?: any;
};

/**
 * 基础模板链类型
 */
export type WorkflowChain = {
  id: string;
  name: string | null;
  description: string | null;
  isMain?: boolean;
  chainLength?: number;
  steps: WorkflowStep[];
  createdAt?: any;
  updatedAt?: any;
};

/**
 * 实例化的步骤类型 (对应数据库 StepInstance)
 */
export type InstanceStep = {
  id: string;
  stepId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'READY' | 'SKIPPED';
  payload?: JsonValue;
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
  chainPayload: JsonValue;
  parentStepInstanceId: string | null;
  stepInstances?: InstanceStep[];
};
