import { Winch } from '../src/workflow/service/Winch';
import prisma from '../src/lib/db';

/**
 * 集成测试脚本：验证 实例化 -> 自动连跳 -> 递归子流程 -> 数据合并流转
 */
async function main() {
  console.log("=== 🚀 Winch 绞盘引擎集成测试开始 ===");

  // 清理老旧测试数据 (可选)
  await prisma.stepInstance.deleteMany({});
  await prisma.chainInstance.deleteMany({});
  await prisma.step.deleteMany({});
  await prisma.chain.deleteMany({});

  // 1. 创建子流程模板：优惠券核销
  console.log("[Test] 正在创建子流程模板...");
  const couponChain = await prisma.chain.create({
    data: {
      name: "优惠券子流程",
      steps: {
        create: [
          { name: "检查有效期", bizKey: "CHECK_COUPON", sortOrder: 1, isAuto: true },
          { name: "执行扣减", bizKey: "DEDUCT_COUPON", sortOrder: 2, isAuto: true },
        ]
      }
    }
  });

  // 2. 创建主流程模板
  console.log("[Test] 正在创建主流程模板...");
  const mainChain = await prisma.chain.create({
    data: {
      name: "订单主流程",
      steps: {
        create: [
          { name: "用户支付", bizKey: "PAYMENT", sortOrder: 1, isAuto: true },
          { 
            name: "核销环节", 
            bizKey: "COUPON_STEP", 
            sortOrder: 2, 
            isAuto: true, 
            subChainId: couponChain.id // 挂载子流程
          },
          { name: "物流发货", bizKey: "SHIPPING", sortOrder: 3, isAuto: true },
        ]
      }
    }
  });

  // 3. 初始化绞盘并注册本地 Handler
  const winch = new Winch();
  const exec = winch.getExecutor();

  exec.registerHandler("PAYMENT", async (data) => {
    return { payStatus: "PAID", amount: 200 };
  });

  exec.registerHandler("CHECK_COUPON", async (data) => {
    return { couponValid: true, code: "DISCOUNT_80" };
  });

  exec.registerHandler("DEDUCT_COUPON", async (data) => {
    return { discount: 50, finalAmount: data.amount - 50 };
  });

  exec.registerHandler("SHIPPING", async (data) => {
    return { shipStatus: "SHIPPED", trackingNo: "SF_999888" };
  });

  // 4. 启动流程 (AUTO 模式)
  console.log("\n--- 🏁 启动主流程 (AUTO 模式) ---");
  const startTime = Date.now();
  
  const executionResult = await winch.start(mainChain.id, { orderId: "ORD_TEST_001" }, "AUTO");

  const totalTime = Date.now() - startTime;
  console.log(`\n--- ✅ 流程执行完毕，总耗时: ${totalTime}ms ---`);
  
  // 5. 打印最终结果
  const finalInstance = await prisma.chainInstance.findUnique({
    where: { id: executionResult.result?.id || "" }, // 修正：从结果中取 ID
    select: { chainPayload: true, error: true, status: true }
  });

  if (finalInstance) {
    console.log("\n最终全局 Payload (雪球合并后):");
    console.log(JSON.stringify(finalInstance.chainPayload, null, 2));
    console.log("\n状态:", finalInstance.status);
    if (finalInstance.error) {
      console.log("错误记录:", finalInstance.error);
    }
  }
}

main()
  .catch((e) => {
    console.error("测试运行失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
