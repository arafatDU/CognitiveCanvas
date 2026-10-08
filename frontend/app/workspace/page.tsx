'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { useAuthStore } from '@/store/useAuthStore';
import { UserButton, useUser } from '@clerk/nextjs';
import LeftSidebar from '@/components/Sidebar/LeftSidebar';
import ChatOverlay from '@/components/Workspace/ChatOverlay';
import GetMemoryOverlay from '@/components/Workspace/GetMemoryOverlay';
import ImportChatModal from '@/components/Workspace/ImportChatModal';
import SandboxCanvas from '@/components/Canvas/SandboxCanvas';
import DocViewer from '@/components/Sidebar/DocViewer';
import AuthGuard from '@/components/auth/AuthGuard';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { memoriesApi, parseMemoletText } from '@/lib/api';
import { ThemeToggle } from '@/components/Theme/ThemeToggle';

function WorkspaceInner() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { setNodes, nodes, setMemoriesNeedsSync, resetStore, setImportModalOpen, setActiveConversationId } = useMemoletStore();
  const selectedNodeId = useMemoletStore((s) => s.selectedNodeId);
  const prevUserIdRef = useRef<string | null>(null);
  const { user, logout } = useAuthStore();
  const [loadingCanvas, setLoadingCanvas] = useState(false);

  const handleLogout = () => {
    useMemoletStore.getState().setCurrentUserId(null);
    logout();
    resetStore();
    router.replace('/');
  };

  /** Convert a MemoletDTO (with displayId) from the API into a ReactFlow node */
  const memoletToNode = (m: {
    id: string;
    text: string;
    keywords: string[];
    color?: string;
    weight?: number;
    displayId?: string;
    is_time_sensitive?: boolean;
    deprecation_risk?: string;
    temporal_anchor?: string;
    validity_horizon_days?: number;
    is_deprecated?: boolean;
    deprecation_reason?: string;
    suggested_update?: string;
  }) => {
    const parsed = parseMemoletText(m.text);
    return {
      id: m.id,
      type: 'memolet' as const,
      position: { 
        x: Math.floor((Math.random() * 600 + 80) / 160) * 160, 
        y: Math.floor((Math.random() * 400 + 80) / 160) * 160 
      },
      data: {
        text: m.text,
        keywords: m.keywords ?? [],
        color: m.color ?? '#e0f2fe',
        weight: m.weight ?? 1,
        summary: parsed.summary,
        displayId: m.displayId,        // e.g. "1_0", "1_1", "2_0"
        isTimeSensitive: m.is_time_sensitive,
        deprecationRisk: m.deprecation_risk,
        temporalAnchor: m.temporal_anchor,
        validityHorizonDays: m.validity_horizon_days,
        isDeprecated: m.is_deprecated,
        deprecationReason: m.deprecation_reason,
        suggestedUpdate: m.suggested_update,
      },
      style: { width: 160, height: 160 },
    };
  };

  const loadCanvasFromDB = async () => {
    setLoadingCanvas(true);
    try {
      // 1. Seed demo data if DB is empty (idempotent)
      await memoriesApi.seedDemo().catch(() => {
        // Ignore seed errors — DB may already have data
      });

      // The Sandbox Canvas acts as a curated "instant memory" space.
      // Persisted user state is restored via loadUserCanvasState.
    } catch (err) {
      console.error('Failed to init DB:', err);
    } finally {
      setLoadingCanvas(false);
    }
  };

  useEffect(() => {
    const currentUserId = clerkUser?.id || user?.id || user?.username || 'local_user';
    if (prevUserIdRef.current && prevUserIdRef.current !== currentUserId) {
      // User switched — clear canvas and caches
      resetStore();
    }
    prevUserIdRef.current = currentUserId;

    // Restore this user's persisted canvas working state (nodes, edges, positions, weights)
    useMemoletStore.getState().loadUserCanvasState(currentUserId);
    loadCanvasFromDB();
  }, [clerkUser?.id, user?.id, user?.username]);

  return (
    <main className="flex h-screen w-full bg-[#f1f5f9] dark:bg-[#090d16] overflow-hidden text-gray-900 dark:text-slate-100 antialiased relative transition-colors duration-200">
      <LeftSidebar />

      <div className="flex-1 flex flex-col relative h-full min-w-0">
        {/* Toolbar */}
        <div className="h-12 bg-white dark:bg-[#0f172a] flex items-center justify-between px-6 border-b border-gray-200 dark:border-slate-800 shadow-sm z-10 flex-shrink-0 w-full transition-colors">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 select-none group" title="CognitiveCanvas Home">
              <div className="relative w-6 h-6 rounded-md overflow-hidden flex-shrink-0 shadow-xs">
                <Image
                  src="/logo.png"
                  alt="CognitiveCanvas Logo"
                  width={24}
                  height={24}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <span className="text-sm font-black text-gray-800 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                CognitiveCanvas
              </span>
            </Link>

            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 transition shadow-2xs cursor-pointer"
              title="Import conversation turns from ChatGPT, Gemini, or Claude"
            >
              <Download size={13} />
              <span>Import Chat</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-slate-300">
            <ThemeToggle />
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: 'w-7 h-7 border border-gray-200 dark:border-slate-700 shadow-sm',
                },
              }}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex w-full overflow-hidden relative">
          {/* Canvas */}
          <div className="flex-1 h-full w-full relative">
            {loadingCanvas && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-[#090d16]/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={28} className="animate-spin text-blue-400" />
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Loading memories…</p>
                </div>
              </div>
            )}
            <ReactFlowProvider>
              <SandboxCanvas />
            </ReactFlowProvider>
          </div>

          {/* Document Viewer (always rendered, slides out/in based on state or displays empty state) */}
          <DocViewer />
        </div>
      </div>

      <GetMemoryOverlay />
      <ChatOverlay />
      <ImportChatModal onConversationImported={(id) => setActiveConversationId(id)} />
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <AuthGuard>
      <WorkspaceInner />
    </AuthGuard>
  );
}
