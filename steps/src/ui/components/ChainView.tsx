"use client";

import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  GripVertical,
  Layers,
  Trash2,
  Loader2,
  ListTree
} from "lucide-react";
import { WorkflowChain, WorkflowStep } from "../types";
import { useDragScroll } from "../hooks/useDragScroll";
import { useSwipe } from "../hooks/useSwipe";
import { fetchTemplate } from "../actions";

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
  // --- 使用抽离的 Swipe 逻辑 ---
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

  return (
    <div className="group">
      <div className="relative overflow-hidden rounded-2xl">
        {/* 底层：删除按钮 */}
        <div
          className="absolute inset-0 bg-red-500 flex items-center justify-end px-6 text-white transition-opacity duration-200"
          style={{ opacity: offsetX < -10 ? 1 : 0 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("确定要删除此步骤吗？")) onDelete();
            }}
            className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          >
            <Trash2 size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Delete</span>
          </button>
        </div>

        {/* 顶层：内容卡片 */}
        <div
          draggable={true}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest(".cursor-grab") || (e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;
            handleTouchStart(e);
          }}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateX(${offsetX}px)`,
            transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
          className="relative flex items-center gap-3 p-4 bg-white border border-slate-100 shadow-sm hover:shadow-md group-hover:border-blue-100 cursor-default select-none z-10"
        >
          <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
            <GripVertical size={18} />
          </div>

          <div className="flex-1">
            <input
              type="text"
              value={step.name || ""}
              onChange={(e) => onUpdateStep({ ...step, name: e.target.value })}
              placeholder="步骤名称..."
              className="w-full bg-transparent border-none focus:ring-0 font-medium text-slate-700 pointer-events-auto"
            />
            <div className="flex items-center gap-4 mt-1">
              {(step.subChainId || step.subChain) && (
                <span className="text-[10px] text-blue-500/60 font-bold flex items-center gap-0.5 uppercase">
                  <Layers size={10} /> 包含子流程
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!step.subChainId && !step.subChain ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  createSubChain();
                }}
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
          </div>
        </div>
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

    // 懒加载逻辑：由子流程组件内部控制
    if (!chain && subChainId && !isLoading) {
      setIsLoading(true);
      try {
        const data = await fetchTemplate(subChainId);
        onUpdate(data);
      } catch (e) {
        console.error("加载子流程失败", e);
        alert("加载子流程失败");
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
        <div className="relative group/chain overflow-hidden rounded-xl mb-2">
          <div
            className="absolute inset-0 bg-red-500 flex items-center justify-end px-6 text-white transition-opacity"
            style={{ opacity: offsetX < -10 ? 1 : 0 }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("确定要删除整个子流程吗？")) onDelete?.();
              }}
              className="flex items-center gap-1 font-bold text-[10px]"
            >
              <Trash2 size={16} /> DEL
            </button>
          </div>

          <div
            onMouseDown={(e) => level > 0 && handleTouchStart(e)}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              transform: `translateX(${offsetX}px)`,
              transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
            className="relative bg-slate-50 flex items-center gap-2 p-1 z-10 cursor-default select-none"
          >
            <button
              onClick={handleToggle}
              disabled={isLoading}
              className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500"
            >
              {isLoading ? (
                <Loader2 size={14} className="animate-spin text-blue-500" />
              ) : (
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              )}
            </button>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              子流程: {chain?.name || (subChainId ? "待加载..." : "未命名")}
            </span>
          </div>
        </div>
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
