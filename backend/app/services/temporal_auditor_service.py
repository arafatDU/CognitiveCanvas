import re
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from litellm import completion
from app.core.config import settings
from app.services.llm_router import llm_router

logger = logging.getLogger(__name__)

# Primary high-throughput models (user specified gemini-3.5-flash-lite with flash fallback)
AUDITOR_MODELS = [
    "gemini/gemini-3.5-flash-lite",
    "gemini/gemini-3.5-flash",
    "gemini/gemini-2.5-flash",
]

# ---------------------------------------------------------------------------
# Comprehensive Heuristic Regex Patterns for Deprecation & Time-Sensitivity
# ---------------------------------------------------------------------------

# 1. Semantic Versioning & Package tags
VERSION_REGEX = re.compile(
    r"\b("
    r"v?\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?|"
    r"v?\d+\.x|"
    r"alpha|beta|rc\d*|canary|nightly|lts|eol|end-of-life|"
    r"@latest|@next|\^|\~"
    r")\b",
    re.IGNORECASE
)

# 2. Version phrasing: "version 13", "Next.js 14", "Python 3.10", etc.
VERSION_PHRASE_REGEX = re.compile(
    r"\b(version|v\.|v|release|patch|build)\s*(\d+(\.\d+)*)\b|"
    r"\b(python\s*3\.\d+|node(\.js)?\s*\d+|es\d+|ecmascript\s*\d{4})\b",
    re.IGNORECASE
)

# 3. Temporal Adverbs & Transient References
TEMPORAL_ADVERBS_REGEX = re.compile(
    r"\b("
    r"currently|as of|nowadays|at present|at the moment|right now|"
    r"latest version|recent update|new feature in|since version|"
    r"temporary workaround|roadmap|pricing|cost per month|quota|tier|"
    r"in recent years|this year|last year|upcoming release"
    r")\b",
    re.IGNORECASE
)

# 4. Explicit Deprecation & Migration Vocabulary
DEPRECATION_VOCAB_REGEX = re.compile(
    r"\b("
    r"deprecated|deprecate|deprecation|obsolete|legacy|superseded|sunset|"
    r"discontinued|outdated|migrating from|migrated to|backward compatibility|"
    r"breaking changes?|migration guide|archived|no longer supported"
    r")\b",
    re.IGNORECASE
)

# 5. Calendar Anchors: Years (1990 - 2039), Months, Quarters
CALENDAR_REGEX = re.compile(
    r"\b(19\d\d|20[0-3]\d)\b|"
    r"\bQ[1-4]\b|"
    r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b",
    re.IGNORECASE
)

# 6. Fast-Moving Ecosystem Dictionary (Web, Backend, AI/ML, Cloud, DevOps)
FAST_MOVING_ECOSYSTEM = {
    # Frontend & Web
    "next.js", "nextjs", "react", "react.js", "vue", "vue.js", "nuxt", "nuxtjs", 
    "angular", "svelte", "sveltekit", "astro", "remix", "tailwind", "tailwindcss", 
    "webpack", "vite", "turbopack", "rollup", "babel", "eslint", "pnpm", "yarn", "npm",
    
    # Backend & Frameworks
    "fastapi", "express", "express.js", "django", "flask", "spring boot", "nestjs",
    "pydantic", "sqlalchemy", "prisma", "drizzle", "graphql", "trpc", "grpc",
    
    # AI / ML / LLMs & Agents
    "langchain", "llamaindex", "openai", "anthropic", "gemini", "claude", "huggingface",
    "transformers", "pytorch", "tensorflow", "vllm", "ollama", "litellm", "deepseek", 
    "mistral", "groq", "crewai", "autogen", "semantic kernel",
    
    # Cloud, Auth & Databases
    "docker", "kubernetes", "k8s", "helm", "terraform", "aws", "gcp", "azure", 
    "cloudflare", "vercel", "netlify", "supabase", "neon", "firebase", "clerk", "nextauth", "auth0"
}


