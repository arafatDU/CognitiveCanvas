'use client';

import { useState } from 'react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { importApi, TurnPairDTO, getNextDisplayId, parseMemoletText } from '@/lib/api';
import { 
  X, 
  Link as LinkIcon, 
  Clipboard, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  MessageSquare, 
  Database, 
  ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImportChatModal({
  onConversationImported,
}: {
  onConversationImported?: (conversationId: string) => void;
}) {
  const { 
    importModalOpen, 
    setImportModalOpen, 
    setRightSidebarOpen, 
    setMemoriesNeedsSync,
    nodes,
    setNodes,
  } = useMemoletStore();

  const [activeTab, setActiveTab] = useState<'link' | 'paste'>('link');
  const [urlInput, setUrlInput] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [previewTitle, setPreviewTitle] = useState('');
  const [parsedTurns, setParsedTurns] = useState<TurnPairDTO[]>([]);
  const [selectedTurnIndices, setSelectedTurnIndices] = useState<Set<number>>(new Set());

  // Destination options
  const [createConversation, setCreateConversation] = useState(true);
  const [saveToMemory, setSaveToMemory] = useState(true);
  const [generateAiSummary, setGenerateAiSummary] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  if (!importModalOpen) return null;

  const resetForm = () => {
    setParsedTurns([]);
    setSelectedTurnIndices(new Set());
    setError(null);
    setImportSuccess(null);
  };

  const handleClose = () => {
    setImportModalOpen(false);
    resetForm();
  };

  const handleFetchPreview = async () => {
    setError(null);
    setImportSuccess(null);
    setLoading(true);

    try {
      const payload = activeTab === 'link' 
        ? { url: urlInput.trim() } 
        : { text: pasteInput.trim() };

      if (activeTab === 'link' && !urlInput.trim()) {
        throw new Error('Please enter a public share link.');
      }
      if (activeTab === 'paste' && !pasteInput.trim()) {
        throw new Error('Please paste your conversation text.');
      }

      const res = await importApi.preview(payload);
      if (!res.turns || res.turns.length === 0) {
        throw new Error('No conversation turns were found in the provided input.');
      }

      setPreviewTitle(res.title || 'Imported Chat');
      setParsedTurns(res.turns);
      // Select all turns by default
      setSelectedTurnIndices(new Set(res.turns.map((_, i) => i)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse conversation.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTurnSelection = (index: number) => {
    setSelectedTurnIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCommitImport = async () => {
    const turnsToImport = parsedTurns.filter((_, i) => selectedTurnIndices.has(i));
    if (turnsToImport.length === 0) {
      setError('Please select at least one turn to import.');
      return;
    }

    setCommitting(true);
    setError(null);

    try {
      const res = await importApi.commit({
        title: previewTitle.trim() || 'Imported Chat',
        turns: turnsToImport,
        create_conversation: createConversation,
        save_to_memory: saveToMemory,
        generate_ai_summary: generateAiSummary,
      });

      setImportSuccess(`Successfully imported ${res.total_turns} conversation turn(s)!`);
      setMemoriesNeedsSync(true);

      // If user selected to save to memory (either alone or with continue chat), add to canvas with dynamic displayId
      if (saveToMemory && res.saved_memolets && res.saved_memolets.length > 0) {
        let currentNodes = [...nodes];
        const baseOffset = currentNodes.length;

        res.saved_memolets.forEach((memolet, index) => {
          if (currentNodes.some((n) => n.id === memolet.id)) return;

          // Dynamically compute the next display ID based on current nodes on canvas (e.g., 3 existing nodes -> "1_3")
          const displayId = getNextDisplayId(currentNodes);
          const parsed = parseMemoletText(memolet.text || '');
          const summaryText = memolet.summary || parsed.summary || (memolet.text ? memolet.text.slice(0, 120) : 'Imported conversation memory');

          // Position cleanly on the canvas
          const col = (baseOffset + index) % 4;
          const row = Math.floor((baseOffset + index) / 4);
          const posX = 120 + col * 200;
          const posY = 100 + row * 190;

          const newNode = {
            id: memolet.id,
            type: 'memolet' as const,
            position: {
              x: posX,
              y: posY,
            },
            data: {
              text: memolet.text || '',
              keywords: memolet.keywords || [],
              color: memolet.color || '#e0f2fe',
              weight: 1,
              summary: summaryText,
              displayId: displayId,
              isTimeSensitive: memolet.is_time_sensitive,
              deprecationRisk: memolet.deprecation_risk,
              temporalAnchor: memolet.temporal_anchor,
              validityHorizonDays: memolet.validity_horizon_days,
              isDeprecated: memolet.is_deprecated,
              deprecationReason: memolet.deprecation_reason,
              suggestedUpdate: memolet.suggested_update,
            },
            style: { width: 160, height: 160 },
          };

          currentNodes.push(newNode as any);
        });

        if (currentNodes.length > nodes.length) {
          setNodes(currentNodes);
        }
      }

      // If user selected to create a chat thread, trigger continuation
      if (createConversation && res.conversation_id) {
        if (onConversationImported) {
          onConversationImported(res.conversation_id);
        }
        setRightSidebarOpen(true);
      }

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to commit conversation import.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">Import External Conversation</h2>
              <p className="text-xs text-gray-500">
                Import from ChatGPT, Gemini, or Claude to continue where you left off or save to memory.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {importSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-600" />
              <span className="font-semibold">{importSuccess}</span>
            </div>
          )}

          {/* If turns NOT yet previewed, show input tabs */}
          {parsedTurns.length === 0 ? (
            <div className="space-y-4">
              {/* Tab Switcher */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setActiveTab('link'); setError(null); }}
                  className={cn(
                    "flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition",
                    activeTab === 'link' ? "bg-white text-blue-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <LinkIcon size={14} />
                  Public Share Link
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('paste'); setError(null); }}
                  className={cn(
                    "flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition",
                    activeTab === 'paste' ? "bg-white text-blue-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Clipboard size={14} />
                  Paste Transcript
                </button>
              </div>

              {activeTab === 'link' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Share Link URL
                    </label>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://chatgpt.com/share/... or https://g.co/gemini/share/..."
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:border-blue-500 focus:bg-white outline-none transition"
                    />
                  </div>

                  {/* Sample buttons */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">ChatGPT</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">Gemini</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">Claude</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setUrlInput('https://chatgpt.com/share/6a9af239-1c80-83e8-ac86-2a7511bd288c')}
                        className="text-blue-600 hover:underline font-medium cursor-pointer"
                      >
                        Sample ChatGPT (3 turns)
                      </button>
                      <span className="text-gray-300">•</span>
                      <button
                        type="button"
                        onClick={() => setUrlInput('https://share.gemini.google/JosZKQtOQiaC')}
                        className="text-blue-600 hover:underline font-medium cursor-pointer"
                      >
                        Sample Gemini (2 turns)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    Paste Copied Conversation Text
                  </label>
                  <textarea
                    rows={8}
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder={`You said:\nHow do I configure Nginx for Node.js?\n\nChatGPT said:\nHere is a basic Nginx configuration for reverse proxying...`}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:border-blue-500 focus:bg-white outline-none transition"
                  />
                  <p className="text-[11px] text-gray-500">
                    Automatically extracts all User and AI speaker turns with 0 LLM API calls.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Fetching & Parsing Conversation…</span>
                  </>
                ) : (
                  <>
                    <span>Parse Conversation Turns</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* PREVIEW SCREEN */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Conversation Title
                  </label>
                  <input
                    type="text"
                    value={previewTitle}
                    onChange={(e) => setPreviewTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={resetForm}
                  className="text-xs text-gray-500 hover:text-gray-800 underline self-end mb-1.5"
                >
                  Change Input
                </button>
              </div>

              {/* Turns List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-gray-600 font-medium">
                  <span>Detected Turns ({parsedTurns.length})</span>
                  <span>{selectedTurnIndices.size} selected</span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {parsedTurns.map((turn, i) => {
                    const isSelected = selectedTurnIndices.has(i);
                    return (
                      <div
                        key={i}
                        onClick={() => toggleTurnSelection(i)}
                        className={cn(
                          "p-3 rounded-xl border text-xs cursor-pointer transition select-none flex items-start gap-2.5",
                          isSelected
                            ? "bg-blue-50/50 border-blue-200 shadow-2xs"
                            : "bg-gray-50 border-gray-200 opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded text-[10px]">
                              Turn {i + 1}
                            </span>
                            <span className="font-semibold text-gray-800 truncate">
                              {turn.user}
                            </span>
                          </div>
                          <p className="text-gray-600 line-clamp-2 leading-relaxed">
                            {turn.ai}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Import Options / Destinations */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
                <span className="font-semibold text-gray-700 block mb-1">Import Destination</span>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                  <input
                    type="checkbox"
                    checked={createConversation}
                    onChange={(e) => setCreateConversation(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5 font-medium">
                    <MessageSquare size={13} className="text-blue-500" />
                    Open as active chat thread (continue directly with the 11th turn!)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                  <input
                    type="checkbox"
                    checked={saveToMemory}
                    onChange={(e) => setSaveToMemory(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5 font-medium">
                    <Database size={13} className="text-emerald-500" />
                    Save turns into Long-Term Memory (GraphRAG & Canvas nodes)
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={committing || selectedTurnIndices.size === 0}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                >
                  {committing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving to PostgreSQL & Neo4j…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Import {selectedTurnIndices.size} Turn(s)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
