"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchChainAction, saveChainAction } from "./actions";

interface DesignerProps {
    chainId?: string;
}

export function WorkflowDesigner({ chainId = "CHAIN_TEST_001" }: DesignerProps) {
    const [chain, setChain] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    // React Native HTML5 Drag state
    const dragItemIndex = useRef<number | null>(null);
    const dragOverItemIndex = useRef<number | null>(null);

    useEffect(() => {
        // 组件加载时获取数据
        fetchChainAction(chainId).then(data => setChain(data));
    }, [chainId]);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        dragItemIndex.current = index;
        e.dataTransfer.effectAllowed = 'move';
        // 让拖拽的原元素变半透明
        setTimeout(() => {
            if (e.target instanceof HTMLElement) {
                e.target.style.opacity = '0.4';
            }
        }, 0);
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        dragOverItemIndex.current = index;
    };

    const handleDragEnd = (e: React.DragEvent) => {
        if (e.target instanceof HTMLElement) {
            e.target.style.opacity = '1';
        }

        // 执行位置交换
        if (
            dragItemIndex.current !== null &&
            dragOverItemIndex.current !== null &&
            dragItemIndex.current !== dragOverItemIndex.current
        ) {
            const newSteps = [...chain.steps];
            const draggedItem = newSteps[dragItemIndex.current];

            // 删除原位置的元素
            newSteps.splice(dragItemIndex.current, 1);
            // 插入到新位置
            newSteps.splice(dragOverItemIndex.current, 0, draggedItem);

            setChain({ ...chain, steps: newSteps });
        }

        dragItemIndex.current = null;
        dragOverItemIndex.current = null;
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // 必须阻止默认行为才能触发 Drop
    };

    const onSave = async () => {
        if (!chain) return;
        setSaving(true);
        try {
            await saveChainAction(chain);
            alert("✅ 图纸保存成功！链表指针已重构！");
        } catch (e: any) {
            alert("保存失败: " + e.message);
        }
        setSaving(false);
    };

    if (!chain) {
        return (
            <div className="w-full h-full min-h-[400px] bg-slate-900 text-slate-100 flex flex-col justify-center items-center rounded-2xl">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-400 font-medium tracking-wider">加载图纸中...</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-slate-900 text-slate-100 p-8 rounded-2xl shadow-2xl border border-slate-700/50">
            {/* 标题栏 */}
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent pb-1">
                    {chain.template.name || '未命名流程'}
                </h1>
                <p className="text-slate-400 text-sm mt-2 font-mono tracking-wide">ID: {chain.template.id}</p>
            </div>

            {/* 节点列表 */}
            <div className="flex flex-col gap-4 mb-10">
                {chain.steps.map((step: any, index: number) => (
                    <div
                        key={step.template.id}
                        className="group flex items-center justify-between bg-slate-700/30 border border-slate-600/50 hover:border-blue-500/50 p-5 rounded-xl transition-all cursor-move shadow-sm hover:shadow-md hover:bg-slate-700/50"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                    >
                        <div className="flex flex-col">
                            <span className="text-slate-200 font-semibold text-lg flex items-center gap-3">
                                <span className="flex items-center justify-center bg-slate-800 text-blue-400 text-sm w-7 h-7 rounded-full border border-slate-600">
                                    {index + 1}
                                </span>
                                {step.template.name || '未命名步骤'}
                            </span>
                            <span className="text-slate-500 text-xs font-mono mt-2 pl-10">{step.template.id}</span>
                        </div>
                        <div className="text-slate-600 group-hover:text-blue-400 p-2 flex items-center justify-center transition-colors active:cursor-grabbing">
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                        </div>
                    </div>
                ))}
            </div>

            {/* 保存按钮 */}
            <button
                onClick={onSave}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-[0.98]"
            >
                {saving ? (
                    <span>💾 保存中...</span>
                ) : (
                    <>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        保存并同步图纸
                    </>
                )}
            </button>
        </div>
    );
}
