"use client";

import { CheckCircle2, ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

interface Props {
  stepNumber: number;
  title: string;
  Icon: LucideIcon;
  isCompleted: boolean;
  isActive: boolean;
  isLocked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function StepCard({
  stepNumber,
  title,
  Icon,
  isCompleted,
  isActive,
  isLocked,
  onToggle,
  children,
}: Props) {
  return (
    <div className="relative pl-16">
      <div
        className={`absolute left-0 top-3 w-12 h-12 rounded-full border-4 border-[#F9FAFB] flex items-center justify-center transition-colors duration-300 ${
          isCompleted
            ? "bg-green-500 text-white"
            : isActive
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "bg-gray-200 text-gray-400"
        }`}
      >
        {isCompleted && !isActive ? (
          <CheckCircle2 className="w-6 h-6" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
      </div>

      <div
        className={`bg-white rounded-xl transition-all duration-300 ${
          isActive
            ? "ring-1 ring-gray-200 shadow-xl shadow-gray-200/50"
            : "border border-gray-200 shadow-sm hover:shadow-md"
        } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div
          className={`px-6 py-5 flex items-center justify-between ${!isLocked ? "cursor-pointer" : ""}`}
          onClick={() => {
            if (!isLocked) onToggle();
          }}
        >
          <div>
            <h2
              className={`font-semibold text-lg ${isActive ? "text-blue-900" : "text-gray-800"}`}
            >
              Step {stepNumber}: {title}
            </h2>
            {isCompleted && !isActive && (
              <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Completed
              </p>
            )}
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
    </div>
  );
}
