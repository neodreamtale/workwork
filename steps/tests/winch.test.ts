import prisma from '../src/lib/db';
import { Winch } from '../src/workflow/service/Winch';

async function main() {
  console.log("=== 🚀 Winch 绞盘引擎集成测试开始 ===");

  // 1. 创建子流程模板 (优惠券核销)
  console.log("[Test] 正在创建子流程模板...");
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

  // 2. 创建主流程模板 (订单处理)
  console.log("[Test] 正在创建主流程模板...");
  const mainChain = await prisma.chain.create({
    data: {
      name: "订单主流程",
      isMain: true,
      steps: {
        create: [
          { name: "支付节点", bizKey: "PAYMENT", sortOrder: 1, isAuto: true },
          { 
            name: "营销插件", 
            sortOrder: 2, 
            isAuto: true,
            subChainId: subChain.id // 挂载子流程
          },
          { name: "物流节点", bizKey: "SHIPPING", sortOrder: 3, isAuto: true },
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
    const amount = data.amount as number;
    return { discount: 50, finalAmount: amount - 50 };
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

  // 5. 验证结果 (雪球合并后的 Payload)
  // 【修复】：将 result 断言为 any 以便访问 id 属性
  const resultData = executionResult.result as any;
  const finalInstance = await prisma.chainInstance.findUnique({
    where: { id: resultData?.id || "" }
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
