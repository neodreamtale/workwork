"use client";

import React, { useState } from "react";
import { Plus, Layers, Trash2, ListTree } from "lucide-react";
import { WorkflowChain, WorkflowStep } from "../types";
import { useDragScroll } from "../hooks/useDragScroll";
import { useSwipe } from "../hooks/useSwipe";
import { fetchTemplate } from "../actions";
import { AddStep } from "./AddStepButton";
import { DeleteAction } from "./DeleteAction";
import { StepCard } from "./StepCard";
import { SubChainHeader } from "./SubChainHeader";

interface StepItemProps {
  step: WorkflowStep;
  index: number;
  level: number;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onUpdateStep: (s: WorkflowStep) => void;
  onDelete: () => void;
}

export function StepItem({
  step,
  index,
  level,
  onDragStart,
  onDragOver,
  onDragEnd,
  onUpdateStep,
  onDelete,
}: StepItemProps) {
  const {
    isSwiping,
    offsetX,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useSwipe({ limit: 80 });

  const createSubChain = () => {
    if (step.subChainId || step.subChain) return;
    const newSubChain: WorkflowChain = {
      id: `CHAIN_${Math.random().toString(36).substr(2, 9)}`,
      name: `${step.name} 的子流程`,
      description: null,
      chainLength: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [],
    };
    onUpdateStep({ ...step, subChain: newSubChain });
  };

  const actionButtons = (
    <>
      {!step.subChainId && !step.subChain ? (
        <button
          onClick={(e) => { e.stopPropagation(); createSubChain(); }}
          title="添加子流程"
          className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
        >
          <ListTree size={16} />
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("确定要移除与子流程的关联吗？")) {
              onUpdateStep({ ...step, subChain: null, subChainId: null });
            }
          }}
          title="移除子流程关联"
          className="p-2 rounded-lg text-red-300 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      )}
    </>
  );

  return (
    <div className="group">
      <div className="relative overflow-hidden rounded-2xl">
        <DeleteAction offsetX={offsetX} onDelete={onDelete} />
        
        <StepCard
          offsetX={offsetX}
          isSwiping={isSwiping}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest(".cursor-grab") || (e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;
            handleTouchStart(e as any);
          }}
          onMouseMove={handleTouchMove as any}
          onMouseUp={handleTouchEnd as any}
          onMouseLeave={handleTouchEnd as any}
          onTouchStart={handleTouchStart as any}
          onTouchMove={handleTouchMove as any}
          onTouchEnd={handleTouchEnd as any}
          actions={actionButtons}
        >
          <input
            type="text"
            value={step.name || ""}
            onChange={(e) => onUpdateStep({ ...step, name: e.target.value })}
            placeholder="步骤名称..."
            className="w-full bg-transparent border-none focus:ring-0 font-medium text-slate-700 pointer-events-auto text-sm md:text-base p-0 truncate"
          />
          <div className="flex items-center gap-4 mt-1 overflow-hidden">
            {(step.subChainId || step.subChain) && (
              <span className="text-[10px] text-blue-500/60 font-bold flex items-center gap-0.5 uppercase shrink-0 whitespace-nowrap">
                <Layers size={10} /> 包含子流程
              </span>
            )}
          </div>
        </StepCard>
      </div>

      {(step.subChain || step.subChainId) && (
        <ChainView
          chain={step.subChain}
          subChainId={step.subChainId}
          level={level + 1}
          onUpdate={(newSubChain) => onUpdateStep({ ...step, subChain: newSubChain })}
          onDelete={() => onUpdateStep({ ...step, subChain: null, subChainId: null })}
        />
      )}
    </div>
  );
}

interface ChainViewProps {
  chain?: WorkflowChain | null;
  subChainId?: string | null;
  level: number;
  onUpdate: (c: WorkflowChain) => void;
  onDelete?: () => void;
}

export function ChainView({ chain, subChainId, level, onUpdate, onDelete }: ChainViewProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const [isLoading, setIsLoading] = useState(false);

  const {
    offsetX,
    isSwiping,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useSwipe({ limit: 80 });

  const {
    handleDragStart,
    handleDragOver,
    handleDragEnd
  } = useDragScroll({
    items: chain?.steps || [],
    onReorder: (newSteps) => chain && onUpdate({ ...chain, steps: newSteps })
  });

  const handleToggle = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    if (!chain && subChainId && !isLoading) {
      setIsLoading(true);
      try {
        const data = await fetchTemplate(subChainId);
        onUpdate(data);
      } catch (e) {
        console.error("Lazy load failed", e);
      } finally {
        setIsLoading(false);
      }
    }
    setIsExpanded(true);
  };

  const addStep = () => {
    if (!chain) return;
    const newStep: WorkflowStep = {
      id: `STEP_${Math.random().toString(36).substr(2, 9)}`,
      name: "新步骤",
      chainId: chain.id,
      sortOrder: chain.steps.length,
      subChainId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      subChain: null,
    };
    onUpdate({ ...chain, steps: [...chain.steps, newStep] });
  };

  return (
    <div className={`relative ${level > 0 ? "ml-8 mt-2" : ""}`}>
      {level > 0 && <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>}

      {level > 0 && (
        <SubChainHeader
          name={chain?.name || (subChainId ? "待加载..." : "未命名")}
          isExpanded={isExpanded}
          isLoading={isLoading}
          onToggle={handleToggle}
          onDelete={() => onDelete?.()}
          offsetX={offsetX}
          isSwiping={isSwiping}
          onMouseDown={(e) => handleTouchStart(e as any)}
          onMouseMove={handleTouchMove as any}
          onMouseUp={handleTouchEnd as any}
          onMouseLeave={handleTouchEnd as any}
          onTouchStart={handleTouchStart as any}
          onTouchMove={handleTouchMove as any}
          onTouchEnd={handleTouchEnd as any}
        />
      )}

      {isExpanded && chain && (
        <div className="space-y-3">
          {chain.steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              level={level}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onUpdateStep={(updatedStep) => {
                const newSteps = [...chain.steps];
                newSteps[index] = updatedStep;
                onUpdate({ ...chain, steps: newSteps });
              }}
              onDelete={() => {
                const newSteps = chain.steps.filter((_, i) => i !== index);
                onUpdate({ ...chain, steps: newSteps });
              }}
            />
          ))}
          <AddStep onClick={addStep} />
        </div>
      )}
    </div>
  );
}
