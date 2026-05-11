"use client";

import { useRouter } from 'next/navigation';
import { TemplateList } from '../../steps/src/ui/components/template/TemplateList';

export default function TestStepsListPage() {
    const router = useRouter();

    const handleEdit = (id: string) => {
        const targetId = id || 'new';
        router.push(`/test-steps/edit/${targetId}`);
    };

    const handleView = (id: string) => {
        router.push(`/test-steps/view/${id}`);
    };

    return (
        <TemplateList 
            onEdit={handleEdit} 
            onView={handleView}
            onInstanceCreated={(id) => console.log('Instance created:', id)}
        />
    );
}