class TemporalAuditorService:
    def __init__(self):
        pass

    def get_current_time_grounding(self) -> Dict[str, Any]:
        """
        Dynamically derives the current real-world timestamp and date strings.
        Ensures time grounding is NEVER hardcoded to a fixed year.
        """
        now = datetime.now(timezone.utc)
        return {
            "current_year": now.year,
            "current_date_str": now.strftime("%B %Y"),
            "current_full_date": now.strftime("%Y-%m-%d"),
            "now_iso": now.isoformat(),
        }

    def scan_temporal_heuristics(self, text: str) -> Dict[str, Any]:
        """
        Tier 0 Heuristic Engine:
        0ms, 0 API calls. Analyzes text with rich regex and ecosystem dictionary
        to detect if the memory has any temporal sensitivity or deprecation indicators.
        """
        if not text:
            return {"is_time_sensitive": False, "matched_patterns": [], "risk": "none"}

        text_lower = text.lower()
        matched_patterns = []

        # 1. Check version numbers
        v_matches = VERSION_REGEX.findall(text)
        if v_matches:
            matched_patterns.append("version_tag")

        # 2. Check version phrases
        vp_matches = VERSION_PHRASE_REGEX.findall(text)
        if vp_matches:
            matched_patterns.append("version_phrase")

        # 3. Check temporal adverbs
        adv_matches = TEMPORAL_ADVERBS_REGEX.findall(text)
        if adv_matches:
            matched_patterns.append("temporal_adverb")

        # 4. Check explicit deprecation terms
        dep_matches = DEPRECATION_VOCAB_REGEX.findall(text)
        if dep_matches:
            matched_patterns.append("deprecation_term")

        # 5. Check calendar years/dates
        cal_matches = CALENDAR_REGEX.findall(text)
        if cal_matches:
            matched_patterns.append("calendar_anchor")

        # 6. Check fast-moving ecosystem keywords
        matched_tech = [tech for tech in FAST_MOVING_ECOSYSTEM if re.search(r"\b" + re.escape(tech) + r"\b", text_lower)]
        if matched_tech:
            matched_patterns.append(f"fast_moving_tech({','.join(matched_tech[:3])})")

        is_sensitive = len(matched_patterns) > 0

        # Assess preliminary heuristic risk
        if "deprecation_term" in matched_patterns or ("version_tag" in matched_patterns and matched_tech):
            risk = "high"
        elif "version_phrase" in matched_patterns or "calendar_anchor" in matched_patterns or matched_tech:
            risk = "medium"
        elif is_sensitive:
            risk = "low"
        else:
            risk = "none"

        return {
            "is_time_sensitive": is_sensitive,
            "matched_patterns": matched_patterns,
            "risk": risk,
            "matched_tech": matched_tech[:5],
        }

    def _call_auditor_llm(self, prompt: str) -> str:
        """
        Dispatches LLM calls with automatic fallback:
        gemini-3.5-flash-lite -> gemini-3.5-flash -> gemini-2.5-flash -> default_model
        """
        candidate_models = list(AUDITOR_MODELS)
        if llm_router.default_model and llm_router.default_model not in candidate_models:
            candidate_models.append(llm_router.default_model)

        last_error = None
        for model_name in candidate_models:
            try:
                resp = completion(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                    response_format={"type": "json_object"}
                )
                content = resp["choices"][0]["message"]["content"].strip()
                if content:
                    return content
            except Exception as e:
                logger.warning(f"Auditor LLM call failed on {model_name}: {e}. Retrying fallback...")
                last_error = e

        raise RuntimeError(f"All auditor LLM candidates failed. Last error: {last_error}")

    def audit_and_summarize_pairs(
        self,
        pairs: List[Dict[str, str]],
        force_ai: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Single-Pass Unified Summarization & Deprecation Auditor:
        Processes all conversation pairs in ONE SINGLE LLM CALL.
        
        1. Runs Tier 0 regex heuristic on each pair.
        2. Injects dynamic current date (e.g. Month Year).
        3. Prompts the LLM to output summary + keywords + temporal metadata in one unified JSON.
        4. If LLM call fails, falls back gracefully to deterministic summary + regex metadata.
        """
        if not pairs:
            return []

        time_info = self.get_current_time_grounding()
        current_date_str = time_info["current_date_str"]

        # Run heuristic scan across all pairs
        heuristic_results = []
        any_sensitive = False
        for pair in pairs:
            combined_text = f"{pair.get('user', '')}\n{pair.get('ai', '')}"
            h_scan = self.scan_temporal_heuristics(combined_text)
            heuristic_results.append(h_scan)
            if h_scan["is_time_sensitive"]:
                any_sensitive = True

        # Build single batched prompt for the LLM
        prompt_pairs = []
        for i, pair in enumerate(pairs):
            prompt_pairs.append(
                f"### Interaction {i}:\nUser: {pair.get('user', '')}\nAI: {pair.get('ai', '')}"
            )

        combined_prompt = f"""
You are a precise technical memory assistant for CognitiveCanvas.
Today's date is: {current_date_str}.

Process each conversation interaction below and return a JSON object with a "results" array.
For each interaction, provide:
1. "index": integer matching the interaction index.
2. "summary": 1-2 concise sentences summarizing the core question and answer.
3. "keywords": 4 to 8 relevant concept keywords.
4. "is_time_sensitive": boolean (true if the information depends on software library versions, temporary APIs, current pricing/quotas, or ephemeral dates).
5. "temporal_anchor": concise string identifying the temporal context (e.g., "Next.js 13 Pages Router", "Python 3.10 typing", "As of {current_date_str}") or null if invariant (like algorithms, math, general concepts).
6. "deprecation_risk": "high" | "medium" | "low" | "none".
7. "validity_horizon_days": estimated days before this advice may become stale (e.g. 90 for pricing/quotas, 180 for frontend/AI libraries, 365 for general tech, null for invariant).
8. "is_deprecated": boolean. Relative to today ({current_date_str}), has this specific solution or syntax already been deprecated or replaced?
9. "deprecation_reason": short explanation if is_deprecated is true, else null.
10. "suggested_update": short 1-sentence modern replacement if is_deprecated is true, else null.

{chr(10).join(prompt_pairs)}
"""

        try:
            raw_json = self._call_auditor_llm(combined_prompt)
            parsed = json.loads(raw_json)
            results_list = parsed.get("results", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])
            
            # Map results by index
            results_by_idx = {r.get("index", i): r for i, r in enumerate(results_list)}
            
            final_output = []
            for i, pair in enumerate(pairs):
                llm_res = results_by_idx.get(i, {})
                h_res = heuristic_results[i]

                # Blend LLM output with heuristic safety net
                is_sensitive = llm_res.get("is_time_sensitive", h_res["is_time_sensitive"])
                deprecation_risk = llm_res.get("deprecation_risk", h_res["risk"])
                
                final_output.append({
                    "summary": llm_res.get("summary") or f"{pair.get('user', '')[:80]}...",
                    "keywords": llm_res.get("keywords") or [],
                    "is_time_sensitive": bool(is_sensitive),
                    "temporal_anchor": llm_res.get("temporal_anchor") or (", ".join(h_res.get("matched_tech", [])) if is_sensitive else None),
                    "deprecation_risk": deprecation_risk,
                    "validity_horizon_days": llm_res.get("validity_horizon_days") or (180 if is_sensitive else 365),
                    "is_deprecated": bool(llm_res.get("is_deprecated", False)),
                    "deprecation_reason": llm_res.get("deprecation_reason"),
                    "suggested_update": llm_res.get("suggested_update"),
                })
            return final_output

        except Exception as e:
            logger.error(f"Unified audit & summary LLM call failed: {e}. Falling back to heuristic extraction.")
            # Deterministic fallback
            from app.services.chat_importer_service import chat_importer_service
            final_output = []
            for i, pair in enumerate(pairs):
                u = pair.get("user", "")
                a = pair.get("ai", "")
                summary = chat_importer_service.generate_deterministic_summary(u, a)
                keywords = chat_importer_service.extract_keywords(f"{summary} {u}")
                h_res = heuristic_results[i]
                final_output.append({
                    "summary": summary,
                    "keywords": keywords,
                    "is_time_sensitive": h_res["is_time_sensitive"],
                    "temporal_anchor": ", ".join(h_res.get("matched_tech", [])) if h_res["is_time_sensitive"] else None,
                    "deprecation_risk": h_res["risk"],
                    "validity_horizon_days": 180 if h_res["is_time_sensitive"] else 365,
                    "is_deprecated": False,
                    "deprecation_reason": None,
                    "suggested_update": None,
                })
            return final_output

    def audit_and_summarize_session(
        self,
        pairs: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """
        Processes 1 or N conversation pairs for consolidated memory saving:
        Produces an overarching synthesis summary + pair-level micro-summaries and temporal metadata
        in ONE unified LLM call.
        """
        if not pairs:
            return {
                "overarching_summary": "",
                "pair_results": [],
                "aggregated_keywords": [],
                "is_time_sensitive": False,
                "deprecation_risk": "none",
                "temporal_anchor": None,
                "validity_horizon_days": 365,
                "is_deprecated": False,
                "deprecation_reason": None,
                "suggested_update": None,
            }

        time_info = self.get_current_time_grounding()
        current_date_str = time_info["current_date_str"]

        # Run heuristic scan across all pairs
        heuristic_results = []
        for pair in pairs:
            combined_text = f"{pair.get('user', '')}\n{pair.get('ai', '')}"
            h_scan = self.scan_temporal_heuristics(combined_text)
            heuristic_results.append(h_scan)

        prompt_pairs = []
        for i, pair in enumerate(pairs):
            prompt_pairs.append(
                f"### Interaction {i}:\nUser: {pair.get('user', '')}\nAI: {pair.get('ai', '')}"
            )

        if len(pairs) == 1:
            instruction = (
                "Provide an 'overarching_summary' (1-2 sentences summarizing the interaction) and a 'results' array with 1 item."
            )
        else:
            instruction = (
                f"The user has selected {len(pairs)} sequential interactions from a conversation to save as ONE consolidated memory.\n"
                "Provide:\n"
                "1. 'overarching_summary': 2-3 concise sentences synthesizing the global topic, progression, and outcome across all interactions.\n"
                f"2. 'results': An array of analysis objects for each interaction (index 0 to {len(pairs) - 1})."
            )

        combined_prompt = f"""
You are a precise technical memory assistant for CognitiveCanvas.
Today's date is: {current_date_str}.

{instruction}

For each interaction in 'results', provide:
1. "index": integer matching the interaction index.
2. "summary": 1-2 concise sentences summarizing this specific question and answer.
3. "keywords": 3 to 6 relevant concept keywords.
4. "is_time_sensitive": boolean (true if the information depends on software library versions, temporary APIs, current pricing/quotas, or ephemeral dates).
5. "temporal_anchor": concise string identifying the temporal context (e.g., "Next.js 13 Pages Router", "Python 3.10 typing", "As of {current_date_str}") or null if invariant.
6. "deprecation_risk": "high" | "medium" | "low" | "none".
7. "validity_horizon_days": estimated days before this advice may become stale (e.g. 90, 180, 365, or null).
8. "is_deprecated": boolean. Relative to today ({current_date_str}), has this specific solution or syntax already been deprecated or replaced?
9. "deprecation_reason": short explanation if is_deprecated is true, else null.
10. "suggested_update": short 1-sentence modern replacement if is_deprecated is true, else null.

Interactions:
{chr(10).join(prompt_pairs)}
"""

        try:
            raw_json = self._call_auditor_llm(combined_prompt)
            parsed = json.loads(raw_json)
            overarching_summary = parsed.get("overarching_summary", "")
            results_list = parsed.get("results", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])

            results_by_idx = {r.get("index", i): r for i, r in enumerate(results_list)}

            pair_results = []
            all_keywords = []
            for i, pair in enumerate(pairs):
                llm_res = results_by_idx.get(i, {})
                h_res = heuristic_results[i]

                is_sensitive = llm_res.get("is_time_sensitive", h_res["is_time_sensitive"])
                deprecation_risk = llm_res.get("deprecation_risk", h_res["risk"])
                kws = llm_res.get("keywords") or []
                all_keywords.extend(kws)

                pair_results.append({
                    "index": i,
                    "summary": llm_res.get("summary") or f"{pair.get('user', '')[:80]}...",
                    "keywords": kws,
                    "is_time_sensitive": bool(is_sensitive),
                    "temporal_anchor": llm_res.get("temporal_anchor") or (", ".join(h_res.get("matched_tech", [])) if is_sensitive else None),
                    "deprecation_risk": deprecation_risk,
                    "validity_horizon_days": llm_res.get("validity_horizon_days") or (180 if is_sensitive else 365),
                    "is_deprecated": bool(llm_res.get("is_deprecated", False)),
                    "deprecation_reason": llm_res.get("deprecation_reason"),
                    "suggested_update": llm_res.get("suggested_update"),
                })

            if not overarching_summary:
                if len(pair_results) == 1:
                    overarching_summary = pair_results[0]["summary"]
                else:
                    overarching_summary = f"Session covering {pair_results[0]['summary']}"

        except Exception as e:
            logger.error(f"Unified session audit & summary LLM call failed: {e}. Falling back to heuristic extraction.")
            from app.services.chat_importer_service import chat_importer_service
            pair_results = []
            all_keywords = []
            for i, pair in enumerate(pairs):
                u = pair.get("user", "")
                a = pair.get("ai", "")
                summary = chat_importer_service.generate_deterministic_summary(u, a)
                keywords = chat_importer_service.extract_keywords(f"{summary} {u}")
                all_keywords.extend(keywords)
                h_res = heuristic_results[i]
                pair_results.append({
                    "index": i,
                    "summary": summary,
                    "keywords": keywords,
                    "is_time_sensitive": h_res["is_time_sensitive"],
                    "temporal_anchor": ", ".join(h_res.get("matched_tech", [])) if h_res["is_time_sensitive"] else None,
                    "deprecation_risk": h_res["risk"],
                    "validity_horizon_days": 180 if h_res["is_time_sensitive"] else 365,
                    "is_deprecated": False,
                    "deprecation_reason": None,
                    "suggested_update": None,
                })
            overarching_summary = pair_results[0]["summary"] if len(pair_results) == 1 else f"Session covering {pair_results[0]['summary']}"

        # Deduplicate keywords preserving order
        seen_kw = set()
        aggregated_keywords = []
        for kw in all_keywords:
            kw_clean = str(kw).strip()
            if kw_clean and kw_clean.lower() not in seen_kw:
                seen_kw.add(kw_clean.lower())
                aggregated_keywords.append(kw_clean)

        # Aggregate temporal statuses
        has_time_sensitive = any(p["is_time_sensitive"] for p in pair_results)
        has_deprecated = any(p["is_deprecated"] for p in pair_results)

        # Compute max risk
        risk_levels = {"high": 3, "medium": 2, "low": 1, "none": 0}
        max_risk_val = max((risk_levels.get(p.get("deprecation_risk", "none"), 0) for p in pair_results), default=0)
        risk_map_rev = {3: "high", 2: "medium", 1: "low", 0: "none"}
        aggregated_risk = risk_map_rev.get(max_risk_val, "none")

        # Pick first non-empty anchors, reasons, and suggested updates
        first_anchor = next((p["temporal_anchor"] for p in pair_results if p.get("temporal_anchor")), None)
        first_reason = next((p["deprecation_reason"] for p in pair_results if p.get("deprecation_reason")), None)
        first_update = next((p["suggested_update"] for p in pair_results if p.get("suggested_update")), None)

        validity_days = min([p.get("validity_horizon_days") for p in pair_results if p.get("validity_horizon_days")], default=365)

        return {
            "overarching_summary": overarching_summary,
            "pair_results": pair_results,
            "aggregated_keywords": aggregated_keywords[:10],
            "is_time_sensitive": has_time_sensitive,
            "deprecation_risk": aggregated_risk,
            "temporal_anchor": first_anchor,
            "validity_horizon_days": validity_days,
            "is_deprecated": has_deprecated,
            "deprecation_reason": first_reason,
            "suggested_update": first_update,
        }

    def verify_memolet_staleness(self, memolet: Any, db: Session) -> Dict[str, Any]:
        """
        LLM-as-a-Judge Temporal Staleness Verifier:
        Called when an existing memory is retrieved or reused in chat.
        Evaluates whether the memory has become outdated relative to current real-world time.
        """
        time_info = self.get_current_time_grounding()
        current_date_str = time_info["current_date_str"]

        # If not time sensitive, it never deprecates
        if not getattr(memolet, "is_time_sensitive", False):
            return {
                "is_deprecated": False,
                "deprecation_reason": None,
                "suggested_update": None,
            }

        # Check if already verified recently (within last 7 days)
        now_dt = datetime.now(timezone.utc)
        audited_at = getattr(memolet, "audited_at", None)
        if audited_at:
            if audited_at.tzinfo is None:
                audited_at = audited_at.replace(tzinfo=timezone.utc)
            if (now_dt - audited_at).days < 7:
                return {
                    "is_deprecated": memolet.is_deprecated,
                    "deprecation_reason": memolet.deprecation_reason,
                    "suggested_update": memolet.suggested_update,
                }

        # Prompt LLM-as-a-judge
        verify_prompt = f"""
You are a technical software and knowledge auditor.
Today's date is: {current_date_str}.

Analyze the stored conversational memory below:
Memory Text:
{memolet.text[:600]}

Temporal Anchor: {memolet.temporal_anchor or "Unknown"}
Originally Saved At: {memolet.created_at.strftime("%Y-%m-%d") if memolet.created_at else "Unknown"}

Evaluate whether this context is deprecated, superseded, or holding outdated advice as of {current_date_str}.
Return a JSON object with:
{{
  "is_deprecated": boolean,
  "severity": "high" | "medium" | "low" | "none",
  "reason": "Concise explanation of what changed in modern standards",
  "suggested_update": "1-2 sentence recommendation for the modern equivalent as of {current_date_str}"
}}
"""
        try:
            raw_json = self._call_auditor_llm(verify_prompt)
            data = json.loads(raw_json)
            
            memolet.is_deprecated = bool(data.get("is_deprecated", False))
            memolet.deprecation_reason = data.get("reason") if memolet.is_deprecated else None
            memolet.suggested_update = data.get("suggested_update") if memolet.is_deprecated else None
            memolet.audited_at = datetime.utcnow()
            db.commit()

            return {
                "is_deprecated": memolet.is_deprecated,
                "deprecation_reason": memolet.deprecation_reason,
                "suggested_update": memolet.suggested_update,
            }
        except Exception as e:
            logger.warning(f"Temporal staleness verification failed: {e}")
            return {
                "is_deprecated": getattr(memolet, "is_deprecated", False),
                "deprecation_reason": getattr(memolet, "deprecation_reason", None),
                "suggested_update": getattr(memolet, "suggested_update", None),
            }

    def refresh_deprecated_memory(self, memolet: Any, db: Session) -> Dict[str, Any]:
        """
        Self-Correction: Automatically refreshes an outdated memory with current standards,
        regenerating the serialized text, embedding, and Neo4j graph representation.
        """
        from app.services.retrieval import retrieval_service
        from app.db.neo4j import neo4j_connector
        from app.services.graphrag import graphrag_service

        time_info = self.get_current_time_grounding()
        current_date_str = time_info["current_date_str"]

        refresh_prompt = f"""
You are an expert technical editor.
Today's date is: {current_date_str}.

The following conversational memory has become deprecated or outdated:
Original Memory:
{memolet.text}

Deprecation Reason:
{memolet.deprecation_reason or "Outdated library syntax or legacy patterns"}

Rewrite this memory into a modernized, clean user/AI interaction reflecting current {current_date_str} best practices.
Output JSON:
{{
  "summary": "1-2 concise sentences summarizing the modernized solution",
  "user": "The user query (keep original intent)",
  "ai": "The modernized, accurate AI answer using current {current_date_str} standards",
  "keywords": ["keyword1", "keyword2", ...]
}}
"""
        try:
            raw_json = self._call_auditor_llm(refresh_prompt)
            data = json.loads(raw_json)

            summary = data.get("summary", "")
            user_msg = data.get("user", "")
            ai_msg = data.get("ai", "")
            keywords = data.get("keywords", memolet.keywords or [])

            new_serialized_text = f"Summary: {summary}\nUser: {user_msg}\nAI: {ai_msg}"

            # Update DB record
            memolet.text = new_serialized_text
            memolet.keywords = keywords
            memolet.is_deprecated = False
            memolet.deprecation_reason = None
            memolet.suggested_update = None
            memolet.audited_at = datetime.utcnow()
            memolet.temporal_anchor = f"Updated as of {current_date_str}"
            
            # Re-generate embedding
            try:
                memolet.embedding = retrieval_service.encode_text(new_serialized_text)
            except Exception as e:
                logger.warning(f"Re-embedding failed on refresh: {e}")

            db.commit()
            db.refresh(memolet)

            # Update Neo4j Graph
            try:
                with neo4j_connector.get_session() as neo4j_session:
                    graphrag_service.add_concepts_to_graph(neo4j_session, memolet, user_id=str(memolet.user_id))
            except Exception as e:
                logger.warning(f"Neo4j update failed during memory refresh: {e}")

            return {
                "status": "success",
                "id": str(memolet.id),
                "summary": summary,
                "text": new_serialized_text,
                "temporal_anchor": memolet.temporal_anchor,
            }
        except Exception as e:
            logger.error(f"Failed to refresh deprecated memory: {e}")
            raise RuntimeError(f"Memory refresh failed: {str(e)}")


temporal_auditor_service = TemporalAuditorService()
