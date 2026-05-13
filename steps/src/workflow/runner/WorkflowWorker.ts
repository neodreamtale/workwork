import prisma from '../../lib/db';
import { Executor } from '../engine/Executor';
import { AutoRunner } from './AutoRunner';

/**
 * 后台轮询器：负责“轮询兜底”
 * 定期扫描数据库，将因异常中断或延迟产生的 PENDING 任务捡起来执行。
 */
export class WorkflowWorker {
  private timer: NodeJS.Timeout | null = null;
  private autoRunner: AutoRunner;

  constructor(
    private executor: Executor,
    private intervalMs: number = 30000 // 默认 30 秒扫描一次
  ) {
    this.autoRunner = new AutoRunner(executor);
  }

  /**
   * 启动扫描器
   */
  start() {
    if (this.timer) return;
    console.log(`[Worker] 工作流轮询器已启动，扫描频率: ${this.intervalMs}ms`);

    this.timer = setInterval(async () => {
      try {
        // 扫描所有活跃且未完成的实例
        const activeInstances = await prisma.chainInstance.findMany({
          where: {
            status: { in: ['PENDING', 'RUNNING'] }
          },
          select: { id: true }
        });

        for (const instance of activeInstances) {
          // 使用 AutoRunner 尝试驱动这些实例
          // 这样可以确保即便是因为系统故障中断的任务也能恢复自动执行
          await this.autoRunner.run(instance.id);
        }
      } catch (error) {
        console.error('[Worker] 轮询执行出错:', error);
      }
    }, this.intervalMs);
  }

  /**
   * 停止扫描器
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
