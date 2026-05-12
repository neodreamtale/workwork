import { Executor } from './Executor';

/**
 * 获取一个已经配置好业务逻辑的执行引擎实例
 * 这里是所有业务 Handler 的注册中心
 */
export function getWorkflowEngine() {
  const engine = new Executor();

  // --- 在这里注册你的所有业务逻辑 ---

  engine.registerHandler('计算', async (input) => {
    const base = input.baseValue || 0;
    const num = base + Math.floor(Math.random() * 100);
    return { result: num, message: `计算成功，结果为 ${num}` };
  });

  engine.registerHandler('延迟', async (input) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { status: 'DONE', waited: '2s' };
  });

  // --------------------------------

  return engine;
}
