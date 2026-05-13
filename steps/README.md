# Winch Workflow Engine (绞盘)

这是一个基于 Prisma 和 TypeScript 构建的高性能工作流执行引擎。

**Winch (绞盘)** 这一命名源于农场机械：它作为动力核心，负责拉动 **Chain (链条)** 上的每一个 **Step (环节)** 稳步向前。

## 核心设计理念

- **序号驱动 (SortOrder-Driven)**：流程节点严格按照数组序号执行。
- **业务主键绑定 (BizKey Binding)**：逻辑注册与数据库 ID 解耦，基于语义化的 `bizKey` 进行绑定。
- **混合执行模式**：支持本地函数注册与远程 HTTP 回调混合运行。
- **递归错误冒泡**：子流程的错误会自动同步到根流程的错误池中。

---

## 快速开始：使用 Winch 驱动流程

程序员唯一需要打交道的类就是 `Winch`。

### 1. 初始化与逻辑注册
```typescript
import { Winch } from './workflow/service/Winch';

const winch = new Winch();

// 基于语义化的 bizKey 注册本地处理器
winch.getExecutor().registerHandler("CALC_TAX", async (input) => {
  return { ...input, tax: input.amount * 0.1 };
});
```

### 2. 启动流程 (start)
一键完成“实例化”和“首次拉动”。
```typescript
// initialData 会作为初始负载进入流程，并随步骤流转合并
await winch.start("TEMPLATE_ID", { amount: 1000 }, "AUTO");
```

### 3. 恢复流程 (resume)
用于处理人工审批后的继续触发，或者单步调试。
```typescript
// MANUAL 模式表示只拉动一步即停止
await winch.resume("INSTANCE_ID", "MANUAL");
```

### 4. 批量维护 (resumeAllActive)
用于系统重启后的任务恢复，或者作为定时任务的兜底。
```typescript
await winch.resumeAllActive("AUTO");
```

---

## 远程回调接口协议 (Webhook Protocol)

### 1. 回调地址发现逻辑 (Fallback Mechanism)

当 Winch 拉动一个步骤时，会按此优先级寻找动力：
1. 本地处理器 -> 2. 步骤级 URL -> 3. 链级 URL -> 4. 根链级 URL。

### 2. 请求格式 (Request Body)
```json
{
  "payload": { ... },
  "context": {
    "bizKey": "CALC_TAX",
    "stepId": "01J7...",
    "instanceId": "01K9...",
    "rootInstanceId": "01M2..."
  }
}
```

### 3. 响应格式 (Response Body)
```json
{
  "status": "success",
  "data": { "result": 100 }
}
```
