import express from 'express';
import cors from 'cors';
import { Winch } from './workflow/service/Winch';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// 1. 初始化 Winch 引擎
const winch = new Winch();
const exec = winch.getExecutor();

// ========================================================================
// 家族谱业务 Handler 注册 (动态匹配 LVL1_STEP1 等)
// ========================================================================
// 注册 1-6 层级的所有可能步骤
for (let lvl = 1; lvl <= 6; lvl++) {
  for (let step = 1; step <= 3; step++) {
    const bizKey = `LVL${lvl}_STEP${step}`;
    exec.registerHandler(bizKey, async (input) => {
      console.log(`\n  层级 ${lvl} 的步骤 ${step} 被调用了`);
      return {
        [`log_${bizKey}`]: `层级 ${lvl} 步骤 ${step} 执行完成`,
        timestamp: new Date().toLocaleTimeString()
      };
    });
  }
}

// ========================================================================
// API 路由
// ========================================================================

// 启动流程
app.get('/api/workflow/start', async (req, res) => {
  try {
    const chainId = (req.query.chainId as string) || "LVL1";
    console.log(`[Server] 启动流程: ${chainId}`);

    const result = await winch.start(chainId, { source: 'standalone-server' }, 'MANUAL');
    res.json({
      success: true,
      message: "流程已启动",
      instanceId: result.instanceId,
      status: result.status
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 步进流程
app.get('/api/workflow/resume', async (req, res) => {
  try {
    const instanceId = req.query.instanceId as string;
    if (!instanceId) {
      return res.status(400).json({ error: "缺少 instanceId" });
    }

    console.log(`[Server] 步进实例: ${instanceId}`);
    const result = await winch.resume(instanceId, 'MANUAL');
    res.json({
      success: true,
      status: result.status,
      result: result.result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 状态查询 (可选)
app.get('/api/workflow/status', (req, res) => {
  res.json({ status: 'running', engine: 'Winch v1.0' });
});

app.listen(port, () => {
  console.log(`🔗 启动接口: http://localhost:${port}/api/workflow/start?chainId=LVL1`);
  console.log(`🔗 步进接口: http://localhost:${port}/api/workflow/resume?instanceId=LVL1`);
  console.log(`\n现在你可以完全脱离主项目，在这里独立调试你的工作流引擎了。\n`);
});
