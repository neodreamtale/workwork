"use client";

import React from "react";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";

interface SubChainHeaderProps {
  name: string;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onDelete: () => void;
  offsetX: number;
  isSwiping: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export function SubChainHeader({
  name,
  isExpanded,
  isLoading,
  onToggle,
  onDelete,
  offsetX,
  isSwiping,
  ...handlers
}: SubChainHeaderProps) {
  return (
    <div className="relative group/chain overflow-hidden rounded-xl mb-2">
      {/* 背景层 */}
      <div
        className="absolute inset-0 bg-red-500 flex items-center justify-end px-6 text-white transition-opacity"
        style={{ opacity: offsetX < -10 ? 1 : 0 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("确定要删除整个子流程吗？")) onDelete();
          }}
          className="flex items-center gap-1 font-bold text-[10px]"
        >
          <Trash2 size={16} /> DEL
        </button>
      </div>

      {/* 内容层 */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        className="relative bg-slate-50 dark:bg-slate-900 flex items-center gap-2 p-1 z-10 cursor-default select-none border border-transparent dark:border-slate-800/50 transition-colors"
      >
        <button 
          onClick={onToggle} 
          disabled={isLoading}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-500 dark:text-slate-400"
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-blue-500" />
          ) : (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </button>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
          子流程: {name}
        </span>
      </div>
    </div>
  );
}
