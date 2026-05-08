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
        dummyChain.newStep(s1, null).newStep(s2, "STEP_1").newStep(s3, "STEP_2").newStep(s4, "STEP_3");
        
        return JSON.parse(JSON.stringify(dummyChain));
    }
}

export async function saveChainAction(data: any) {
    // 1. 根据传入的 plain object 重建内存实体
    const chain = new Chain({ 
        id: data.template.id, 
        name: data.template.name, 
        description: data.template.description 
    });
    
    // 2. 根据前端排好的数组顺序，重构链表指针
    const stepsData = data.steps || [];
    let prevId = null;
    for (let i = 0; i < stepsData.length; i++) {
        const sd = stepsData[i];
        const step = new Step({ 
            id: sd.template.id, 
            name: sd.template.name, 
            subChainId: sd.template.subChainId 
        });
        
        step.template.previousId = prevId;
        if (i < stepsData.length - 1) {
            step.template.nextId = stepsData[i+1].template.id;
        } else {
            step.template.nextId = null; // 尾节点
        }
        
        chain.steps.push(step);
        prevId = step.template.id;
    }
    chain.buildChain();
    
    // 3. 落库
    await Blueprint.save(chain);
    return { success: true };
}
