'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser, UserButton } from '@clerk/nextjs';
import {
  Brain,
  Sparkles,
  Layers,
  ShieldCheck,
  Cpu,
  ArrowRight,
  Network,
  Clock,
  Download,
  Flame,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  GitBranch,
  Sliders,
  Search,
  BookOpen,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { ThemeToggle } from '@/components/Theme/ThemeToggle';

type DemoNodeKey = '1_0' | '1_1' | '1_2';

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [selectedNode, setSelectedNode] = useState<DemoNodeKey>('1_0');
  const [nodeWeight, setNodeWeight] = useState<number>(1.8);

  const demoNodes: Record<
    DemoNodeKey,
    {
      displayId: string;
      title: string;
      category: string;
      lightBg: string;
      darkBg: string;
      borderColor: string;
      textColor: string;
      keywords: string[];
      summary: string;
      defaultWeight: number;
      citationText: string;
      groundingConfidence: string;
    }
  > = {
    '1_0': {
      displayId: '1_0',
      title: 'FastAPI SSE Streaming Architecture',
      category: 'Backend Architecture',
      lightBg: 'bg-blue-50/90',
      darkBg: 'dark:bg-blue-950/40',
      borderColor: 'border-blue-300 dark:border-blue-700',
      textColor: 'text-blue-900 dark:text-blue-200',
      keywords: ['FastAPI', 'SSE', 'Streaming', 'Redis'],
      summary:
        'Asynchronous event streaming endpoints with sub-second token delivery and Redis pub/sub broadcasting.',
      defaultWeight: 1.8,
      citationText:
        'The backend implements FastAPI async event streams [[1_0]] to broadcast real-time tokens to the client with sub-second latency.',
      groundingConfidence: '94% Supported',
    },
    '1_1': {
      displayId: '1_1',
      title: 'Neo4j GraphRAG Knowledge Graph',
      category: 'Knowledge Graph',
      lightBg: 'bg-emerald-50/90',
      darkBg: 'dark:bg-emerald-950/40',
      borderColor: 'border-emerald-300 dark:border-emerald-700',
      textColor: 'text-emerald-900 dark:text-emerald-200',
      keywords: ['Neo4j', 'Cypher', 'Concepts', 'GraphRAG'],
      summary:
        'Extracts conversational entities into linked Concept subgraphs to retrieve associative memories beyond direct keywords.',
      defaultWeight: 1.2,
      citationText:
        'Knowledge entities are traversed via Neo4j Cypher queries [[1_1]] to recover contextual concept clusters even when phrasing differs.',
      groundingConfidence: '91% Supported',
    },
    '1_2': {
      displayId: '1_2',
      title: 'PostgreSQL pgvector Dense Indexing',
      category: 'Vector Similarity',
      lightBg: 'bg-amber-50/90',
      darkBg: 'dark:bg-amber-950/40',
      borderColor: 'border-amber-300 dark:border-amber-700',
      textColor: 'text-amber-900 dark:text-amber-200',
      keywords: ['pgvector', 'PostgreSQL', 'MiniLM', 'Cosine'],
      summary:
        '384-dimensional cosine similarity embeddings for rapid hybrid keyword and semantic turn searches.',
      defaultWeight: 0.8,
      citationText:
        'Dense vector indexing matches semantic intentions [[1_2]] to retrieve relevant historic conversation turns based on cosine distance.',
      groundingConfidence: '87% Supported',
    },
  };

  const activeNode = demoNodes[selectedNode];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090d16] dark:text-slate-100 transition-colors duration-200">
      {/* ── 1. Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-[#090d16]/85 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-indigo-500/15 group-hover:scale-105 transition-transform flex-shrink-0">
              <Image
                src="/logo.png"
                alt="CognitiveCanvas Logo"
                width={36}
                height={36}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              CognitiveCanvas
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#interactive-demo" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Interactive Demo
            </a>
            <a href="#paradigm" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Paradigm Shift
            </a>
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Architecture
            </a>
            <a href="#research" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Research
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle showLabel={false} />

            {isLoaded && isSignedIn ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/workspace"
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-8 h-8 border border-slate-200 dark:border-slate-700',
                    },
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-1.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition hover:scale-105 active:scale-95"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section ──────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6 text-slate-950 dark:text-white">
            Conversational memories shouldn&apos;t{' '}
            <span className="bg-linear-to-r from-indigo-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              evaporate into chat history.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
            Transform fragmented, disposable chat threads into <strong>reusable cognitive memory objects</strong>.
            Arrange them on an infinite 2D canvas to visually steer AI reasoning with <strong>GraphRAG</strong>,
            spatial prompt weighting, and sentence-level trace verification.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mb-14">
            <Link
              href={isSignedIn ? '/workspace' : '/register'}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition hover:scale-105 active:scale-95"
            >
              <span>{isSignedIn ? 'Enter Your Workspace' : 'Launch Interactive Canvas'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#interactive-demo"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm sm:text-base shadow-2xs transition"
            >
              Explore Live Simulation ↓
            </a>
          </div>

          {/* Quick Pillar Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto pt-4 border-t border-slate-200 dark:border-slate-800/80 text-left">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                <Network className="w-3.5 h-3.5 text-blue-500" />
                <span>Neo4j GraphRAG</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Deep concept traversal</p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Spatial Weighting</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Node size controls focus</p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Sentence Citations</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Grounded [[1_0]] badges</p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Temporal Auditor</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Flags obsolete facts</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Interactive Sensemaking Simulation ───────────────────────── */}
      <section id="interactive-demo" className="py-20 bg-slate-100/70 dark:bg-[#0c121e] border-y border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
              Interactive Workspace Simulation
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-3 text-slate-950 dark:text-white">
              Experience Spatial Memory Reification
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Click a memory node below, adjust its spatial weight, and observe how the prompt synthesis and sentence-level trace citation dynamically adapt.
            </p>
          </div>

          {/* Canvas Window Simulation Container */}
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            {/* macOS-style Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                </div>
                <span className="ml-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                  sandbox.memolet.canvas · Sensemaking Sandbox
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> GraphRAG Active
                </span>
              </div>
            </div>

            {/* Interactive Body */}
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: 3 Memory Nodes on Canvas */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Step 1: Select Active Memory Node
                    </span>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      Click to activate
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {(Object.keys(demoNodes) as DemoNodeKey[]).map((key) => {
                      const item = demoNodes[key];
                      const isSelected = selectedNode === key;
                      return (
                        <div
                          key={key}
                          onClick={() => {
                            setSelectedNode(key);
                            setNodeWeight(item.defaultWeight);
                          }}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer select-none text-slate-900 ${
                            item.lightBg
                          } ${item.darkBg} ${
                            isSelected
                              ? 'border-indigo-600 dark:border-indigo-400 shadow-md ring-2 ring-indigo-500/30 scale-[1.02]'
                              : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold mb-2">
                            <span className="font-mono bg-white/80 dark:bg-black/30 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-100">
                              📝 {item.displayId}
                            </span>
                            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300">
                              {isSelected ? `${nodeWeight.toFixed(1)}x` : `${item.defaultWeight}x`}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold leading-snug line-clamp-2 text-slate-900 dark:text-slate-100">
                            {item.title}
                          </h4>
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {item.keywords.slice(0, 2).map((kw, i) => (
                              <span
                                key={i}
                                className="text-[10px] font-mono bg-white/80 dark:bg-black/20 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded"
                              >
                                #{kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Spatial Weighting Slider */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Step 2: Simulate Canvas Node Resizing (Spatial Weight)</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 rounded">
                      {nodeWeight.toFixed(1)}x Priority
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    value={nodeWeight}
                    onChange={(e) => setNodeWeight(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />

                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>0.5x (Deprioritized)</span>
                    <span>1.0x (Standard)</span>
                    <span>2.5x (Max Focus)</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Grounded AI Output & Citations */}
              <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Step 3: Grounded AI Synthesis
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                      🔥 {activeNode.groundingConfidence}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                      {activeNode.citationText.split(`[[${activeNode.displayId}]]`)[0]}
                      <span className="inline-flex items-center font-mono font-bold text-[11px] px-1.5 py-0.2 mx-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                        [{activeNode.displayId}]
                      </span>
                      {activeNode.citationText.split(`[[${activeNode.displayId}]]`)[1]}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Compiled Prompt Directive:
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto">
                    <code>
                      &lt;HIGHLIGHT_CONTEXT id=&quot;{activeNode.displayId}&quot; weight=&quot;{nodeWeight.toFixed(1)}&quot;&gt;
                      <br />
                      &nbsp;&nbsp;{activeNode.summary}
                      <br />
                      &lt;/HIGHLIGHT_CONTEXT&gt;
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Paradigm Shift: Linear Amnesia vs Reification ─────────────── */}
      <section id="paradigm" className="py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
              The Cognitive Paradigm Shift
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4 text-slate-950 dark:text-white">
              Why Linear Chat Threads Fail Complex Thinking
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Traditional chatbots treat conversations as disposable text logs. CognitiveCanvas transforms them into durable, reified cognitive objects.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* The Old Way: Linear Amnesia */}
            <div className="p-8 rounded-2xl border border-red-200 dark:border-red-950/60 bg-red-50/40 dark:bg-red-950/15 space-y-5">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                <span>✕ The Linear Chatbot Dilemma</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Fragile, Ephemeral Chat Logs
              </h3>
              <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-base leading-none">―</span>
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100">Context Bloat & Token Degradation:</strong>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Pasting endless chat histories fills prompt windows with noise, eroding reasoning clarity.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-base leading-none">―</span>
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100">Zero Spatial or Granular Control:</strong>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      You cannot isolate, downweight, or highlight specific past paragraphs without manual rewriting.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-base leading-none">―</span>
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100">Temporal Staleness & Silent Drifts:</strong>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Deprecated libraries and outdated architectural decisions silently poison subsequent chat turns.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* The CognitiveCanvas Way */}
            <div className="p-8 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-5 shadow-xs">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                <span>✓ The CognitiveCanvas Paradigm</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Interactive, Reified Cognitive Objects
              </h3>
              <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold text-base leading-none">✔</span>
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100">GraphRAG Semantic Retrieval:</strong>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Neo4j knowledge subgraphs uncover concepts and distant relationships beyond raw keyword matching.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold text-base leading-none">✔</span>
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100">Physical Spatial Weighting:</strong>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Resize and cluster memory nodes on a 2D canvas to directly calibrate model attention.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold text-base leading-none">✔</span>
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100">Temporal Auditing & Verification:</strong>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Autonomous LLM-as-a-judge audits stale code versions and provides 1-click update patches.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Six Core Architectural Pillars ────────────────────────────── */}
      <section id="features" className="py-20 sm:py-24 bg-slate-100/70 dark:bg-[#0c121e] border-y border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
              Engineered Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4 text-slate-950 dark:text-white">
              Six Pillars of Continuous Cognitive Memory
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              A hybrid system uniting knowledge graphs, vector embeddings, and interactive visual sensemaking.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: GraphRAG */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <Network className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-slate-100">
                1. Dual-Layer GraphRAG Engine
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Connects PostgreSQL vector indices with a Neo4j knowledge graph of conceptual entities for contextual graph traversal.
              </p>
            </div>

            {/* Card 2: 2D Sensemaking Sandbox */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-slate-100">
                2. 2D Sensemaking Sandbox
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Built with React Flow. Node resizing and spatial arrangement dynamically modify the weights injected into the synthesis prompt.
              </p>
            </div>

            {/* Card 3: Confidence Heatmaps */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-slate-100">
                3. Sentence-Level Citations & Heatmaps
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Sentence-by-sentence confidence heatmaps and clickable inline citations [1_0] linking claims directly back to their source nodes.
              </p>
            </div>

            {/* Card 4: Temporal Auditor */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-slate-100">
                4. Deprecated Memory Auditor
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Flags time-sensitive entities and leverages an autonomous LLM-as-a-judge to detect outdated APIs before prompt assembly.
              </p>
            </div>

            {/* Card 5: Universal Importer */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-slate-100">
                5. Universal Chat Link Importer
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Paste public links from ChatGPT, Claude, or Gemini to parse past conversation turns directly into reusable canvas nodes.
              </p>
            </div>

            {/* Card 6: Multi-Model Router */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-slate-100">
                6. Multi-Model LLM Routing
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Unified routing across OpenAI GPT-4o, Google Gemini, Anthropic Claude, Meta LLaMA 3.3, and local Ollama instances.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Research & Academic Foundations ───────────────────────────── */}
      <section id="research" className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <span>Research Origins</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
            Built on Peer-Reviewed Sensemaking Paradigms
          </h2>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            CognitiveCanvas advances the research paper <em>&ldquo;Memolet: Reifying the Reuse of User-AI Conversational Memories&rdquo;</em> (ACM UIST &apos;24) by introducing GraphRAG concept traversal, temporal auditing, and spatial prompt assembly.
          </p>

          <div className="pt-4">
            <Link
              href={isSignedIn ? '/workspace' : '/register'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs sm:text-sm font-bold transition shadow-sm"
            >
              <span>Explore CognitiveCanvas in Action</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 7. Footer ────────────────────────────────────────────────────── */}
      <footer className="py-8 bg-white dark:bg-[#090d16] border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} CognitiveCanvas · Academic Research Project.</p>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/arafatDU/memolet"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              GitHub
            </a>
            <Link href="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Sign In
            </Link>
            <Link href="/workspace" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
