import prisma from '../src/lib/db';

async function main() {
  console.log("🧬 正在初始化家族谱（适配器兼容版）...");

  // 6. 重孙 (L6)
  await (prisma as any).chain.upsert({
    where: { id: 'LVL6' },
    update: {},
    create: {
      id: 'LVL6',
      name: 'LVL6',
      steps: {
        create: [
          { id: 'LVL6_STEP1', name: '层级6的步骤1', bizKey: 'LVL6_STEP1', sortOrder: 1 }
        ]
      }
    }
  });

  // 5. 孙子 (L5)
  await (prisma as any).chain.upsert({
    where: { id: 'LVL5' },
    update: {},
    create: {
      id: 'LVL5',
      name: 'LVL5',
      steps: {
        create: [
          { id: 'LVL5_STEP1', name: '层级5的步骤1', bizKey: 'LVL5_STEP1', sortOrder: 1 },
          { id: 'LVL5_STEP2', name: '层级5的步骤2包含子流程', sortOrder: 2, subChainId: 'LVL6' }
        ]
      }
    }
  });

  // 4. 儿子 (L4)
  await (prisma as any).chain.upsert({
    where: { id: 'LVL4' },
    update: {},
    create: {
      id: 'LVL4',
      name: 'LVL4',
      steps: {
        create: [
          { id: 'LVL4_STEP1', name: '层级4的步骤1', bizKey: 'LVL4_STEP1', sortOrder: 1 },
          { id: 'LVL4_STEP2', name: '层级4的步骤2', sortOrder: 2, subChainId: 'LVL5' }
        ]
      }
    }
  });

  // 3. 爸爸 (L3)
  await (prisma as any).chain.upsert({
    where: { id: 'LVL3' },
    update: {},
    create: {
      id: 'LVL3',
      name: 'LVL3',
      steps: {
        create: [
          { id: 'LVL3_STEP1', name: '层级3的步骤1', bizKey: 'LVL3_STEP1', sortOrder: 1 },
          { id: 'LVL3_STEP2', name: '层级3的步骤2包含子流程', sortOrder: 2, subChainId: 'LVL4' },
          { id: 'LVL3_STEP3', name: '层级3的步骤3', bizKey: 'LVL3_STEP3', sortOrder: 3 }
        ]
      }
    }
  });

  // 2. 爷爷 (L2)
  await (prisma as any).chain.upsert({
    where: { id: 'LVL2' },
    update: {},
    create: {
      id: 'LVL2',
      name: 'LVL2',
      steps: {
        create: [
          { id: 'LVL2_STEP1', name: '层级2的步骤1', bizKey: 'LVL2_STEP1', sortOrder: 1 },
          { id: 'LVL2_STEP2', name: '层级2的步骤2包含子流程', sortOrder: 2, subChainId: 'LVL3' }
        ]
      }
    }
  });

  // 1. 曾祖 (Main)
  await (prisma as any).chain.upsert({
    where: { id: 'LVL1' },
    update: {},
    create: {
      id: 'LVL1',
      name: '主流程',
      isMain: true,
      steps: {
        create: [
          { id: 'LVL1_STEP1', name: '层级1的步骤1', bizKey: 'LVL1_STEP1', sortOrder: 1 },
          { id: 'LVL1_STEP2', name: '层级1的步骤2包含子流程', sortOrder: 2, subChainId: 'LVL2' },
          { id: 'LVL1_STEP3', name: '层级1的步骤3', bizKey: 'LVL1_STEP3', sortOrder: 3 }
        ]
      }
    }
  });

  console.log("✅ 家族谱 Seed 完成！数据已同步到 steps/prisma/dev.db");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
