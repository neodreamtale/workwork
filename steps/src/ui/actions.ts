"use server";

import { Blueprint } from '../workflow/Blueprint';
import Chain from '../types/Chain';
import { WorkflowChain } from './types';
import { toFlattenDTO, fromFlattenDTO } from './utils';

export async function fetchTemplate(id: string): Promise<WorkflowChain> {
  try {
    const chain = await Blueprint.load(id);
    return toFlattenDTO(chain);
  } catch (e) {
    console.error("查不到对应图纸，走 Mock 逻辑", e);
    const dummyChain = new Chain({ id: id || undefined, name: "新工作流模板", isMain: true });
    return toFlattenDTO(dummyChain);
  }
}

export async function saveTemplate(data: WorkflowChain) {
  const chain = fromFlattenDTO(data);
  chain.buildChain();
  await Blueprint.save(chain);
  return { success: true };
}

export async function getTemplateList(page = 1, pageSize = 10) {
  return await Blueprint.findMainTemplates(page, pageSize);
}

export async function createInstance(templateId: string) {
  const instance = await Blueprint.instantiate(templateId);
  return { success: true, instanceId: instance.id };
}

export async function fetchTemplateDeep(id: string): Promise<WorkflowChain> {
  const chain = await Blueprint.loadDeep(id);
  return toFlattenDTO(chain);
}
