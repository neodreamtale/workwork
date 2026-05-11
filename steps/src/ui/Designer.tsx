"use client";

import React, { useState, useEffect } from "react";
import { fetchTemplate, saveTemplate } from "./actions";
import { WorkflowChain } from "./types";
import { ChainView } from "./components/ChainView";
import { Layers, Save, Loader2 } from "lucide-react";

interface DesignerProps {
    chainId?: string;
}

/**
 * 核心：工作流设计器主入口
 * 负责数据加载、根状态管理以及全局操作按钮
 */
export function WorkflowDesigner({ chainId = "" }: DesignerProps) {
    const [rootChain, setRootChain] = useState<WorkflowChain | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // 初始化加载
        fetchTemplate("9cfce9cb-39bd-4e32-9c1c-9f25fa4a66e5").then((data) => {
            setRootChain(data as WorkflowChain);
        });
    }, [chainId]);

    const handleSave = async () => {
        if (!rootChain) return;
        setSaving(true);
        try {
            await saveTemplate(rootChain);
            alert("保存成功！");
        } catch (e) {
            console.error(e);
            alert("保存失败");
        } finally {
            setSaving(false);
        }
    };

    if (!rootChain) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 bg-slate-50 min-h-screen">
            {/* 顶部全局工具栏 */}
            <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 sticky top-0 z-50 backdrop-blur-md bg-white/80">
                <div>
                    <div className="flex items-center gap-2">
                        <Layers className="text-blue-500" />
                        <input
                            type="text"
                            value={rootChain.name || ""}
                            onChange={(e) => setRootChain({
                                ...rootChain,
                                name: e.target.value
                            })}
                            className="text-xl font-bold text-slate-800 bg-transparent border-none focus:ring-2 focus:ring-blue-100 rounded-lg px-1 -ml-1 w-full placeholder:text-slate-300"
                            placeholder="点击设置模板名称..."
                        />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <span className="font-mono text-slate-500">{rootChain.id}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-200 active:scale-95"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saving ? "正在保存..." : "保存模板"}
                    </button>
                </div>
            </div>

            {/* 画布区域：递归渲染开始 */}
            <div className="space-y-4">
                <ChainView
                    chain={rootChain}
                    level={0}
                    onUpdate={(newChain) => setRootChain({ ...newChain })}
                />
            </div>
        </div>
    );
}
