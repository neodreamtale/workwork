"use client";

import React from "react";
import { Plus } from "lucide-react";

interface AddStepProps {
  onClick: () => void;
  label?: string;
}

export function AddStep({ onClick, label = "在该层级添加步骤" }: AddStepProps) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 transition-all group"
    >
      <Plus size={16} className="group-hover:scale-125 transition-transform" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
