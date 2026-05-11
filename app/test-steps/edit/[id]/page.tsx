"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { WorkflowDesigner } from '../../../../steps/src/ui/components/template/Designer';
import { ArrowLeft } from 'lucide-react';

export default function EditPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    return (
        <div className="space-y-4">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors group px-2 py-1"
            >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium">返回模板列表</span>
            </button>
            <WorkflowDesigner chainId={id === 'new' ? '' : id} />
        </div>
    );
}
