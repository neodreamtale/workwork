import prisma from '../src/lib/db';
import { Winch } from '../src/workflow/service/Winch';

async function main() {
  console.log("=== 🚀 Winch 绞盘引擎集成测试开始 ===");

  // 0. 清理数据库，防止唯一约束冲突
  console.log("[Test] 正在清理旧数据...");
  await prisma.stepInstance.deleteMany();
  await prisma.chainInstance.deleteMany();
  await prisma.step.deleteMany();
  await prisma.chain.deleteMany();

  // 1. 创建子流程模板
  const subChain = await prisma.chain.create({
    data: {
      name: "优惠券子流程",
      steps: {
        create: [
          { name: "检查优惠券", bizKey: "CHECK_COUPON", sortOrder: 1, isAuto: true },
          { name: "扣减金额", bizKey: "DEDUCT_COUPON", sortOrder: 2, isAuto: true },
        ]
      }
    }
  });

  // 2. 创建主流程模板
  const mainChain = await prisma.chain.create({
    data: {
      name: "订单主流程",
      isMain: true,
      steps: {
        create: [
          { name: "支付节点", bizKey: "PAYMENT", sortOrder: 1, isAuto: true },
          { name: "营销插件", sortOrder: 2, isAuto: true, subChainId: subChain.id },
          { name: "物流节点", bizKey: "SHIPPING", sortOrder: 3, isAuto: true },
        ]
      }
    }
  });

  // 3. 注册 Handler
  const winch = new Winch();
  const exec = winch.getExecutor();

  exec.registerHandler("PAYMENT", async () => {
    console.log("  [Handler] -> 1");
    return { payStatus: "PAID", amount: 200 };
  });
  exec.registerHandler("CHECK_COUPON", async () => {
    console.log("  [Handler] -> 2.1");
    return { couponValid: true, code: "DISCOUNT_80" };
  });
  exec.registerHandler("DEDUCT_COUPON", async (data) => {
    console.log("  [Handler] -> 2.2");
    const amount = data.amount as number;
    return { discount: 50, finalAmount: amount - 50 };
  });
  exec.registerHandler("SHIPPING", async () => {
    console.log("  [Handler] -> 3");
    return { shipStatus: "SHIPPED", trackingNo: "SF_999888" };
  });

  // 4. 启动流程
  console.log("\n--- 🏁 启动主流程 (AUTO 模式) ---");
  const startTime = Date.now();
  
  const runRes = await winch.start(mainChain.id, { orderId: "ORD_TEST_001" }, "AUTO");

  const totalTime = Date.now() - startTime;
  console.log(`\n--- ✅ 流程执行完毕，总耗时: ${totalTime}ms ---`);

  // 5. 验证结果
  const finalInstance = await prisma.chainInstance.findUnique({
    where: { id: runRes.instanceId }
  });

  console.log("\n最终全局 Payload (雪球合并后):");
  console.log(JSON.stringify(finalInstance?.chainPayload, null, 2));
  console.log(`\n状态: ${finalInstance?.status}`);

  process.exit(0);
}

main().catch(err => {
  console.error("测试运行失败:", err);
  process.exit(1);
});
