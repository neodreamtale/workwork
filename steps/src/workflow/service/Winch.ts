import prisma from '../../lib/db';
import { Executor, ExecutionResult } from '../engine/Executor';
import { AutoRunner } from '../runner/AutoRunner';
import { ManualRunner } from '../runner/ManualRunner';
import { InstanceChain, WorkflowStep, JsonValue } from '../../types/WorkFlow';

export type RunMode = 'AUTO' | 'MANUAL';

// 解决 TS 实例化过深的问题：将数据库实例内部视为 any
const db = prisma as any;

/**
 * Winch (绞盘)：工作流引擎的调度中心与门面
 */
export class Winch {
  private executor: Executor;
  private autoRunner: AutoRunner;
  private manualRunner: ManualRunner;

  constructor() {
    this.executor = new Executor();
    this.autoRunner = new AutoRunner(this.executor);
    this.manualRunner = new ManualRunner(this.executor);
  }

  getExecutor() {
    return this.executor;
  }

  /**
   * 启动流程：返回执行结果 + 实例信息
   */
  async start(chainId: string, initialData: JsonValue = {}, mode: RunMode = 'AUTO') {
    console.log(`[Winch] 正在启动链条 ${chainId}, 模式: ${mode}`);
    const instance = await this.createInstance(chainId, initialData);
    const executionResult = await this.resume(instance.id, mode);
    
    // 返回一个包含实例信息的复合对象
    return {
      ...executionResult,
      instanceId: instance.id,
      instance
    };
  }

  async resume(instanceId: string, mode: RunMode = 'AUTO'): Promise<ExecutionResult> {
    if (mode === 'AUTO') {
      return this.autoRunner.run(instanceId);
    } else {
      return this.manualRunner.run(instanceId);
    }
  }

  async resumeAllActive(mode: RunMode = 'AUTO') {
    const activeInstances: any[] = await db.chainInstance.findMany({
      where: { status: { in: ['PENDING', 'RUNNING'] } },
      select: { id: true }
    });
    
    for (const instance of activeInstances) {
      try {
        await this.resume(instance.id, mode);
      } catch (err) {
        console.error(`[Winch] 驱动链条 ${instance.id} 失败:`, err);
      }
    }
  }

  private async createInstance(chainId: string, initialData: JsonValue = {}, parentStepInstanceId?: string): Promise<InstanceChain> {
    const template: any = await db.chain.findUnique({
      where: { id: chainId },
      select: { id: true }
    });
    if (!template) throw new Error(`找不到工作流模板: ${chainId}`);

    const steps: WorkflowStep[] = await db.step.findMany({
      where: { chainId },
      orderBy: { sortOrder: 'asc' }
    });

    const instanceData = await db.chainInstance.create({
      data: {
        chain: { connect: { id: template.id } },
        status: 'PENDING',
        chainPayload: initialData,
        ...(parentStepInstanceId ? { parentStepInstance: { connect: { id: parentStepInstanceId } } } : {})
      }
    });
    
    const instance = instanceData as InstanceChain;

    for (const step of steps) {
      const sInstanceData = await db.stepInstance.create({
        data: {
          chainInstance: { connect: { id: instance.id } },
          step: { connect: { id: step.id } },
          sortOrder: step.sortOrder,
          status: 'PENDING'
        }
      });
      if (step.subChainId) {
        await this.createInstance(step.subChainId, initialData, sInstanceData.id);
      }
    }
    return instance;
  }
}
