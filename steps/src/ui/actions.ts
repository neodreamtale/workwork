"use server";

import { Blueprint } from '../workflow/Blueprint';
import Chain from '../types/Chain';
import Step from '../types/Step';
import { WorkflowChain, WorkflowStep } from './types';

/**
 * 内部转换：将带有 .template 嵌套的类实例转换为扁平的 DTO 对象
 */
function toFlattenDTO(chain: any): WorkflowChain {
  const dto = {
    ...chain.template,
    steps: (chain.steps || []).map((s: any) => ({
      ...s.template,
      subChain: s.subChain ? toFlattenDTO(s.subChain) : null
    }))
  };
  return dto as WorkflowChain;
}

/**
 * 内部转换：将扁平的 DTO 对象还原为类实例
 */
function fromFlattenDTO(data: WorkflowChain): Chain {
  // 防御性：如果前端不小心传了数组，取第一个
  const raw = Array.isArray(data) ? data[0] : data;

  const { steps, ...fields } = raw;

  // 转换日期字段，防止序列化字符串导致 Prisma 报错
  const templateFields = {
    ...fields,
    createdAt: fields.createdAt ? new Date(fields.createdAt.toString().replace(/^\$D/, '')) : new Date(),
    updatedAt: fields.updatedAt ? new Date(fields.updatedAt.toString().replace(/^\$D/, '')) : new Date(),
  };

  const chain = new Chain(templateFields);

  chain.steps = (steps || []).map((sd: WorkflowStep) => {
    const { subChain, ...sFields } = sd;

    // 强制同步 chainId，防止用户修改了顶层 ID 后导致子步骤关联失败
    const stepFields = {
      ...sFields,
      chainId: chain.template.id, // 核心：强制跟随父级 ID
      createdAt: sFields.createdAt ? new Date(sFields.createdAt.toString().replace(/^\$D/, '')) : new Date(),
      updatedAt: sFields.updatedAt ? new Date(sFields.updatedAt.toString().replace(/^\$D/, '')) : new Date(),
    };

    const stepInstance = new Step(stepFields);
    if (subChain) {
      stepInstance.subChain = fromFlattenDTO(subChain as WorkflowChain);
    }
    return stepInstance;
  });

  return chain;
}

export async function fetchChainAction(id: string): Promise<WorkflowChain> {
  try {
    const chain = await Blueprint.load(id);
    return toFlattenDTO(chain);
  } catch (e) {
    console.error("查不到对应图纸，走 Mock 逻辑", e);
    const dummyChain = new Chain({ id, name: "🚜 玉米种植全自动流水线" });
    const s1 = new Step({ id: "STEP_1", name: "选种与购买" });
    const s2 = new Step({ id: "STEP_2", name: "松土施底肥" });
    const s3 = new Step({ id: "STEP_3", name: "播种与浇水" });
    const s4 = new Step({ id: "STEP_4", name: "秋季收割" });
    dummyChain.newStep(s1).newStep(s2).newStep(s3).newStep(s4);

    return toFlattenDTO(dummyChain);
  }
}

export async function saveTemplate(data: WorkflowChain) {
  // 1. 还原实体
  const chain = fromFlattenDTO(data);
  // 2. 重新刷新 sortOrder 序号
  chain.buildChain();
  // 3. 落库
  await Blueprint.save(chain);
  return { success: true };
}
