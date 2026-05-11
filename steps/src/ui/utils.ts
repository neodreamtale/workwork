import Chain from '../types/Chain';
import Step from '../types/Step';
import { WorkflowChain, WorkflowStep } from './types';

/**
 * 内部转换：将带有 .template 嵌套的类实例转换为扁平的 DTO 对象
 */
export function toFlattenDTO(chain: any): WorkflowChain {
  const dto = {
    ...chain.template,
    steps: (chain.steps || []).map((s: any) => ({
      ...s.template,
      subChain: s.subChain === undefined ? undefined : (s.subChain ? toFlattenDTO(s.subChain) : null)
    }))
  };
  return dto as WorkflowChain;
}

/**
 * 内部转换：将扁平的 DTO 对象还原为类实例
 */
export function fromFlattenDTO(data: WorkflowChain): Chain {
  const raw = Array.isArray(data) ? data[0] : data;
  const { steps, ...fields } = raw;

  const templateFields = {
    ...fields,
    createdAt: fields.createdAt ? new Date(fields.createdAt.toString().replace(/^\$D/, '')) : new Date(),
    updatedAt: fields.updatedAt ? new Date(fields.updatedAt.toString().replace(/^\$D/, '')) : new Date(),
  };

  const chain = new Chain(templateFields);

  chain.steps = (steps || []).map((sd: WorkflowStep) => {
    const { subChain, ...sFields } = sd;

    const stepFields = {
      ...sFields,
      chainId: chain.template.id,
      createdAt: sFields.createdAt ? new Date(sFields.createdAt.toString().replace(/^\$D/, '')) : new Date(),
      updatedAt: sFields.updatedAt ? new Date(sFields.updatedAt.toString().replace(/^\$D/, '')) : new Date(),
    };

    const stepInstance = new Step(stepFields);
    if (subChain !== undefined) {
      stepInstance.subChain = subChain ? fromFlattenDTO(subChain as WorkflowChain) : null;
    }
    return stepInstance;
  });

  return chain;
}
