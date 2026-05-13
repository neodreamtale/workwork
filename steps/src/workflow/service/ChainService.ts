import prisma from '../../lib/db';

export class ChainService {
  /**
   * 核心方法：将一个 Chain 模板实例化
   */
  async createInstance(chainId: string, initialData: any = {}, parentStepInstanceId?: string) {
    // 1. 获取模板及其所有步骤
    const template = await prisma.chain.findUnique({
      where: { id: chainId },
      include: { steps: { orderBy: { sortOrder: 'asc' } } }
    });

    if (!template) throw new Error(`找不到工作流模板: ${chainId}`);

    // 2. 创建 ChainInstance 记录
    const instance = await prisma.chainInstance.create({
      data: {
        chain: { connect: { id: template.id } },
        status: 'PENDING',
        chainPayload: initialData,
        // 如果有父步骤实例 ID，建立关联
        ...(parentStepInstanceId ? { parentStepInstance: { connect: { id: parentStepInstanceId } } } : {})
      }
    });

    // 3. 为每个步骤创建 StepInstance
    for (const step of template.steps) {
      const sInstance = await prisma.stepInstance.create({
        data: {
          chainInstance: { connect: { id: instance.id } },
          step: { connect: { id: step.id } },
          sortOrder: step.sortOrder,
          status: 'PENDING'
        }
      });

      // 4. 递归处理子流程：将子流程关联到当前步骤实例上
      if (step.subChainId) {
        console.log(`[Factory] 实例化子流程: ${step.subChainId}, 挂载点: ${sInstance.id}`);
        await this.createInstance(step.subChainId, initialData, sInstance.id);
      }
    }

    return instance;
  }
}
