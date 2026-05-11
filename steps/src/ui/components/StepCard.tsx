"use client";

import React from "react";
import { GripVertical } from "lucide-react";

interface StepCardProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  offsetX: number;
  isSwiping: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export function StepCard({
  children,
  actions,
  offsetX,
  isSwiping,
  onDragStart,
  onDragOver,
  onDragEnd,
  ...handlers
}: StepCardProps) {
  return (
    <div
      draggable={true}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      {...handlers}
      style={{
        transform: `translateX(${offsetX}px)`,
        transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}
      className="relative flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-white border border-slate-100 shadow-sm hover:shadow-md group-hover:border-blue-100 cursor-default select-none z-10"
    >
      <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0">
        <GripVertical size={18} />
      </div>

      <div className="flex-1 min-w-0">
        {children}
      </div>

      {actions && (
        <div className="flex items-center gap-1 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
