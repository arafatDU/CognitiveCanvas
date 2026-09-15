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
import { memoriesApi, parseMemoletText } from '@/lib/api';

function WorkspaceInner() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { setNodes, nodes, setMemoriesNeedsSync, resetStore, setImportModalOpen, setActiveConversationId } = useMemoletStore();
  const selectedNodeId = useMemoletStore((s) => s.selectedNodeId);
  const prevUserIdRef = useRef<string | null>(null);
  const { user, logout } = useAuthStore();
  const [loadingCanvas, setLoadingCanvas] = useState(false);

  const handleLogout = () => {
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

      // We intentionally do NOT load all memories onto the canvas here.
      // The Sandbox Canvas acts as a curated "instant memory" space,
      // and users will manually pull in nodes from the "Get Memory" tab.
    } catch (err) {
      console.error('Failed to init DB:', err);
    } finally {
      setLoadingCanvas(false);
    }
  };

  useEffect(() => {
    const currentUserId = clerkUser?.id ?? 'local';
    if (prevUserIdRef.current && prevUserIdRef.current !== currentUserId) {
      // User switched — clear canvas and caches
      resetStore();
    }
    prevUserIdRef.current = currentUserId;
    loadCanvasFromDB();
  }, [clerkUser?.id]);

  return (
    <main className="flex h-screen w-full bg-[#f1f5f9] overflow-hidden text-gray-900 antialiased relative">
      <LeftSidebar />

      <div className="flex-1 flex flex-col relative h-full min-w-0">
        {/* Toolbar */}
        <div className="h-12 bg-white flex items-center justify-between px-6 border-b border-gray-200 shadow-sm z-10 flex-shrink-0 w-full">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-800 tracking-tight select-none flex items-center gap-1.5">
              🧠 Memolet
            </span>

            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition shadow-2xs cursor-pointer"
              title="Import conversation turns from ChatGPT, Gemini, or Claude"
            >
              <Download size={13} />
              <span>Import Chat</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: 'w-7 h-7 border border-gray-200 shadow-sm',
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
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={28} className="animate-spin text-blue-400" />
                  <p className="text-sm text-gray-500 font-medium">Loading memories…</p>
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
