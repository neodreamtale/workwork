"use client";

import React from "react";
import { Trash2 } from "lucide-react";

interface DeleteActionProps {
  onDelete: () => void;
  offsetX: number;
  label?: string;
}

export function DeleteAction({ onDelete, offsetX, label = "Delete" }: DeleteActionProps) {
  return (
    <div
      className="absolute inset-0 bg-red-500 flex items-center justify-end px-6 text-white transition-opacity duration-200"
      style={{ opacity: offsetX < -10 ? 1 : 0 }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
      >
        <Trash2 size={20} />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </button>
    </div>
  );
}
