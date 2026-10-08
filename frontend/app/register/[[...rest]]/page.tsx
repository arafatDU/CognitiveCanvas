'use client';

import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/Theme/ThemeToggle';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle showLabel={false} />
      </div>

      {/* Subtle Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/10 dark:bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-[400px] h-[400px] bg-cyan-500/10 dark:bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8 group z-10">
        <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-indigo-500/15 group-hover:scale-105 transition-transform flex-shrink-0">
          <Image
            src="/logo.png"
            alt="CognitiveCanvas Logo"
            width={40}
            height={40}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
          CognitiveCanvas
        </span>
      </Link>

      {/* Clerk SignUp Box */}
      <div className="relative z-10 w-full max-w-md">
        <SignUp
          routing="path"
          path="/register"
          signInUrl="/login"
          fallbackRedirectUrl="/workspace"
          appearance={{
            elements: {
              rootBox: 'mx-auto shadow-xl rounded-2xl w-full',
              card: 'bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 shadow-xl rounded-2xl p-6 sm:p-8',
              headerTitle: 'text-slate-900 dark:text-white font-bold text-xl',
              headerSubtitle: 'text-slate-500 dark:text-slate-400 text-sm',
              socialButtonsBlockButton: 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition rounded-xl',
              socialButtonsBlockButtonText: 'text-slate-700 dark:text-white font-medium text-sm',
              dividerLine: 'bg-slate-200 dark:bg-white/10',
              dividerText: 'text-slate-500 text-xs uppercase',
              formFieldLabel: 'text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider',
              formFieldInput: 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm',
              formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-600/20 text-sm py-2.5',
              footerActionLink: 'text-indigo-600 dark:text-indigo-400 hover:underline font-medium',
              footer: 'bg-transparent border-t border-slate-200 dark:border-white/5',
              identityPreviewText: 'text-slate-900 dark:text-white',
              identityPreviewEditButtonIcon: 'text-indigo-600 dark:text-indigo-400',
            },
          }}
        />
      </div>

      <p className="mt-8 text-xs text-slate-500 z-10">
        <Link href="/" className="hover:text-indigo-600 dark:hover:text-slate-300 transition">← Back to home</Link>
      </p>
    </div>
  );
}
