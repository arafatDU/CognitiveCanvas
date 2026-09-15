import re
import random
import logging
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session

from app.models.memolet import User, Conversation, ChatMessage, Memolet as MemoletModel
from app.services.retrieval import retrieval_service
from app.services.graphrag import graphrag_service
from app.services.temporal_auditor_service import temporal_auditor_service
from app.db.neo4j import neo4j_connector
from app.core.config import settings

logger = logging.getLogger(__name__)

PASTEL_COLORS = [
    "#fef08a", "#fef9c3", "#bbf7d0", "#d9f99d", 
    "#bfdbfe", "#e0f2fe", "#fbcfe8", "#fce7f3", 
    "#e9d5ff", "#f3e8ff", "#fed7aa", "#ffedd5"
]

class ChatImporterService:
    def __init__(self):
        self.user_patterns = [
            re.compile(r"^(?:#{1,6}\s*|\*\*)?(?:You said|You|User|Human|Prompt|Question|Me)(?:\:\*\*|\:|\s*\(.*?\))?\s*$", re.IGNORECASE),
            re.compile(r"^(?:#{1,6}\s*|\*\*)?(?:You said|You|User|Human|Prompt|Question|Me)(?:\:\*\*|\:)\s*(.+)$", re.IGNORECASE),
        ]
        self.ai_patterns = [
            re.compile(r"^(?:#{1,6}\s*|\*\*)?(?:ChatGPT said|ChatGPT|Gemini said|Gemini|Claude said|Claude|Assistant|AI|Bot)(?:\:\*\*|\:|\s*\(.*?\))?\s*$", re.IGNORECASE),
            re.compile(r"^(?:#{1,6}\s*|\*\*)?(?:ChatGPT said|ChatGPT|Gemini said|Gemini|Claude said|Claude|Assistant|AI|Bot)(?:\:\*\*|\:)\s*(.+)$", re.IGNORECASE),
        ]

    def extract_chatgpt_direct(self, html: str) -> Optional[List[Dict[str, str]]]:
        """
        Extracts ALL conversation turns directly from ChatGPT's embedded Turbo-stream / Remix controller.
        Bypasses client-side virtualizer DOM limits (handles 1, 2, 3, 10, 50+ turns dynamically).
        """
        import json
        prefix = "streamController.enqueue("
        idx = html.find(prefix)
        if idx == -1:
            return None
        start = idx + len(prefix)
        try:
            raw_json = json.JSONDecoder().raw_decode(html[start:])[0]
            parsed_array = json.loads(raw_json)
        except Exception as e:
            logger.warning(f"Failed to decode ChatGPT stream controller: {e}")
            return None

        if not isinstance(parsed_array, list):
            return None

        def get_item(i):
            if isinstance(i, int) and 0 <= i < len(parsed_array):
                return parsed_array[i]
            return i

        linear_idx = None
        for i, item in enumerate(parsed_array):
            if item == "linear_conversation" and i + 1 < len(parsed_array):
                linear_idx = parsed_array[i + 1]
                break

        if not linear_idx or not isinstance(linear_idx, list):
            return None

        messages = []
        for node_idx in linear_idx:
            node = get_item(node_idx)
            if not isinstance(node, dict):
                continue
            for k, v in node.items():
                candidate = get_item(v)
                if isinstance(candidate, dict) and any(
                    get_item(int(ck[1:])) == "author"
                    for ck in candidate.keys()
                    if ck.startswith("_") and ck[1:].isdigit()
                ):
                    msg_dict = candidate
                    role = None
                    content_parts = []
                    for mk, mv in msg_dict.items():
                        k_name = get_item(int(mk[1:])) if mk.startswith("_") and mk[1:].isdigit() else mk
                        if k_name == "author":
                            auth_obj = get_item(mv)
                            if isinstance(auth_obj, dict):
                                for ak, av in auth_obj.items():
                                    ak_name = get_item(int(ak[1:])) if ak.startswith("_") and ak[1:].isdigit() else ak
                                    if ak_name == "role":
                                        role = get_item(av)
                        elif k_name == "content":
                            cont_obj = get_item(mv)
                            if isinstance(cont_obj, dict):
                                for ck, cv in cont_obj.items():
                                    ck_name = get_item(int(ck[1:])) if ck.startswith("_") and ck[1:].isdigit() else ck
                                    if ck_name == "parts":
                                        parts_list = get_item(cv)
                                        if isinstance(parts_list, list):
                                            for p in parts_list:
                                                p_val = get_item(p)
                                                if isinstance(p_val, str) and p_val.strip():
                                                    content_parts.append(p_val.strip())
                    if role in ["user", "assistant"] and content_parts:
                        messages.append({"role": role, "text": "\n".join(content_parts)})

        # Pair into sequential (user, ai) turns
        turns = []
        current_user = ""
        for m in messages:
            if m["role"] == "user":
                current_user = m["text"]
            elif m["role"] == "assistant":
                if current_user:
                    turns.append({"user": current_user, "ai": m["text"]})
                    current_user = ""
                elif not current_user and not turns:
                    # If conversation began directly with assistant
                    turns.append({"user": "Initial Request", "ai": m["text"]})

        return turns if turns else None

    def parse_gemini_turns(self, text: str) -> List[Dict[str, str]]:
        """
        Parses Gemini conversation markdown into structured [{'user': '...', 'ai': '...'}] pairs.
        Handles Gemini's '##### You said' pattern followed by full prompt and markdown response blocks.
        """
        parts = re.split(r'\n*#####?\s*You said[^\n]*\n*', text, flags=re.IGNORECASE)
        turns = []
        for p in parts[1:]:
            p_clean = p.strip()
            if not p_clean:
                continue
            blocks = [b.strip() for b in p_clean.split('\n\n') if b.strip()]
            if not blocks:
                continue
            user_prompt = blocks[0]
            ai_blocks = blocks[1:]
            ai_response = '\n\n'.join(ai_blocks).strip()
            ai_response = re.sub(r'\n*Gemini may display inaccurate info.*$', '', ai_response, flags=re.DOTALL)
            ai_response = re.sub(r'\[https://share\.gemini\.google/.*$', '', ai_response, flags=re.DOTALL).strip()
            if user_prompt and ai_response:
                turns.append({
                    'user': user_prompt,
                    'ai': ai_response
                })
        return turns

    def fetch_share_link(self, url: str) -> Dict[str, Any]:
        """
        Fetches content of a public share link from ChatGPT, Gemini, or Claude.
        - Uses direct stream extraction for ChatGPT (all turns dynamically).
        - Resolves canonical skid redirects and uses Puppeteer engine for Google Gemini.
        - Falls back to standard Jina Reader for general links.
        """
        clean_url = url.strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            clean_url = f"https://{clean_url}"

        # 1. Direct Turbo-stream extraction for ChatGPT share links
        if "chatgpt.com/share" in clean_url or "chat.openai.com/share" in clean_url:
            try:
                direct_headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                }
                with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                    resp = client.get(clean_url, headers=direct_headers)
                    if resp.status_code == 200:
                        turns = self.extract_chatgpt_direct(resp.text)
                        if turns:
                            title = "Imported Conversation"
                            t_match = re.search(r"<title>(.*?)</title>", resp.text, re.IGNORECASE)
                            if t_match:
                                raw_title = t_match.group(1).strip()
                                raw_title = re.sub(r"^ChatGPT\s*-\s*", "", raw_title)
                                if raw_title:
                                    title = raw_title
                            return {
                                "turns": turns,
                                "title": title,
                                "url": clean_url,
                                "raw_text": ""
                            }
            except Exception as e:
                logger.warning(f"Direct ChatGPT stream extraction fallback to Jina: {e}")

        # 2. Google Gemini share link handling (resolves redirect & uses puppeteer engine)
        if "share.gemini.google" in clean_url or "gemini.google.com/share" in clean_url:
            try:
                with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                    r = client.get(clean_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
                    canonical_url = str(r.url)

                jina_url = f"https://r.jina.ai/{canonical_url}"
                headers = {
                    "X-Engine": "puppeteer",
                    "Accept": "text/plain",
                    "User-Agent": "Mozilla/5.0",
                }
                with httpx.Client(timeout=45.0, follow_redirects=True) as client:
                    resp = client.get(jina_url, headers=headers)
                    if resp.status_code == 200:
                        turns = self.parse_gemini_turns(resp.text)
                        if turns:
                            words = turns[0]["user"].split()[:7]
                            title = " ".join(words) + ("..." if len(words) == 7 else "")
                            return {
                                "turns": turns,
                                "title": title,
                                "url": canonical_url,
                                "raw_text": ""
                            }
            except Exception as e:
                logger.warning(f"Gemini puppeteer extraction fallback to standard Jina: {e}")

        # 3. Resilient Jina Reader fetch for other providers or fallbacks
        jina_url = f"https://r.jina.ai/{clean_url}"
        headers = {
            "Accept": "text/plain",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Memolet-Importer/1.0",
        }

        try:
            with httpx.Client(timeout=35.0, follow_redirects=True) as client:
                resp = client.get(jina_url, headers=headers)
                if resp.status_code != 200:
                    raise ValueError(f"Failed to fetch content via Jina Reader (HTTP {resp.status_code})")
                
                raw_text = resp.text

                # Extract title from Jina Reader metadata header if present
                title = "Imported Conversation"
                title_match = re.search(r"^Title:\s*(.+)$", raw_text, flags=re.MULTILINE)
                if title_match:
                    extracted_title = title_match.group(1).strip()
                    if extracted_title and extracted_title.lower() != "check out this chat":
                        title = extracted_title

                return {
                    "raw_text": raw_text,
                    "title": title,
                    "url": clean_url
                }
        except httpx.RequestError as e:
            logger.error(f"Network error fetching share link {url}: {e}")
            raise ValueError(f"Could not reach share link: {str(e)}")

    def parse_turns_from_text(self, text: str) -> List[Dict[str, str]]:
        """
        Deterministic Conversation State Machine (DCSM):
        Parses multi-turn conversations into [{'user': '...', 'ai': '...'}] pairs with 100% precision.
        Preserves multi-line code blocks and ignores speaker words inside code fences.
        """
        lines = text.splitlines()
        turns = []
        
        current_role = None  # 'user' or 'ai'
        current_content = []
        current_pair = {"user": "", "ai": ""}
        in_code_block = False

        def flush_turn():
            nonlocal current_role, current_content, current_pair
            if current_role == "user":
                current_pair["user"] = "\n".join(current_content).strip()
            elif current_role == "ai":
                current_pair["ai"] = "\n".join(current_content).strip()
                if current_pair["ai"]:
                    # Clean up common platform footer noise
                    cleaned_ai = current_pair["ai"]
                    cleaned_ai = re.sub(r"\n*!\[Image \d+\].*$", "", cleaned_ai, flags=re.DOTALL)
                    cleaned_ai = re.sub(r"\n*Sources\n*ChatGPT is AI and can make mistakes\..*$", "", cleaned_ai, flags=re.DOTALL)
                    cleaned_ai = re.sub(r"\n*Gemini may display inaccurate info.*$", "", cleaned_ai, flags=re.DOTALL)
                    current_pair["ai"] = cleaned_ai.strip()
                    
                    if not current_pair["user"] and not turns:
                        current_pair["user"] = "Initial Request"

                    if current_pair["user"] and current_pair["ai"]:
                        turns.append(dict(current_pair))
                    current_pair = {"user": "", "ai": ""}
            current_content = []

        for line in lines:
            stripped = line.strip()
            
            # Toggle code block boundary
            if stripped.startswith("```"):
                in_code_block = not in_code_block
                if current_role:
                    current_content.append(line)
                continue
                
            # If inside a code fence, lines are never speaker headers
            if in_code_block:
                if current_role:
                    current_content.append(line)
                continue

            if not stripped:
                if current_role:
                    current_content.append(line)
                continue
                
            # Check User role header
            user_matched = False
            for pat in self.user_patterns:
                m = pat.match(stripped)
                if m:
                    flush_turn()
                    current_role = "user"
                    user_matched = True
                    if m.groups() and m.group(1):
                        current_content.append(m.group(1).strip())
                    break
            if user_matched:
                continue
                
            # Check AI role header
            ai_matched = False
            for pat in self.ai_patterns:
                m = pat.match(stripped)
                if m:
                    flush_turn()
                    current_role = "ai"
                    ai_matched = True
                    if m.groups() and m.group(1):
                        current_content.append(m.group(1).strip())
                    break
            if ai_matched:
                continue
                
            if current_role:
                current_content.append(line)
                
        flush_turn()
        return turns

    def generate_deterministic_summary(self, user_msg: str, ai_msg: str) -> str:
        """
        Instant Zero-LLM Lead Summarization:
        Constructs a concise, high-utility summary from prompt intent and the first conclusive AI sentence.
        """
        # 1. Clean user intent
        clean_user = re.sub(r"^(?:can you |please |could you |give me |explain |how to )", "", user_msg.strip(), flags=re.IGNORECASE)
        clean_user = clean_user[:90].strip()

        # 2. Extract first 1-2 sentences of AI response (skip markdown headers)
        ai_lines = [l.strip() for l in ai_msg.splitlines() if l.strip() and not l.strip().startswith("#")]
        ai_lead = ""
        if ai_lines:
            first_para = ai_lines[0]
            sentences = [s.strip() for s in re.split(r"(?<=[.?!])\s+", first_para) if len(s.strip()) > 5]
            if sentences:
                ai_lead = sentences[0]
            else:
                ai_lead = first_para[:120]
        else:
            ai_lead = ai_msg[:120].strip()

        return f"User asked about {clean_user}. AI explained that {ai_lead.strip('.,;:')}."

    def extract_keywords(self, text: str) -> List[str]:
        """
        Fast deterministic keyword & concept extractor without external API calls.
        """
        words = re.findall(r"\b[A-Za-z0-9_-]{4,20}\b", text)
        stopwords = {
            "this", "that", "with", "from", "your", "have", "more", "will", "what", "when", 
            "where", "which", "there", "their", "about", "would", "could", "should", "using",
            "said", "chatgpt", "gemini", "claude", "response", "answer", "user", "prompt"
        }
        unique_keywords = []
        for w in words:
            wl = w.lower()
            if wl not in stopwords and wl not in [k.lower() for k in unique_keywords]:
                unique_keywords.append(w)
            if len(unique_keywords) >= 8:
                break
        return unique_keywords

    def commit_imported_chat(
        self,
        db: Session,
        current_user: User,
        title: Optional[str],
        turns: List[Dict[str, str]],
        create_conversation: bool = True,
        save_to_memory: bool = True,
        generate_ai_summary: bool = False,
    ) -> Dict[str, Any]:
        """
        Dual-Destination Persistence:
        1. Creates Conversation and ChatMessages in PostgreSQL for immediate 11th turn continuation.
        2. Indexes turns into PostgreSQL pgvector memolets and Neo4j GraphRAG for long-term memory.
        """
        if not turns:
            raise ValueError("No conversation turns provided to import.")

        conversation_id = None
        conv_title = title.strip() if title and title.strip() else None

        # --- Destination 1: Conversation & Chat Messages ---
        if create_conversation:
            if not conv_title:
                # Derive title from first user prompt
                first_prompt = turns[0].get("user", "")
                words = first_prompt.split()
                conv_title = " ".join(words[:6]) + ("..." if len(words) > 6 else "")

            conversation = Conversation(
                user_id=current_user.id,
                title=conv_title
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            conversation_id = str(conversation.id)

            # Insert sequential chat messages
            for turn in turns:
                u_text = turn.get("user", "").strip()
                a_text = turn.get("ai", "").strip()

                if u_text:
                    db.add(ChatMessage(
                        conversation_id=conversation.id,
                        role="user",
                        content=u_text
                    ))
                if a_text:
                    db.add(ChatMessage(
                        conversation_id=conversation.id,
                        role="ai",
                        content=a_text
                    ))
            db.commit()

        # --- Destination 2: Long-Term Memory (Postgres pgvector + Neo4j Graph) ---
        saved_memolets = []
        if save_to_memory:
            # Single-pass unified Summarization & Temporal Deprecation Audit
            audited_metadata = []
            if generate_ai_summary and settings.GEMINI_API_KEY:
                try:
                    audited_metadata = temporal_auditor_service.audit_and_summarize_pairs(turns)
                except Exception as e:
                    logger.warning(f"AI batched audit fallback during import: {e}")
                    audited_metadata = []

            with neo4j_connector.get_session() as neo4j_session:
                for idx, turn in enumerate(turns):
                    u_text = turn.get("user", "").strip()
                    a_text = turn.get("ai", "").strip()
                    if not u_text and not a_text:
                        continue

                    meta = audited_metadata[idx] if idx < len(audited_metadata) else None
                    if meta:
                        summary = meta.get("summary") or self.generate_deterministic_summary(u_text, a_text)
                        keywords = meta.get("keywords") or self.extract_keywords(f"{summary} {u_text}")
                        is_sensitive = meta.get("is_time_sensitive", False)
                        dep_risk = meta.get("deprecation_risk", "none")
                        temp_anchor = meta.get("temporal_anchor")
                        validity_days = meta.get("validity_horizon_days", 365)
                        is_dep = meta.get("is_deprecated", False)
                        dep_reason = meta.get("deprecation_reason")
                        sug_update = meta.get("suggested_update")
                    else:
                        summary = self.generate_deterministic_summary(u_text, a_text)
                        keywords = self.extract_keywords(f"{summary} {u_text}")
                        h_res = temporal_auditor_service.scan_temporal_heuristics(f"{u_text}\n{a_text}")
                        is_sensitive = h_res["is_time_sensitive"]
                        dep_risk = h_res["risk"]
                        temp_anchor = ", ".join(h_res.get("matched_tech", [])) if is_sensitive else None
                        validity_days = 180 if is_sensitive else 365
                        is_dep = False
                        dep_reason = None
                        sug_update = None

                    serialized_text = f"Summary: {summary}\nUser: {u_text}\nAI: {a_text}"

                    # Generate vector embedding locally
                    try:
                        embedding = retrieval_service.encode_text(serialized_text)
                    except Exception as e:
                        logger.warning(f"Embedding generation warning: {e}")
                        embedding = None

                    assigned_color = random.choice(PASTEL_COLORS)

                    db_memolet = MemoletModel(
                        user_id=current_user.id,
                        conversation_id=conversation.id if create_conversation else None,
                        text=serialized_text,
                        keywords=keywords,
                        embedding=embedding,
                        color=assigned_color,
                        is_time_sensitive=is_sensitive,
                        deprecation_risk=dep_risk,
                        temporal_anchor=temp_anchor,
                        validity_horizon_days=validity_days,
                        is_deprecated=is_dep,
                        deprecation_reason=dep_reason,
                        suggested_update=sug_update,
                    )
                    db.add(db_memolet)
                    db.commit()
                    db.refresh(db_memolet)

                    # Update Neo4j Graph with user_id multi-tenancy
                    try:
                        graphrag_service.add_concepts_to_graph(neo4j_session, db_memolet, user_id=str(current_user.id))
                    except Exception as e:
                        logger.warning(f"Neo4j concept update failed for memolet {db_memolet.id}: {e}")

                    saved_memolets.append({
                        "id": str(db_memolet.id),
                        "summary": summary,
                        "color": assigned_color,
                        "is_time_sensitive": db_memolet.is_time_sensitive,
                        "is_deprecated": db_memolet.is_deprecated,
                    })

        return {
            "conversation_id": conversation_id,
            "title": conv_title,
            "total_turns": len(turns),
            "saved_memolets_count": len(saved_memolets),
            "saved_memolets": saved_memolets
        }

chat_importer_service = ChatImporterService()
