"use client";

import React, { useState } from "react";
import { GripVertical, Layers, Trash2 } from "lucide-react";
import { WorkflowStep, WorkflowChain } from "../types";
import { ChainView } from "./ChainView";

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
  const toggleSubChain = () => {
    if (!step.subChain) {
      const newSubChain: WorkflowChain = {
        template: {
          id: `CHAIN_${Math.random().toString(36).substr(2, 9)}`,
          name: `${step.template.name} 的子流程`,
          description: null,
          chainLength: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        steps: [],
      };
      onUpdateStep({ ...step, subChain: newSubChain });
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className="group"
    >
      <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-md group-hover:border-blue-100 transition-all">
        {/* 拖拽手柄 */}
        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
          <GripVertical size={18} />
        </div>

        {/* 步骤内容 */}
        <div className="flex-1">
          <input
            type="text"
            value={step.template.name || ""}
            onChange={(e) =>
              onUpdateStep({
                ...step,
                template: { ...step.template, name: e.target.value },
              })
            }
            placeholder="步骤名称..."
            className="w-full bg-transparent border-none focus:ring-0 font-medium text-slate-700"
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

        {/* 操作区 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={toggleSubChain}
            className={`p-2 rounded-lg transition-colors ${
              step.subChain ? "text-blue-500 bg-blue-50" : "text-slate-400 hover:bg-slate-100"
            }`}
          >
            <Layers size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 递归渲染子链 */}
      {step.subChain && (
        <ChainView
          chain={step.subChain}
          level={level + 1}
          onUpdate={(newSubChain) =>
            onUpdateStep({ ...step, subChain: newSubChain })
          }
        />
      )}
    </div>
  );
}
