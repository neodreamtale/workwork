"use client";

import React, { useState, useEffect } from "react";
import { fetchTemplate, saveTemplate } from "../../actions";
import { WorkflowChain } from "../../types";
import { ChainView } from "./ChainView";
import { Layers, Save, Loader2 } from "lucide-react";

interface DesignerProps {
    chainId?: string;
}

export function WorkflowDesigner({ chainId = "" }: DesignerProps) {
    const [rootChain, setRootChain] = useState<WorkflowChain | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchTemplate(chainId).then((data) => {
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
        <div className="max-w-4xl mx-auto p-6 bg-page min-h-screen">
            {/* 顶部工具栏：使用 card-surface 语义类 */}
            <div className="card-surface flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 p-4 md:p-6 sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Layers className="text-blue-500 shrink-0" />
                        <input
                            type="text"
                            value={rootChain.name || ""}
                            onChange={(e) => setRootChain({
                                ...rootChain,
                                name: e.target.value
                            })}
                            className="text-lg md:text-xl font-bold text-primary bg-transparent border-none focus:ring-0 rounded-lg px-1 -ml-1 w-full placeholder:text-slate-300 dark:placeholder:text-slate-700 truncate"
                            placeholder="点击设置模板名称..."
                        />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] md:text-xs text-secondary mt-1">
                        <span className="font-mono bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                            ID: {rootChain.id}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-sm"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        <span>{saving ? "正在保存..." : "保存模板"}</span>
                    </button>
                </div>
            </div>

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
