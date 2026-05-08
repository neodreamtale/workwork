"use client";

import React, { useState, useRef } from "react";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";
import { WorkflowChain, WorkflowStep } from "../types";
import { StepItem } from "./StepItem";

interface ChainViewProps {
  chain: WorkflowChain;
  level: number;
  onUpdate: (c: WorkflowChain) => void;
}

export function ChainView({ chain, level, onUpdate }: ChainViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // 拖拽排序逻辑
  const dragItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItemIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItemIndex.current = index;
  };

  const handleDragEnd = () => {
    if (
      dragItemIndex.current !== null &&
      dragOverItemIndex.current !== null &&
      dragItemIndex.current !== dragOverItemIndex.current
    ) {
      const newSteps = [...chain.steps];
      const [draggedItem] = newSteps.splice(dragItemIndex.current, 1);
      newSteps.splice(dragOverItemIndex.current, 0, draggedItem);
      onUpdate({ ...chain, steps: newSteps });
    }
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  const addStep = () => {
    const newStep: WorkflowStep = {
      template: {
        id: `STEP_${Math.random().toString(36).substr(2, 9)}`,
        name: "新步骤",
        chainId: chain.template.id,
        sortOrder: chain.steps.length,
        subChainId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      subChain: null,
    };
    onUpdate({ ...chain, steps: [...chain.steps, newStep] });
  };

  return (
    <div className={`relative ${level > 0 ? "ml-8 mt-2" : ""}`}>
      {/* 装饰连线 */}
      {level > 0 && (
        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
      )}

      {/* 子流程头部标题 */}
      {level > 0 && (
        <div className="flex items-center gap-2 mb-2 group">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            子流程: {chain.template.name || "未命名"}
          </span>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-3">
          {chain.steps.map((step, index) => (
            <StepItem
              key={step.template.id}
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

          {/* 添加按钮 */}
          <button
            onClick={addStep}
            className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 transition-all group"
          >
            <Plus size={16} className="group-hover:scale-125 transition-transform" />
            <span className="text-sm font-medium">在该层级添加步骤</span>
          </button>
        </div>
      )}
    </div>
  );
}
