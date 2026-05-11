"use client";

import React, { useEffect, useState } from "react";
import { getTemplateList, createInstance } from "../../actions";
import { Layers, Plus, Edit3, Loader2, CheckCircle2, ChevronLeft, ChevronRight, Eye } from "lucide-react";

interface TemplateListProps {
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onInstanceCreated?: (instanceId: string) => void;
}

export function TemplateList({ onEdit, onView, onInstanceCreated }: TemplateListProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  
  const pageSize = 6;

  useEffect(() => {
    loadTemplates();
  }, [page]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { items, total } = await getTemplateList(page, pageSize);
      setTemplates(items);
      setTotal(total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async (id: string) => {
    setBusyId(id);
    try {
      const res = await createInstance(id);
      if (res.success) {
        alert(`实例创建成功！ID: ${res.instanceId}`);
        onInstanceCreated?.(res.instanceId);
      }
    } catch (e) {
      alert("创建失败");
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading && templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-secondary text-sm">正在获取模板列表...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary flex items-center gap-2">
          <Layers className="text-blue-500" />
          工作流模板
        </h2>
        <button 
          onClick={() => onEdit("")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          <Plus size={16} />
          新建模板
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="card-surface p-12 text-center border-2 border-dashed">
          <p className="text-secondary">暂无模板，点击右上方按钮开始创建</p>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {templates.map((t) => (
              <div 
                key={t.id}
                className="card-surface p-5 group flex flex-col hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-[0.98]"
              >
                {/* 可点击的主体区域 */}
                <div 
                  className="cursor-pointer flex-1 mb-4"
                  onClick={() => onView(t.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {t.name || "未命名模板"}
                      </h3>
                      <p className="text-[10px] font-mono text-secondary mt-1 uppercase tracking-wider">
                        ID: {t.id.slice(-8)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(t.id);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="编辑模板"
                    >
                      <Edit3 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-secondary mt-4">
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                      更新于: {new Date(t.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleCreateInstance(t.id)}
                  disabled={!!busyId}
                  className="w-full py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-slate-100 dark:border-slate-800 hover:border-emerald-100 dark:hover:border-emerald-900/50 active:scale-95 disabled:opacity-50"
                >
                  {busyId === t.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {busyId === t.id ? "正在创建..." : "基于此模板新建实例"}
                </button>
              </div>
            ))}
          </div>

          {/* 分页控制 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600 transition-all disabled:opacity-30"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="text-sm font-medium text-secondary">
                第 <span className="text-primary">{page}</span> 页 / 共 {totalPages} 页
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600 transition-all disabled:opacity-30"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
