"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, Circle, Clock } from "lucide-react";
import { WorkflowChain, WorkflowStep } from "../../../types/WorkFlow";
import { fetchTemplate } from "../../actions";

interface ReadOnlyProps {
    chain: WorkflowChain | null;
    subChainId?: string | null;
    level?: number;
    isLast?: boolean;
    onUpdateSubChain?: (newChain: WorkflowChain) => void;
}

/**
 * 手机优先的紧凑型“豆豆树”查看器
 * 【自动加载版】：会自动递归拉取所有子流程并展开
 */
export function ReadOnlyWorkflow({
    chain,
    subChainId,
    level = 0,
    isLast = false,
    onUpdateSubChain
}: ReadOnlyProps) {
    if (!chain && !subChainId) return null;
    return (
        <div className={`relative ${level > 0 ? "ml-5" : ""}`}>
            {/* 垂直主轴线 */}
            {!isLast && (
                <div
                    className="absolute left-[7px] top-[24px] bottom-[-8px] w-[2px] bg-slate-100 dark:bg-slate-800 opacity-50"
                />
            )}

            <div className="space-y-3">
                {chain?.steps.map((step, index) => (
                    <ReadOnlyStep
                        key={step.id}
                        step={step}
                        isLast={index === chain.steps.length - 1 && level === 0}
                        level={level}
                        onUpdateStep={(updatedStep) => {
                            if (!chain) return;
                            const newSteps = [...chain.steps];
                            newSteps[index] = updatedStep;
                            onUpdateSubChain?.({ ...chain, steps: newSteps });
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function ReadOnlyStep({
    step,
    isLast,
    level,
    onUpdateStep
}: {
    step: WorkflowStep;
    isLast: boolean;
    level: number;
    onUpdateStep: (s: WorkflowStep) => void;
}) {
    // 默认展开，实现全自动显示
    const [isExpanded, setIsExpanded] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const hasSubChain = !!(step.subChain || step.subChainId);

    // 关键：自动加载逻辑
    useEffect(() => {
        const autoLoad = async () => {
            if (!step.subChain && step.subChainId && !isLoading) {
                setIsLoading(true);
                try {
                    const data = await fetchTemplate(step.subChainId);
                    // 延迟一丢丢，让动画更顺滑（可选）
                    onUpdateStep({ ...step, subChain: data as WorkflowChain });
                } catch (e) {
                    console.error("Auto load sub-chain failed", e);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        autoLoad();
    }, [step.subChainId, step.subChain]); // 监听 ID 和数据状态

    const toggle = () => setIsExpanded(!isExpanded);

    // 模拟状态颜色
    const status = "completed";

    return (
        <div className="relative">
            <div className="flex items-start gap-3">
                {/* 豆豆节点：通过 h-5 items-center 确保与标题中轴线对齐 */}
                <div className="relative z-10 shrink-0 h-5 flex items-center">
                    {status === "completed" ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 shadow-sm flex items-center justify-center">
                            <div className="w-1 h-1 bg-white rounded-full" />
                        </div>
                    ) : (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-primary truncate">
                            {step.name}
                        </h4>
                        {hasSubChain && (
                            <button
                                onClick={toggle}
                                className="p-1 text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                                {isLoading ? (
                                    <Loader2 size={12} className="animate-spin text-blue-500" />
                                ) : (
                                    isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                                )}
                            </button>
                        )}
                    </div>

                    {/* 递归渲染子流程 */}
                    {isExpanded && (step.subChain || isLoading) && (
                        <div className="mt-4 pb-2">
                            {isLoading ? (
                                <div className="ml-5 flex items-center gap-2 text-[10px] text-slate-400">
                                    <Loader2 size={10} className="animate-spin" />
                                    正在加载子流程...
                                </div>
                            ) : step.subChain && (
                                <ReadOnlyWorkflow
                                    chain={step.subChain}
                                    level={level + 1}
                                    isLast={isLast}
                                    onUpdateSubChain={(newSub) => onUpdateStep({ ...step, subChain: newSub })}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
