import prisma from '../../lib/db';
import { Executor } from '../engine/Executor';
import { AutoRunner } from '../runner/AutoRunner';
import { ManualRunner } from '../runner/ManualRunner';
import { InstanceChain, WorkflowStep } from '../../types/WorkFlow';

export type RunMode = 'AUTO' | 'MANUAL';

// 解决 TS 实例化过深的问题：将数据库实例内部视为 any
const db = prisma as any;

/**
 * Winch (绞盘)：工作流引擎的调度中心与门面
 * 负责拉动工作流链条 (Chain) 的转动。
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

  /**
   * 暴露 Executor 实例，方便外部注册本地 Handler
   */
  getExecutor() {
    return this.executor;
  }

  /**
   * 绞盘转动：实例化并启动一个流程
   */
  async start(chainId: string, initialData: any = {}, mode: RunMode = 'AUTO') {
    console.log(`[Winch] 正在启动链条 ${chainId}, 模式: ${mode}`);
    const instance = await this.createInstance(chainId, initialData);
    return this.resume(instance.id, mode);
  }

  /**
   * 绞盘恢复：继续拉动一个现有的流程实例
   */
  async resume(instanceId: string, mode: RunMode = 'AUTO') {
    if (mode === 'AUTO') {
      return this.autoRunner.run(instanceId);
    } else {
      return this.manualRunner.run(instanceId);
    }
  }

  /**
   * 绞盘清扫：批量恢复所有处于活跃状态的任务
   */
  async resumeAllActive(mode: RunMode = 'AUTO') {
    const activeInstances: any[] = await db.chainInstance.findMany({
      where: { 
        status: { in: ['PENDING', 'RUNNING'] } 
      },
      select: { id: true }
    });

    console.log(`[Winch] 绞盘正在尝试拉动 ${activeInstances.length} 条活跃链条...`);
    
    for (const instance of activeInstances) {
      try {
        await this.resume(instance.id, mode);
      } catch (err) {
        console.error(`[Winch] 驱动链条 ${instance.id} 失败:`, err);
      }
    }
  }

  /**
   * 将一个 Chain 模板实例化 (内部逻辑)
   */
  private async createInstance(chainId: string, initialData: any = {}, parentStepInstanceId?: string): Promise<InstanceChain> {
    // 拆分查询以防止类型深度报错，并手动指定返回类型
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
