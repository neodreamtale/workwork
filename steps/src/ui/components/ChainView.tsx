"use client";

import React, { useState, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  GripVertical,
  Layers,
  Trash2
} from "lucide-react";
import { WorkflowChain, WorkflowStep } from "../types";

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
  // --- 左滑删除相关状态 ---
  const [isSwiping, setIsSwiping] = useState(false);
  const [offsetX, setOffsetX] = useState(0); // 负数代表向左滑
  const [isOpened, setIsOpened] = useState(false);
  const startX = useRef(0);
  const SWIPE_LIMIT = 80; // 删除按钮的宽度

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = x;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isSwiping) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diff = x - startX.current;

    // 如果已经开启，则在开启基础上累加；如果没开启，则从0开始
    let newOffset = isOpened ? -SWIPE_LIMIT + diff : diff;

    // 限制范围：只能向左滑动，最大滑动距离为 SWIPE_LIMIT
    if (newOffset > 0) newOffset = 0;
    if (newOffset < -SWIPE_LIMIT - 20) newOffset = -SWIPE_LIMIT - 20; // 允许一点回弹感

    setOffsetX(newOffset);
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    // 判断最终停留位置
    if (offsetX < -SWIPE_LIMIT / 2) {
      setOffsetX(-SWIPE_LIMIT);
      setIsOpened(true);
    } else {
      setOffsetX(0);
      setIsOpened(false);
    }
  };

  const toggleSubChain = () => {
    if (!step.subChain) {
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
    }
  };

  return (
    <div className="group">
      {/* 仅针对“卡片”部分的滑动容器 */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* 底层：删除按钮区域 */}
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
          draggable={!isSwiping && !isOpened}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onMouseDown={handleTouchStart}
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
          {/* 拖拽手柄 */}
          <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
            <GripVertical size={18} />
          </div>

          {/* 步骤内容 */}
          <div className="flex-1">
            <input
              type="text"
              value={step.name || ""}
              onChange={(e) =>
                onUpdateStep({
                  ...step,
                  name: e.target.value,
                })
              }
              placeholder="步骤名称..."
              className="w-full bg-transparent border-none focus:ring-0 font-medium text-slate-700 pointer-events-auto"
            />
            <div className="flex items-center gap-4 mt-1">
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase">
                Level {level} · Index {index}
              </span>
              {step.subChain && (
                <span className="text-[10px] text-blue-500 font-bold flex items-center gap-0.5 uppercase">
                  <Layers size={10} /> 包含子流程
                </span>
              )}
            </div>
          </div>

          {/* 子流程开关 */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSubChain();
              }}
              className={`p-2 rounded-lg transition-colors ${step.subChain ? "text-blue-500 bg-blue-50" : "text-slate-400 hover:bg-slate-100"
                }`}
            >
              <Layers size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 递归渲染子链：放在滑动容器外面，保持缩进逻辑不变 */}
      {step.subChain && (
        <ChainView
          chain={step.subChain}
          level={level + 1}
          onUpdate={(newSubChain) =>
            onUpdateStep({ ...step, subChain: newSubChain })
          }
          onDelete={() => onUpdateStep({ ...step, subChain: null })}
        />
      )}
    </div>
  );
}

interface ChainViewProps {
  chain: WorkflowChain;
  level: number;
  onUpdate: (c: WorkflowChain) => void;
  onDelete?: () => void;
}

export function ChainView({ chain, level, onUpdate, onDelete }: ChainViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [isOpened, setIsOpened] = useState(false);
  const startX = useRef(0);
  const SWIPE_LIMIT = 80;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (level === 0) return; // 根流程不支持左滑删除
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = x;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isSwiping) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diff = x - startX.current;
    let newOffset = isOpened ? -SWIPE_LIMIT + diff : diff;
    if (newOffset > 0) newOffset = 0;
    if (newOffset < -SWIPE_LIMIT - 20) newOffset = -SWIPE_LIMIT - 20;
    setOffsetX(newOffset);
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (offsetX < -SWIPE_LIMIT / 2) {
      setOffsetX(-SWIPE_LIMIT);
      setIsOpened(true);
    } else {
      setOffsetX(0);
      setIsOpened(false);
    }
  };

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
      {level > 0 && (
        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
      )}

      {level > 0 && (
        <div className="relative group/chain overflow-hidden rounded-xl mb-2">
          {/* 底层：子流程删除按钮 */}
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

          {/* 顶层：子流程头部 */}
          <div
            onMouseDown={handleTouchStart}
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
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              子流程: {chain.name || "未命名"}
            </span>
          </div>
        </div>
      )}

      {isExpanded && (
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
