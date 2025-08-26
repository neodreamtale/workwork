// StepChain.ts
import { Step } from './Step';

export class Chain<T = any> {
  private steps: Step<T>[] = [];
  private chainId?: string | number;

  constructor(chainId?: string | number, steps: Step<T>[] = []) {
    this.chainId = chainId;
    this.steps = steps;
  }

  addStep(step: Step<T>): void {
    step.chainId = this.chainId;
    this.steps.push(step);
  }

  getSteps(): Step<T>[] {
    return this.steps;
  }

  findStepById(id: string): Step<T> | undefined {
    return this.steps.find(s => s.id === id);
  }

  // 你可以根据需要扩展更多链表/树操作方法
}
