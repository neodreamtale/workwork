import { WorkflowDesigner } from '../../steps/src/ui/Designer';

export default function TestStepsPage() {
    return (
        <div className="min-h-screen bg-slate-950 p-4">
            <WorkflowDesigner chainId="CHAIN_TEST_001" />
        </div>
    );
}
