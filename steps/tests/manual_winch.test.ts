import prisma from '../src/lib/db';
import { Winch } from '../src/workflow/service/Winch';

async function main() {
  console.log("=== 🕹️ Winch 绞盘引擎手动模式集成测试 ===");

  // 0. 清理旧数据
  await prisma.stepInstance.deleteMany();
  await prisma.chainInstance.deleteMany();
  await prisma.step.deleteMany();
  await prisma.chain.deleteMany();

  // 1. 创建简单模板
  const chain = await prisma.chain.create({
    data: {
      name: "单步调试流程",
      isMain: true,
      steps: {
        create: [
          { name: "支付", bizKey: "PAYMENT", sortOrder: 1, isAuto: true },
          { name: "发货", bizKey: "SHIPPING", sortOrder: 2, isAuto: true },
        ]
      }
    }
  });

  // 2. 注册 Handler
  const winch = new Winch();
  const exec = winch.getExecutor();
  exec.registerHandler("PAYMENT", async () => {
    console.log("  [Handler] 执行支付成功");
    return { payStatus: "OK" };
  });
  exec.registerHandler("SHIPPING", async () => {
    console.log("  [Handler] 执行发货成功");
    return { shipStatus: "SHIPPED" };
  });

  // 3. 启动并驱动
  console.log("\n--- 🚀 1. 启动 (MANUAL 模式) ---");
  const startRes = await winch.start(chain.id, { orderId: "M_001" }, "MANUAL");
  const instanceId = startRes.instanceId;
  console.log(`   >> 当前结果状态: ${startRes.status}`);

  console.log("\n--- 🚀 2. 再次驱动 (Resume) ---");
  let runRes = await winch.resume(instanceId, "MANUAL");
  console.log(`   >> 当前结果状态: ${runRes.status}`);

  console.log("\n--- 🚀 3. 最后一次驱动 (完成流程) ---");
  runRes = await winch.resume(instanceId, "MANUAL");
  console.log(`   >> 当前结果状态: ${runRes.status}`);

  // 4. 验证
  const final = await prisma.chainInstance.findUnique({ where: { id: instanceId } });
  console.log(`\n最终数据库记录状态: ${final?.status}`);
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
