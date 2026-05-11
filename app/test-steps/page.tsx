"use client";

import { useState } from 'react';
import { WorkflowDesigner } from '../../steps/src/ui/components/template/Designer';
import { TemplateList } from '../../steps/src/ui/components/template/TemplateList';
import { ArrowLeft } from 'lucide-react';

export default function TestStepsPage() {
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [editingId, setEditingId] = useState<string>('');

    const handleEdit = (id: string) => {
        setEditingId(id);
        setView('edit');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors">
            <div className="max-w-5xl mx-auto">
                {view === 'list' ? (
                    <TemplateList
                        onEdit={handleEdit}
                        onInstanceCreated={(id) => console.log('Instance created:', id)}
                    />
                ) : (
                    <div className="space-y-4">
                        <button
                            onClick={() => setView('list')}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group px-2 py-1"
                        >
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-sm font-medium">返回模板列表</span>
                        </button>
                        <WorkflowDesigner chainId={editingId} />
                    </div>
                )}
            </div>
        </div>
    );
}
