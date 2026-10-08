'use client';

import { useMemoletStore } from '@/store/useMemoletStore';
import { ChevronRight } from 'lucide-react';

export default function LeftSidebar() {
  const { leftSidebarOpen, setLeftSidebarOpen } = useMemoletStore();

  // We only show the tab strip when overlay is NOT open, or we permanently show it.
  // Actually, since GetMemoryOverlay covers the screen, we can keep the tab static beneath it.

  return (
    <div className="flex h-full items-start pt-3 justify-center w-10 bg-white dark:bg-[#0f172a] border-r border-gray-200 dark:border-slate-800 shadow-sm flex-shrink-0 z-40 relative transition-colors">
      <button
        onClick={() => setLeftSidebarOpen(true)}
        className="flex whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-xs font-semibold tracking-wider text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 items-center p-2 transition-colors gap-2 cursor-pointer"
      >
        <ChevronRight size={13} />
        Get Memory
      </button>
    </div>
  );
}
