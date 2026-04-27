"use client";

import { Building2, Menu, Target } from "lucide-react";

interface Props {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  companyName: string;
}

export function Header({ isSidebarOpen, onOpenSidebar, companyName }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm shrink-0">
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isSidebarOpen && (
            <button
              onClick={onOpenSidebar}
              className="text-gray-500 hover:text-gray-900 mr-2 p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="bg-blue-600 text-white p-1.5 rounded-md shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-gray-900">
              Toptal SDR Launchpad
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Enterprise Account Preparation
            </p>
          </div>
        </div>
        {companyName && (
          <div className="hidden sm:flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">
              {companyName}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
