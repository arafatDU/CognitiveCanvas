'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer select-none',
        'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs',
        'dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-200',
        'hover:scale-105 active:scale-95',
        className
      )}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      aria-label="Toggle color theme"
    >
      {theme === 'light' ? (
        <Sun className="w-4 h-4 text-amber-500 transition-transform rotate-0" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-400 transition-transform -rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-medium capitalize hidden sm:inline">
          {theme}
        </span>
      )}
    </button>
  );
}
