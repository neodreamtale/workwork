import { Executor } from './Executor';

/**
 * 这是一个开发环境下使用的 Runner
 * 用于验证执行引擎的逻辑
 */
async function startTestRunner(instanceId: string) {
  const engine = new Executor();

  // 1. 业务注入：注册对应的执行方法
  // 这里可以指定具体的输入输出类型
  interface CalcInput { baseValue?: number };
  interface CalcOutput { result: number, message: string };

  engine.registerHandler<CalcInput, CalcOutput>('计算', async (input) => {
    console.log('--- [执行业务逻辑：计算] ---');
    const base = input.baseValue || 0;
    const num = base + Math.floor(Math.random() * 100);
    return { result: num, message: `计算成功，结果为 ${num}` };
  });

  engine.registerHandler('延迟', async (input) => {
    console.log('--- [执行业务逻辑：延迟等待] ---');
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { status: 'DONE', waited: '2s' };
  });

  // 2. 模拟“按时间触发”或“自动连跑”
  console.log(`开始执行流程实例: ${instanceId}`);
  
  let finished = false;
  while (!finished) {
    const res = await engine.executeNext(instanceId);
    
    if (res.status === 'SUCCESS') {
      console.log('✅ 步骤执行成功:', res.result);
      // 继续循环执行下一步
    } else if (res.status === 'FINISHED') {
      console.log('🎉 整个流程已全部执行完成！');
      finished = true;
    } else {
      console.log('❌ 执行中断/失败:', res.reason);
      finished = true; 
    }

    // 为了看效果，每步之间停 1 秒
    if (!finished) await new Promise(r => setTimeout(r, 1000));
  }
}

// 获取命令行参数并运行 (例如: npx ts-node runner.ts INSTANCE_ID)
const targetId = process.argv[2];
if (targetId) {
  startTestRunner(targetId);
} else {
  console.log('请提供实例 ID: npx ts-node runner.ts <INSTANCE_ID>');
}
