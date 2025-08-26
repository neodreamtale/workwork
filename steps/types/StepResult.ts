export interface StepResult<T = any> {
    success: boolean;         // 步骤是否成功
    data?: T;                 // 步骤返回的数据
    error?: string;           // 错误信息（如有）
    message?: string;         // 额外提示信息
    timestamp?: number;       // 结果生成时间戳
}