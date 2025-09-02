import { Step as PrismaStep } from '../generated/client';
import { StepResult } from './StepResult';

export interface Step<T = any> extends Omit<PrismaStep, 'payload'> {
    payload: T;
    result?: StepResult<T>; // 运行时状态，不存数据库
    includeSteps?: Step<T>[]; // 支持子步骤
    exec(payload: T): StepResult<T>;
}