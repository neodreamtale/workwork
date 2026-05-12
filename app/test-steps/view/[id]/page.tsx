"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ReadOnlyWorkflow } from '../../../../steps/src/ui/components/template/ReadOnly';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import { WorkflowChain } from '../../../../steps/src/types/WorkFlow';

export default function ViewPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [viewData, setViewData] = useState<WorkflowChain | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // 改用标准的 API 接口调用，方便调试和外部集成
                const res = await fetch(`/api/workflow/${id}`);
                if (!res.ok) throw new Error('API request failed');
                const data = await res.json();
                setViewData(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors group px-2 py-1"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">返回列表</span>
                </button>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-full">
                    <Info size={12} />
                    <span>预览模式 (API 接口)</span>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-secondary text-sm">正在通过 API 拉取数据...</p>
                </div>
            ) : viewData && (
                <div className="card-surface p-6 md:p-10">
                    <h1 className="text-2xl font-bold text-primary mb-8 ml-1">{viewData.name}</h1>
                    <ReadOnlyWorkflow 
                        chain={viewData} 
                        onUpdateSubChain={(newData) => setViewData(newData)}
                    />
                </div>
            )}
        </div>
    );
}
