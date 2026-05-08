"use server";

import { Blueprint } from '../workflow/Blueprint';
import Chain from '../types/Chain';
import Step from '../types/Step';

export async function fetchChainAction(id: string) {
    try {
        const chain = await Blueprint.load(id);
        // Next.js Server Actions 只能返回可以序列化为 JSON 的纯对象
        return JSON.parse(JSON.stringify(chain));
    } catch (e) {
        console.error("查不到对应图纸，走 Mock 逻辑", e);
        // Mock
        const dummyChain = new Chain({ id, name: "🚜 玉米种植全自动流水线" });
        const s1 = new Step({ id: "STEP_1", name: "选种与购买" });
        const s2 = new Step({ id: "STEP_2", name: "松土施底肥" });
        const s3 = new Step({ id: "STEP_3", name: "播种与浇水" });
        const s4 = new Step({ id: "STEP_4", name: "秋季收割" });
        dummyChain.newStep(s1).newStep(s2).newStep(s3).newStep(s4);

        return JSON.parse(JSON.stringify(dummyChain));
    }
}

export async function saveChainAction(data: any) {
    // 1. 根据前端传回的 DTO 重新构造内存中的 Chain 实体
    const chain = new Chain(data.template);
    // 2. 将步骤 DTO 转换为 Step 实体
    const stepsData = data.steps || [];
    chain.steps = stepsData.map((sd: any) => new Step(sd.template));
    // 3. 核心：利用我们重写后的 buildChain() 直接同步数组顺序到 sortOrder
    chain.buildChain();
    // 4. 直接持久化
    await Blueprint.save(chain);
    return { success: true };
}
