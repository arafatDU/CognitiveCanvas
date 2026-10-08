'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { MessageSquareText, Send, X, Save, Sparkles, Plus, Trash2, MessageSquare, PanelLeft, CheckSquare, Zap, Check, AlertTriangle, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chatApi, ConversationListResponse, ChatMessageDTO, memoriesApi, MemoletDTO, parseMemoletText, DeprecationWarning, auditorApi, getNextDisplayId } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CitationBadge } from './CitationBadge';
import { compileSpatialContext } from '@/lib/spatialCompiler';
import { ConfidenceHeatmapModal, HeatmapMessageData } from './ConfidenceHeatmapModal';

type Message = {
  id?: string;
  role: 'user' | 'ai';
  content: string;
  citations?: string[];
  model?: string;
  deprecationWarnings?: DeprecationWarning[];
  sentences?: string[];
  confidenceHeatmap?: number[];
  sentenceCitations?: string[][];
};

const SUGGESTION_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both',
  'but', 'by', 'can', 'cant', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'dont',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up',
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'tell', 'give', 'show', 'explain', 'please'
]);

export default function ChatOverlay() {
  const { rightSidebarOpen, setRightSidebarOpen, highlightNode, nodes, setNodes, setMemoriesNeedsSync, updateMemoletData } = useMemoletStore();

  const [inputValue, setInputValue] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [groupedModels, setGroupedModels] = useState<Record<string, string[]>>({});
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedMessagesForMemory, setSelectedMessagesForMemory] = useState<Set<string>>(new Set());
  const [savingMemory, setSavingMemory] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [updatingMemoletId, setUpdatingMemoletId] = useState<string | null>(null);

  // Real-Time Context Suggestion State
  const [suggestions, setSuggestions] = useState<MemoletDTO[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // New Chat History States
  const [conversations, setConversations] = useState<ConversationListResponse[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [heatmapModalMessage, setHeatmapModalMessage] = useState<HeatmapMessageData | null>(null);

  // Window resizing state (expandable / collapsible by dragging)
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>({
    width: 840,
    height: 700,
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Restore saved chat window size from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('memolet_chat_size');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
          const maxW = typeof window !== 'undefined' ? window.innerWidth - 32 : 1200;
          const maxH = typeof window !== 'undefined' ? window.innerHeight - 32 : 850;
          setWindowSize({
            width: Math.min(Math.max(parsed.width, 420), maxW),
            height: Math.min(Math.max(parsed.height, 420), maxH),
          });
        }
      }
    } catch {}
  }, []);

  const startResizing = useCallback(
    (e: React.PointerEvent, handleType: 'corner' | 'top' | 'left') => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = windowSize.width;
      const startH = windowSize.height;

      setIsResizing(true);
      if (isMaximized) setIsMaximized(false);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = startX - moveEvent.clientX; // dragging left expands width
        const deltaY = startY - moveEvent.clientY; // dragging up expands height

        const maxWidth = Math.max(500, window.innerWidth - 32);
        const maxHeight = Math.max(450, window.innerHeight - 32);

        let newWidth = startW;
        let newHeight = startH;

        if (handleType === 'corner' || handleType === 'left') {
          newWidth = Math.min(Math.max(startW + deltaX, 420), maxWidth);
        }
        if (handleType === 'corner' || handleType === 'top') {
          newHeight = Math.min(Math.max(startH + deltaY, 400), maxHeight);
        }

        setWindowSize({ width: newWidth, height: newHeight });
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        setIsResizing(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        const deltaX = startX - upEvent.clientX;
        const deltaY = startY - upEvent.clientY;
        const maxWidth = Math.max(500, window.innerWidth - 32);
        const maxHeight = Math.max(450, window.innerHeight - 32);

        let finalW = startW;
        let finalH = startH;
        if (handleType === 'corner' || handleType === 'left') {
          finalW = Math.min(Math.max(startW + deltaX, 420), maxWidth);
        }
        if (handleType === 'corner' || handleType === 'top') {
          finalH = Math.min(Math.max(startH + deltaY, 400), maxHeight);
        }

        try {
          localStorage.setItem('memolet_chat_size', JSON.stringify({ width: finalW, height: finalH }));
        } catch {}
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [windowSize, isMaximized]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch available models
  useEffect(() => {
    chatApi.getModels()
      .then(data => {
        setModels(data.models ?? []);
        if (data.grouped) setGroupedModels(data.grouped);
        if (data.default) setSelectedModel(data.default);
      })
      .catch(() => {
        setModels(['gemini/gemini-2.5-flash', 'gemini/gemini-2.0-flash']);
        setSelectedModel('gemini/gemini-2.5-flash');
      });
  }, []);

  const activeConversationId = useMemoletStore((s) => s.activeConversationId);
  const setActiveConversationId = useMemoletStore((s) => s.setActiveConversationId);

  // Load newly imported conversation if triggered
  useEffect(() => {
    if (activeConversationId) {
      loadConversation(activeConversationId);
      fetchConversations();
      setActiveConversationId(null);
    }
  }, [activeConversationId]);

  // Fetch conversations when sidebar opens
  useEffect(() => {
    if (rightSidebarOpen) {
      fetchConversations();
    }
  }, [rightSidebarOpen]);

  const fetchConversations = async () => {
    try {
      const data = await chatApi.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    }
  };

  const loadConversation = async (id: string) => {
    setCurrentConversationId(id);
    setLoading(true);
    try {
      const data = await chatApi.getConversation(id);
      setMessages(data.messages.map((m: ChatMessageDTO) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations
      })));
    } catch (error) {
      console.error('Failed to load conversation', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const deleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await chatApi.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        createNewChat();
      }
    } catch (error) {
      console.error('Failed to delete chat', error);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect @mention trigger
  useEffect(() => {
    const match = inputValue.match(/@(\w*)$/);
    if (match) {
      setShowMention(true);
      setMentionQuery(match[1].toLowerCase());
    } else {
      setShowMention(false);
      setMentionQuery('');
    }
  }, [inputValue]);

  // Debounced real-time context suggestion from GraphRAG
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionAbortRef = useRef<AbortController | null>(null);
  const lastDismissedQueryRef = useRef<string>('');

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    // Extract query text without @mention tags
    const cleanText = inputValue.replace(/@[\w-]+/g, '').trim();

    // Reset dismissed state if user typed a different question/topic
    if (dismissed && cleanText !== lastDismissedQueryRef.current) {
      if (
        Math.abs(cleanText.length - lastDismissedQueryRef.current.length) > 3 ||
        !cleanText.startsWith(lastDismissedQueryRef.current.slice(0, 5))
      ) {
        setDismissed(false);
      }
    }

    if (cleanText.length < 3 || showMention || dismissed) {
      if (cleanText.length < 3) {
        setSuggestions([]);
        setDismissed(false);
      }
      return;
    }

    // Substantive text check: ensure user typed actual technical/topic words, not just stopwords
    const tokens = cleanText
      .toLowerCase()
      .split(/[\s,.;:?!]+/)
      .filter((w) => w.length >= 2 && !SUGGESTION_STOPWORDS.has(w));

    if (tokens.length === 0) {
      setSuggestions([]);
      return;
    }

    // Wait for a deliberate typing pause (600ms)
    debounceTimerRef.current = setTimeout(async () => {
      if (suggestionAbortRef.current) {
        suggestionAbortRef.current.abort();
      }
      const controller = new AbortController();
      suggestionAbortRef.current = controller;

      setSuggestionsLoading(true);
      try {
        const results = await memoriesApi.search(cleanText, controller.signal);
        setSuggestions(results.slice(0, 3));
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Real-time suggestion error:', err);
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggestionsLoading(false);
        }
      }
    }, 600);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [inputValue, showMention, dismissed]);

  // Pre-calculate non-colliding sequential displayIds for active suggestions
  const suggestionDisplayIds = useMemo(() => {
    const ids: Record<string, string> = {};
    const reserved: string[] = [];

    for (const m of suggestions) {
      const existingNode = nodes.find((n) => n.id === m.id);
      if (existingNode?.data.displayId) {
        ids[m.id] = existingNode.data.displayId;
      } else {
        const nextId = getNextDisplayId(nodes, reserved);
        ids[m.id] = nextId;
        reserved.push(nextId);
      }
    }
    return ids;
  }, [suggestions, nodes]);

  // Option 1: Add to Canvas
  const handleAddToCanvas = useCallback((memolet: MemoletDTO, targetDisplayId?: string) => {
    const existingNode = nodes.find((n) => n.id === memolet.id);
    if (existingNode) {
      return existingNode.data.displayId || existingNode.id;
    }
    const parsed = parseMemoletText(memolet.text);
    const displayId = targetDisplayId || getNextDisplayId(nodes);
    const newNode = {
      id: memolet.id,
      type: 'memolet' as const,
      position: {
        x: Math.floor((Math.random() * 500 + 80) / 160) * 160,
        y: Math.floor((Math.random() * 350 + 80) / 160) * 160,
      },
      data: {
        text: memolet.text || '',
        keywords: memolet.keywords || [],
        color: memolet.color || '#e0f2fe',
        weight: memolet.weight || 1,
        summary: parsed.summary,
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
    setNodes([...nodes, newNode as any]);
    return displayId;
  }, [nodes, setNodes]);

  // Option 2: Direct Inject (auto-adds to canvas & appends @displayId to prompt)
  const handleDirectInject = useCallback((memolet: MemoletDTO, targetDisplayId?: string) => {
    const displayId = handleAddToCanvas(memolet, targetDisplayId);
    const mentionTag = `@${displayId}`;
    
    setInputValue((prev) => {
      const alreadyHasTag = prev.includes(mentionTag) || prev.includes(`@${memolet.id}`);
      if (alreadyHasTag) return prev;
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed} ${mentionTag} ` : `${mentionTag} `;
    });

    inputRef.current?.focus();
  }, [handleAddToCanvas]);

  const insertMention = useCallback((id: string) => {
    setInputValue((prev) => prev.replace(/@\w*$/, `@${id} `));
    setShowMention(false);
    inputRef.current?.focus();
  }, []);

  const filteredMemolets = nodes.filter(
    (m) => {
      const displayStr = m.data?.displayId || m.id;
      return displayStr.toLowerCase().includes(mentionQuery) ||
             m.data?.keywords?.some((k: string) => k.toLowerCase().includes(mentionQuery));
    }
  );

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    // Reset suggestions upon send
    setSuggestions([]);
    setDismissed(false);

    const edges = useMemoletStore.getState().edges;
    const spatialContext = compileSpatialContext(nodes, edges);
    const mentionedStrs = [...text.matchAll(/@([\w-]+)/g)].map((match) => match[1]);
    const mentionedIds = mentionedStrs.map(str => {
      const node = nodes.find(n => n.data?.displayId === str || n.id === str);
      return node ? node.id : str;
    });

    // Bundle connected synthesis partners into active context
    const bundledActiveIdSet = new Set<string>();
    const bundledDisplayPairs: string[] = [];

    if (mentionedIds.length > 0) {
      for (const mId of mentionedIds) {
        bundledActiveIdSet.add(mId);
        const connectedIds = useMemoletStore.getState().getConnectedNodeIds(mId);
        for (const connId of connectedIds) {
          const connNode = nodes.find((n) => n.id === connId);
          if (connNode && connNode.type === 'memolet') {
            bundledActiveIdSet.add(connId);
            const mNode = nodes.find((n) => n.id === mId);
            const mDisp = mNode?.data?.displayId || mId.slice(0, 4);
            const connDisp = connNode.data?.displayId || connId.slice(0, 4);
            bundledDisplayPairs.push(`[[citation:${mDisp}]] + [[citation:${connDisp}]]`);
          }
        }
      }
    }

    const effectiveActiveIds =
      bundledActiveIdSet.size > 0 ? Array.from(bundledActiveIdSet) : spatialContext.activeMemoletIds;

    let spatialInstructions = spatialContext.instructionText || '';
    if (bundledDisplayPairs.length > 0) {
      const bundleInst = `GROUP_CONTEXT: The user cited connected memories. Synthesize context from ${bundledDisplayPairs.join(', ')} cohesively into unified insights, citing all relevant memory sources.`;
      spatialInstructions = spatialInstructions
        ? `${spatialInstructions}\n${bundleInst}`
        : bundleInst;
    }

    const userMsgId = `usr-${Date.now()}`;
    const aiMsgId = `ai-${Date.now()}`;

    const userMsg: Message = { id: userMsgId, role: 'user', content: text };
    const initialAiMsg: Message = { id: aiMsgId, role: 'ai', content: '', model: selectedModel };

    setMessages((prev) => [...prev, userMsg, initialAiMsg]);
    setInputValue('');
    setLoading(true);

    const memoletDisplayMap: Record<string, string> = {};
    for (const node of nodes) {
      if (node.data?.displayId) {
        memoletDisplayMap[node.id] = node.data.displayId;
      }
    }

    chatApi.sendStream(
      {
        message: text,
        active_memolet_ids: effectiveActiveIds,
        memolet_display_map: memoletDisplayMap,
        model: selectedModel || undefined,
        conversation_id: currentConversationId || undefined,
        spatial_instructions: spatialInstructions || undefined,
      },
      (token) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, content: msg.content + token } : msg
          )
        );
      },
      (data) => {
        setLoading(false);
        if (!currentConversationId && data.conversation_id) {
          setCurrentConversationId(data.conversation_id);
          fetchConversations();
        } else if (currentConversationId && messages.length === 0) {
          fetchConversations();
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  content: data.reply || msg.content,
                  citations: data.citations?.flat() ?? [],
                  sentences: data.sentences ?? [],
                  confidenceHeatmap: data.confidence_heatmap ?? [],
                  sentenceCitations: data.citations ?? [],
                  model: data.model ?? selectedModel,
                  deprecationWarnings: data.deprecation_warnings ?? [],
                }
              : msg
          )
        );
      },
      (err) => {
        setLoading(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  content: msg.content || `⚠️ Error: ${err.message}\n\nMake sure you are logged in and the backend is running.`
                }
              : msg
          )
        );
      }
    );
  }, [inputValue, loading, selectedModel, currentConversationId, messages.length, nodes]);

  const aiMessageIds = messages
    .filter((m) => m.role === 'ai' && m.id)
    .map((m) => m.id as string);

  const activeConnectedPairs = useMemo(() => {
    const mentionedTags = [...inputValue.matchAll(/@([\w-]+)/g)].map((m) => m[1]);
    if (mentionedTags.length === 0) return [];

    const pairs: { sourceDisplay: string; targetDisplay: string }[] = [];
    for (const tag of mentionedTags) {
      const node = nodes.find((n) => n.data?.displayId === tag || n.id === tag);
      if (node) {
        const connIds = useMemoletStore.getState().getConnectedNodeIds(node.id);
        for (const connId of connIds) {
          const targetNode = nodes.find((n) => n.id === connId);
          if (targetNode && targetNode.type === 'memolet') {
            const sDisp = node.data?.displayId || node.id.slice(0, 4);
            const tDisp = targetNode.data?.displayId || targetNode.id.slice(0, 4);
            const exists = pairs.some(
              (p) =>
                (p.sourceDisplay === sDisp && p.targetDisplay === tDisp) ||
                (p.sourceDisplay === tDisp && p.targetDisplay === sDisp)
            );
            if (!exists) {
              pairs.push({ sourceDisplay: sDisp, targetDisplay: tDisp });
            }
          }
        }
      }
    }
    return pairs;
  }, [inputValue, nodes]);

  const allSelected =
    aiMessageIds.length > 0 &&
    aiMessageIds.every((id) => selectedMessagesForMemory.has(id));

  const handleToggleSelectAll = () => {
    if (aiMessageIds.length === 0) return;
    if (allSelected) {
      setSelectedMessagesForMemory(new Set());
    } else {
      setSelectedMessagesForMemory(new Set(aiMessageIds));
    }
  };

  const toggleMemorySelection = (aiMsgId: string) => {
    setSelectedMessagesForMemory((prev) => {
      const next = new Set(prev);
      if (next.has(aiMsgId)) next.delete(aiMsgId);
      else next.add(aiMsgId);
      return next;
    });
  };

  const handleSaveMemory = async () => {
    if (selectedMessagesForMemory.size === 0) return;
    setSavingMemory(true);
    setSaveStatus('idle');

    const pairsToSave: { user: string; ai: string }[] = [];
    const orderedAiIds = messages
      .filter((m) => m.role === 'ai' && m.id && selectedMessagesForMemory.has(m.id))
      .map((m) => m.id as string);

    for (const aiId of orderedAiIds) {
      const aiIndex = messages.findIndex((m) => m.id === aiId);
      if (aiIndex > 0) {
        for (let i = aiIndex - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            pairsToSave.push({
              user: messages[i].content,
              ai: messages[aiIndex].content,
            });
            break;
          }
        }
      }
    }

    try {
      await chatApi.saveMemory({ messages: pairsToSave, conversation_id: currentConversationId || undefined });
      setSaveStatus('success');
      setMemoriesNeedsSync(true); // Trigger a sync for Get Memory Tab
      setSelectedMessagesForMemory(new Set());
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Save memory error:', errorMsg);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSavingMemory(false);
    }
  };

  const displayModel = (model: string) => {
    if (model === 'openai/gpt-4o-mini') return 'GPT-4o Mini (Vercel AI)';
    if (model === 'openai/gpt-4o') return 'GPT-4o (Vercel AI)';
    if (model === 'openai/gpt-4-turbo') return 'GPT-4 Turbo (Vercel AI)';
    if (model === 'openai/o1') return 'OpenAI o1 (Vercel AI)';
    if (model === 'anthropic/claude-3-haiku') return 'Claude 3 Haiku (Vercel AI)';
    if (model === 'deepseek/deepseek-v3') return 'DeepSeek V3 (Vercel AI)';
    if (model === 'meta/llama-3.3-70b') return 'LLaMA 3.3 70B (Vercel AI)';
    if (model === 'meta/llama-3.1-8b') return 'LLaMA 3.1 8B (Vercel AI)';
    if (model === 'mistral/ministral-8b') return 'Ministral 8B (Vercel AI)';
    if (model === 'mistral/pixtral-12b') return 'Pixtral 12B (Vercel AI)';
    if (model === 'amazon/nova-lite') return 'Amazon Nova Lite (Vercel AI)';
    if (model.includes('gemma-4-31b-it')) return 'Gemma 4 31B Instruct';
    if (model.includes('gemma-4-26b-a4b-it')) return 'Gemma 4 26B Instruct';
    if (model.includes('gemini-3.6-flash')) return 'Gemini 3.6 Flash';
    if (model.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
    if (model.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro';
    if (model.startsWith('ollama/')) return `🦙 ${model.replace('ollama/', '')} (Ollama)`;
    return model.split('/').pop() ?? model;
  };

  if (!rightSidebarOpen) {
    return (
      <div className="absolute bottom-6 right-6 z-50">
        <button
          onClick={() => setRightSidebarOpen(true)}
          className="p-4 bg-blue-500 rounded-2xl text-white shadow-lg hover:bg-blue-600 transition-transform hover:scale-105 active:scale-95"
          title="Open chat"
        >
          <MessageSquareText size={26} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={
        isMaximized
          ? {
              width: 'calc(100% - 2rem)',
              height: 'calc(100% - 2rem)',
              maxWidth: 'calc(100vw - 2rem)',
              maxHeight: 'calc(100vh - 2rem)',
            }
          : {
              width: `${windowSize.width}px`,
              height: `${windowSize.height}px`,
              maxWidth: 'calc(100vw - 2rem)',
              maxHeight: 'calc(100vh - 2rem)',
            }
      }
      className={cn(
        "absolute right-4 bottom-4 flex rounded-2xl bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-800 shadow-2xl z-40 overflow-hidden transition-[background-color,border-color]",
        isResizing && "select-none shadow-indigo-500/10 ring-2 ring-indigo-500/20"
      )}
    >
      {/* ── Resize Handles (Active when not maximized) ── */}
      {!isMaximized && (
        <>
          {/* Top-Left Corner Grip: Expand/Shrink both Width and Height */}
          <div
            onPointerDown={(e) => startResizing(e, 'corner')}
            className="absolute top-0 left-0 w-6 h-6 z-50 cursor-nwse-resize flex items-center justify-center group touch-none"
            title="Drag corner to resize chat window"
          >
            <div className="w-2.5 h-2.5 border-t-2 border-l-2 border-gray-400 group-hover:border-indigo-500 dark:border-slate-600 dark:group-hover:border-indigo-400 rounded-tl-xs group-hover:scale-125 transition-all" />
          </div>

          {/* Top Edge Handle: Resize Height */}
          <div
            onPointerDown={(e) => startResizing(e, 'top')}
            className="absolute top-0 left-6 right-6 h-2 z-40 cursor-ns-resize hover:bg-indigo-500/15 transition-colors touch-none"
            title="Drag top edge to resize height"
          />

          {/* Left Edge Handle: Resize Width */}
          <div
            onPointerDown={(e) => startResizing(e, 'left')}
            className="absolute top-6 left-0 bottom-6 w-2 z-40 cursor-ew-resize hover:bg-indigo-500/15 transition-colors touch-none"
            title="Drag left edge to resize width"
          />
        </>
      )}

      {/* Sidebar for Chat History */}
      {sidebarOpen && (
        <div className="w-1/3 bg-gray-50 dark:bg-[#1e293b]/50 border-r border-gray-200 dark:border-slate-800 flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-slate-800">
            <button
              onClick={createNewChat}
              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition font-medium text-sm border border-blue-100 dark:border-blue-900/60"
            >
              <Plus size={16} /> New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition text-sm",
                  currentConversationId === conv.id
                    ? "bg-white dark:bg-[#0f172a] border border-blue-200 dark:border-blue-800 shadow-sm text-blue-700 dark:text-blue-300"
                    : "hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-700 dark:text-slate-300 border border-transparent"
                )}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <MessageSquare size={14} className={currentConversationId === conv.id ? "text-blue-500" : "text-gray-400"} />
                  <span className="truncate flex-1 font-medium text-xs">
                    {conv.title || 'New Conversation'}
                  </span>
                </div>
                <button
                  onClick={(e) => deleteChat(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                  title="Delete Chat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 bg-white dark:bg-[#0f172a]">
        {/* Header */}
        <div className="flex flex-col bg-gray-50 dark:bg-[#1e293b]/70 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-slate-200">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  "p-1.5 rounded-lg transition text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200",
                  sidebarOpen && "bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-200"
                )}
                title="Toggle Sidebar"
              >
                <PanelLeft size={16} />
              </button>
              <Sparkles size={15} className="text-blue-500 ml-1" />
              AI Assistant
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMaximized((prev) => !prev)}
                className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                title={isMaximized ? "Restore window size" : "Maximize chat window"}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                onClick={() => setRightSidebarOpen(false)}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#0f172a] gap-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:border-blue-400 text-gray-700 dark:text-slate-200 font-medium bg-gray-50 dark:bg-slate-800 flex-1 min-w-0"
            >
              {models.length === 0 && <option value="">Loading models…</option>}
              {Object.keys(groupedModels).length > 0 ? (
                Object.entries(groupedModels).map(([providerName, groupList]) => (
                  <optgroup key={providerName} label={providerName}>
                    {groupList.map((m) => (
                      <option key={m} value={m}>
                        {displayModel(m)}
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : (
                models.map((m) => (
                  <option key={m} value={m}>
                    {displayModel(m)}
                  </option>
                ))
              )}
            </select>

            {aiMessageIds.length > 0 && (
              <button
                onClick={handleToggleSelectAll}
                className={cn(
                  "flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border",
                  allSelected
                    ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                )}
                title={allSelected ? "Deselect all chat pairs" : "Select all chat pairs for memory"}
              >
                <CheckSquare size={13} className={allSelected ? "text-blue-500" : "text-gray-400"} />
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            )}

            {selectedMessagesForMemory.size > 0 && (
              <button
                onClick={handleSaveMemory}
                disabled={savingMemory}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold transition whitespace-nowrap border disabled:opacity-50',
                  saveStatus === 'success'
                    ? 'bg-green-50 text-green-600 border-green-200'
                    : saveStatus === 'error'
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                )}
              >
                <Save size={12} />
                {savingMemory
                  ? 'Saving…'
                  : saveStatus === 'success'
                  ? '✓ Saved!'
                  : saveStatus === 'error'
                  ? 'Failed'
                  : `Save ${selectedMessagesForMemory.size} to Memory`}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fdfdfd] dark:bg-[#090d16] transition-colors">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                <Sparkles size={22} className="text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">Ask me anything</p>
              <p className="text-xs text-gray-400 max-w-[260px]">
                Use <span className="font-mono bg-gray-100 px-1 rounded">@</span> to cite memories from your canvas in the prompt.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={msg.id ?? i}
              className={cn(
                'flex flex-col gap-1 max-w-[90%]',
                msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start group'
              )}
            >
              <div
                className={cn(
                  'px-3 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm prose prose-sm prose-blue max-w-none whitespace-normal'
                )}
              >
                {msg.role === 'ai' ? (
                  <>
                    {msg.deprecationWarnings && msg.deprecationWarnings.length > 0 && (
                      <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs not-prose">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1.5">
                          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                          <span>Temporal Staleness Warning</span>
                        </div>
                        <div className="space-y-1.5">
                          {msg.deprecationWarnings.map((w, wi) => {
                            const citedNode = nodes.find((n) => n.id === w.memolet_id);
                            const display = citedNode?.data.displayId ?? w.memolet_id.substring(0, 6);
                            const isUpdating = updatingMemoletId === w.memolet_id;
                            const isUpdated = citedNode && !citedNode.data.isDeprecated;
                            return (
                              <div key={wi} className="text-[11px] text-amber-800 leading-snug flex flex-col gap-1 pb-1 border-b border-amber-200/50 last:border-b-0 last:pb-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-amber-900">Memory [{display}]</span>
                                  {isUpdated ? (
                                    <span className="text-[10px] text-green-700 font-semibold bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                      ✓ Updated
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={async () => {
                                        setUpdatingMemoletId(w.memolet_id);
                                        try {
                                          const res = await auditorApi.refresh(w.memolet_id);
                                          const parsed = parseMemoletText(res.text);
                                          updateMemoletData(w.memolet_id, {
                                            text: res.text,
                                            summary: res.summary || parsed.summary,
                                            isDeprecated: false,
                                            deprecationReason: undefined,
                                            suggestedUpdate: undefined,
                                            temporalAnchor: res.temporal_anchor,
                                          });
                                        } catch (err) {
                                          console.error('Failed to refresh from chat warning:', err);
                                        } finally {
                                          setUpdatingMemoletId(null);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-200/90 hover:bg-amber-300 text-amber-900 px-2 py-0.5 rounded-md transition cursor-pointer shadow-2xs disabled:opacity-50"
                                    >
                                      <RefreshCw size={10} className={isUpdating ? 'animate-spin' : ''} />
                                      <span>{isUpdating ? 'Updating...' : `Update [${display}]`}</span>
                                    </button>
                                  )}
                                </div>
                                <div className="text-amber-800 font-medium">{w.reason}</div>
                                {w.suggested_update && (
                                  <div className="text-gray-700 mt-0.5 font-normal bg-white/70 p-1.5 rounded border border-amber-200/60">
                                    💡 <span className="font-semibold text-amber-900">Modern: </span>{w.suggested_update}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => {
                          if (href?.startsWith('#citation-')) {
                            const id = href.replace('#citation-', '');
                            return <CitationBadge displayId={id} />;
                          }
                          return (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {msg.content
                        .replace(/\[\[citation:\s*([\w.-]+)\]\]/gi, '[$1](#citation-$1)')
                        .replace(/\[citation:\s*([\w.-]+)\]/gi, '[$1](#citation-$1)')}
                    </ReactMarkdown>
                  </>
                ) : (
                  msg.content
                )}

                {msg.citations && msg.citations.length > 0 && (() => {
                  const uniqueCitations = Array.from(new Set(msg.citations));
                  const hasHeatmap = msg.confidenceHeatmap && msg.confidenceHeatmap.length > 0;
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-2.5 items-center">
                      <span className="text-[10px] text-gray-400 font-semibold mr-0.5">Referenced Memories:</span>
                      {uniqueCitations.map((citeId, j) => {
                        const citedNode = nodes.find(n => n.id === citeId);
                        const display = citedNode?.data?.displayId ?? citeId.substring(0, 6);
                        return (
                          <CitationBadge key={j} displayId={display} />
                        );
                      })}
                      {hasHeatmap && (
                        <button
                          type="button"
                          onClick={() => setHeatmapModalMessage(msg as HeatmapMessageData)}
                          className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer"
                          title="Inspect sentence-level grounding confidence heatmap"
                        >
                          🔥 <span>Confidence Heatmap</span>
                        </button>
                      )}
                    </div>
                  );
                })()}

                {(!msg.citations || msg.citations.length === 0) && msg.confidenceHeatmap && msg.confidenceHeatmap.length > 0 && (
                  <div className="flex items-center mt-2">
                    <button
                      type="button"
                      onClick={() => setHeatmapModalMessage(msg as HeatmapMessageData)}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer"
                      title="Inspect grounding confidence heatmap"
                    >
                      🔥 <span>Confidence Heatmap</span>
                    </button>
                  </div>
                )}
              </div>

              {msg.role === 'ai' && (
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                    ⚡ {displayModel(msg.model || selectedModel)}
                  </span>
                  {msg.id && (
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-500 transition opacity-0 group-hover:opacity-100">
                      <input
                        type="checkbox"
                        checked={selectedMessagesForMemory.has(msg.id)}
                        onChange={() => toggleMemorySelection(msg.id!)}
                        className="rounded text-blue-500 focus:ring-blue-500 w-3 h-3"
                      />
                      Save to Memory
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mr-auto">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
              </span>
              Thinking…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-white dark:bg-[#0f172a] border-t border-gray-200 dark:border-slate-800 p-3 relative transition-colors">
          {/* ⚡ Floating Real-Time Context Suggestion Panel */}
          {suggestions.length > 0 && !showMention && !dismissed && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white/95 backdrop-blur-md border border-blue-200/90 rounded-2xl shadow-xl p-3 z-40 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                  <Sparkles size={14} className="text-blue-500 animate-pulse" />
                  <span>Suggested Relevant Memories</span>
                  <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                    {suggestions.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const cleanText = inputValue.replace(/@[\w-]+/g, '').trim();
                    lastDismissedQueryRef.current = cleanText;
                    setDismissed(true);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded-md hover:bg-gray-100 transition"
                  title="Dismiss suggestions"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-2 max-h-56 overflow-y-auto pr-0.5">
                {suggestions.map((m) => {
                  const parsed = parseMemoletText(m.text);
                  const summary = parsed.summary || m.text.slice(0, 100);
                  const existingNode = nodes.find((n) => n.id === m.id);
                  const isOnCanvas = Boolean(existingNode);
                  const displayId = suggestionDisplayIds[m.id] || existingNode?.data.displayId || getNextDisplayId(nodes);
                  const isInPrompt = inputValue.includes(`@${displayId}`) || inputValue.includes(`@${m.id}`);

                  return (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-blue-50/40 hover:border-blue-200 transition group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border shadow-2xs"
                            style={{
                              backgroundColor: m.color || '#e0f2fe',
                              borderColor: '#cbd5e1',
                              color: '#1e293b',
                            }}
                          >
                            📝 {displayId}
                          </span>
                          {m.is_deprecated && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle size={9} />
                              Stale
                            </span>
                          )}
                          {m.keywords && m.keywords.length > 0 && (
                            <div className="flex items-center gap-1 overflow-hidden">
                              {m.keywords.slice(0, 3).map((k, idx) => (
                                <span key={idx} className="text-[10px] text-gray-400 font-medium truncate">
                                  #{k}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed font-normal">
                          {summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                        {/* Option 1: Add to Canvas */}
                        <button
                          onClick={() => handleAddToCanvas(m, displayId)}
                          disabled={isOnCanvas}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 shadow-2xs",
                            isOnCanvas
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                              : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 hover:border-gray-400 cursor-pointer"
                          )}
                          title={isOnCanvas ? "Already added to canvas" : "Add memory to React Flow sandbox"}
                        >
                          {isOnCanvas ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span>Canvas</span>
                            </>
                          ) : (
                            <>
                              <Plus size={12} />
                              <span>+ Canvas</span>
                            </>
                          )}
                        </button>

                        {/* Option 2: Direct Inject */}
                        <button
                          onClick={() => handleDirectInject(m, displayId)}
                          disabled={isInPrompt}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 shadow-2xs",
                            isInPrompt
                              ? "bg-blue-100 text-blue-700 border border-blue-300 cursor-default"
                              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/10 cursor-pointer"
                          )}
                          title={isInPrompt ? "Already cited in prompt" : "Auto-add to canvas and inject into prompt"}
                        >
                          {isInPrompt ? (
                            <>
                              <Check size={12} className="text-blue-700" />
                              <span>Injected</span>
                            </>
                          ) : (
                            <>
                              <Zap size={12} className="fill-current text-yellow-300" />
                              <span>⚡ Inject</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showMention && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
              <div className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 sticky top-0 rounded-t-xl">
                Select Memory
              </div>
              {filteredMemolets.length === 0 ? (
                <div className="p-3 text-xs text-gray-400">No memories on canvas yet.</div>
              ) : (
                filteredMemolets.map((m) => {
                  const display = m.data.displayId ?? m.id.substring(0, 8);
                  return (
                    <button
                      key={m.id}
                      onClick={() => insertMention(m.data.displayId ?? m.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition"
                    >
                      <span className="font-mono font-bold text-gray-800">📝 {display}</span>
                      <span className="ml-2 text-gray-400 text-xs">
                        {m.data.keywords.slice(0, 4).join(', ')}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {activeConnectedPairs.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 bg-blue-50/90 border border-blue-200 rounded-lg text-xs text-blue-900 shadow-2xs">
              <span className="font-bold flex items-center gap-1">
                <span>🔗</span>
                <span>Canvas Synthesis:</span>
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {activeConnectedPairs.map((p, i) => (
                  <span
                    key={i}
                    className="font-mono font-semibold bg-white border border-blue-300 px-1.5 py-0.5 rounded shadow-2xs text-[11px] text-blue-700"
                  >
                    @{p.sourceDisplay} ⟷ @{p.targetDisplay}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-blue-600 ml-auto font-sans hidden sm:inline">
                Bundled automatically for unified synthesis
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-800/80 focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-900 transition shadow-sm">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !showMention && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
                if (e.key === 'Escape') setShowMention(false);
              }}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
              placeholder="Ask anything or use @ to cite a memory…"
              autoComplete="off"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
              className="mr-2 p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 dark:disabled:bg-slate-800 disabled:text-gray-400 text-white rounded-lg transition"
              title="Send"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      <ConfidenceHeatmapModal
        isOpen={!!heatmapModalMessage}
        onClose={() => setHeatmapModalMessage(null)}
        message={heatmapModalMessage}
        nodes={nodes}
      />
    </div>
  );
}
