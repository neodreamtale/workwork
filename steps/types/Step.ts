import { Step as PrismaStep } from '../generated/client';
import { StepResult } from './StepResult';

export interface Step<T = any, R = any> extends Omit<PrismaStep, 'payload'> {
    payload: T;
    result?: StepResult<R>; // 运行时状态，不存数据库
}