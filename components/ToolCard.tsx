"use client";

import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

interface Props {
  title: string;
  Icon: LucideIcon;
  isActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ToolCard({ title, Icon, isActive, onToggle, children }: Props) {
  return (
    <div
      className={`bg-white rounded-xl transition-all duration-300 ${
        isActive
          ? "ring-1 ring-purple-200 shadow-xl shadow-purple-100/50"
          : "border border-gray-200 shadow-sm hover:shadow-md"
      }`}
    >
      <div
        className="px-6 py-5 flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? "bg-purple-100 text-purple-600"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <h2
            className={`font-semibold text-lg ${isActive ? "text-purple-900" : "text-gray-800"}`}
          >
            {title}
          </h2>
        </div>
        <div className="text-gray-400">
          {isActive ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </div>
      </div>

      {isActive && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 animate-in slide-in-from-top-2 fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
