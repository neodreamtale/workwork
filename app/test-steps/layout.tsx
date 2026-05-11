import React from 'react';

export default function TestStepsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-page p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                {children}
            </div>
        </div>
    );
}
