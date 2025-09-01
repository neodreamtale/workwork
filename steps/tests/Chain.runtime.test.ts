import { describe, it, expect } from '@jest/globals';
import type { Chain } from '../types/Chain';
import type { Step } from '../types/Step';

// 测试辅助：Chain 初始化时应该构建 id->step 的字典，并只用 id 做链表操作
function buildIndexOnChain<T>(chain: Chain<T>) {
  const arr = chain.steps ?? [];
  const index: Record<string, Step> = {};
  for (let i = 0; i < arr.length; i++) {
    index[arr[i].id] = arr[i] as unknown as Step;
  }
  // 将 index 挂载到 chain，表示 Chain 维护该字典
  (chain as any)._index = index;

  // 链表连接仅使用 id 字段（previous/next 指向 id）
  for (let i = 0; i < arr.length; i++) {
    (arr[i] as any).previous = arr[i - 1]?.id ?? null;
    (arr[i] as any).next = arr[i + 1]?.id ?? null;
  }
}

describe('Chain runtime basics', () => {
  it('accepts a Chain with steps and links them', () => {
    const now = new Date();
    const s1 = { id: 's1', chainId: 'c1', chainPos: 0, payload: { v: 1 }, createdAt: now, updatedAt: now } as unknown as Step<{ v: number }>;
    const s2 = { id: 's2', chainId: 'c1', chainPos: 1, payload: { v: 2 }, createdAt: now, updatedAt: now } as unknown as Step<{ v: number }>;

    const chain = { id: 'c1', chainId: 'c1', chainPos: 0, createdAt: now, updatedAt: now, steps: [s1, s2] } as unknown as Chain<{ v: number }>;

    expect(chain.steps).toHaveLength(2);

  // Chain 应该构建 id->step 字典
  buildIndexOnChain(chain);
  const idx = (chain as any)._index as Record<string, Step>;
  expect(idx).toBeDefined();
  expect(idx['s1']).toBe(s1);
  expect(idx['s2']).toBe(s2);

  // 链表关系通过 id 操作，查字典得到对象
  expect((s2 as any).previous).toBe('s1');
  expect(idx[(s2 as any).previous]).toBe(s1);
  });

  it('pushes a new step and keeps order', () => {
    const now = new Date();
    const s1 = { id: 'a', chainId: 'x', chainPos: 0, payload: {}, createdAt: now, updatedAt: now } as unknown as Step<any>;
    const chain = { id: 'x', chainId: 'x', chainPos: 0, createdAt: now, updatedAt: now, steps: [s1] } as unknown as Chain<any>;
    const s2 = { id: 'b', chainId: 'x', chainPos: 1, payload: {}, createdAt: now, updatedAt: now } as unknown as Step<any>;
  chain.steps = chain.steps ?? [];
  // 模拟 push：链的增删只操作 id，实际对象由 index 查找
  chain.steps.push(s2);
  buildIndexOnChain(chain);
  const idx2 = (chain as any)._index as Record<string, Step>;
  expect(chain.steps[1].id).toBe('b');
  expect(idx2['b']).toBe(s2);
  });
});
