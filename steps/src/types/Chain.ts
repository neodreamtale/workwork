import Step from './Step';
import { Chain as ChainTemplate } from '../../generated/client';

/**
 * Chain 模型：工作流图纸（模板）的内存表现形式。
 * 核心逻辑已彻底转为“序号驱动 (SortOrder-Driven)”，即以 this.steps 数组的顺序为准。
 */
export default class Chain<T = any> {
  template: ChainTemplate;
  steps: Step<T>[] = [];
  private idMap: Record<string, Step<T>> = {};

  constructor(template?: Partial<ChainTemplate>) {
    this.template = {
      id: template?.id ?? crypto.randomUUID(),
      name: template?.name ?? null,
      description: template?.description ?? null,
      chainLength: template?.chainLength ?? 0,
      createdAt: template?.createdAt ?? new Date(),
      updatedAt: template?.updatedAt ?? new Date(),
    };
  }

  /**
   * 核心逻辑：将数组状态同步到节点的序号 (sortOrder) 上，并更新索引
   * @param shouldSortByOrder 是否需要先根据序号排序（仅在从数据库初始加载时需要）
   */
  buildChain(shouldSortByOrder = false): Chain<T> {
    // 1. 重建 ID 映射
    this.idMap = {};
    for (const s of this.steps) {
      if (s.template.id) this.idMap[s.template.id] = s;
    }

    // 2. 如果是从数据库加载的，需要先根据 sortOrder 排序
    if (shouldSortByOrder && this.steps.length > 0) {
      this.steps.sort((a, b) => (a.template.sortOrder || 0) - (b.template.sortOrder || 0));
    }

    // 3. 核心：根据数组物理顺序，强行重刷所有节点的 sortOrder 序号
    for (let i = 0; i < this.steps.length; i++) {
      this.steps[i].template.sortOrder = i;
    }

    this.template.chainLength = this.steps.length;
    return this;
  }

  /**
   * 添加新步骤
   * @param step 步骤对象
   * @param index 插入位置，不传则追加到末尾
   */
  newStep(step: Step<T>, index?: number): Chain<T> {
    step.template.chainId = this.template.id;
    if (typeof index === 'number' && index >= 0 && index <= this.steps.length) {
      this.steps.splice(index, 0, step);
    } else {
      this.steps.push(step);
    }
    return this.buildChain();
  }

  getById(id?: string | null): Step<T> | undefined {
    if (!id) return undefined;
    return this.idMap[id];
  }

  removeById(id: string): Chain<T> {
    this.steps = this.steps.filter(s => s.template.id !== id);
    return this.buildChain();
  }

  get index() {
    return this.idMap as Readonly<Record<string, Step<T>>>;
  }

  get head() {
    return this.steps[0];
  }

  get tail() {
    return this.steps[this.steps.length - 1];
  }
}
