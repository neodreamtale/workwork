# Steps Workflow Engine

这是一个基于 Prisma 和 TypeScript 构建的高性能工作流执行引擎，专为复杂的业务流程编排而设计。

## 核心设计理念

- **序号驱动 (SortOrder-Driven)**：流程节点严格按照数组序号执行。
- **业务主键绑定 (BizKey Binding)**：逻辑注册与数据库 ID 解耦，基于语义化的 `bizKey` 进行绑定。
- **混合执行模式**：支持本地函数注册与远程 HTTP 回调混合运行。
- **递归错误冒泡**：子流程的错误会自动同步到根流程的错误池中。

---

## 业务主键 (BizKey)

为了方便开发人员维护，引擎不要求你记住数据库的随机 ID。你可以在定义 `Step` 模板时，为其指定一个 `bizKey`（例如 `USER_AUTH` 或 `SHIP_GOODS`）。

- **本地注册**：使用 `executor.registerHandler("BIZ_KEY", ...)`。
- **远程路由**：远程接口接收到的 `context` 中会包含这个 `bizKey`，方便你做后端路由。

---

## 远程回调接口协议 (Webhook Protocol)

### 1. 回调地址发现逻辑 (Fallback Mechanism)

当引擎执行一个步骤时，会按照以下优先级寻找处理器：

1.  **本地处理器**：通过 `executor.registerHandler(bizKey, handler)` 注册的函数。
2.  **步骤级 URL**：该 `Step` 节点上配置的 `handlerUrl`。
3.  **当前流程 URL**：该 `ChainInstance` 上配置的 `handlerUrl`。
4.  **根流程 URL**：递归向上寻找最顶层工作流实例配置的 `handlerUrl`。

### 2. 请求格式 (Request Body)

```json
{
  "payload": { ... },
  "context": {
    "bizKey": "CALC_TAX",       // 业务主键
    "stepId": "01J7...",       // 步骤模板 ID (物理 ID)
    "stepName": "计算税率",      // 步骤名称
    "instanceId": "01K9...",    // 当前实例 ID
    "rootInstanceId": "01M2..."  // 根实例 ID
  }
}
```

### 3. 响应格式 (Response Body)

```json
{
  "status": "success",
  "data": {
    "result": 100
  }
}
```

---

## 快速开始

### 注册处理器
```typescript
const executor = new Executor();
// 基于语义化的 bizKey 注册，无需关心数据库 ID
executor.registerHandler("CALC_TAX", async (input) => {
  const tax = input.amount * 0.1;
  return { ...input, tax };
});
```

### 触发执行
```typescript
await executor.executeNext("CHAIN_INSTANCE_ID");
```
