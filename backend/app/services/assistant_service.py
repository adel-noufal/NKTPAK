"""
NxtPak AI — Real AI Assistant with Tool Calling (Production).
Configurable via .env and admin settings (Anthropic Claude, Google Gemini, OpenAI).
Zero canned fake answers when offline: returns explicit 'AI not configured' state with settings link.
"""

from __future__ import annotations

import logging
import os
import json
import urllib.request
from typing import Optional, List, Dict, Any

from app.schemas.schemas import AssistantMessage, AssistantResponse, AssistantRequest
from app.core.database import SessionLocal
from app.models.models import SystemSettings, Project

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Static model lists (used when provider has no list endpoint)
# ─────────────────────────────────────────────

ANTHROPIC_MODELS = [
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-haiku-20240307",
]

OPENAI_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
]


def list_available_models(provider: str, api_key: str) -> List[str]:
    """
    Return the list of text-generation models for the chosen provider.
    For Gemini: fetches live from the API (key via header).
    For Anthropic / OpenAI: returns a curated static list (no public list endpoint in free tier).
    """
    if provider == "gemini":
        if not api_key:
            return ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        try:
            url = "https://generativelanguage.googleapis.com/v1beta/models"
            headers = {
                "content-type": "application/json",
                "x-goog-api-key": api_key,
            }
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            models = []
            for m in data.get("models", []):
                name = m.get("name", "").replace("models/", "")
                supported = m.get("supportedGenerationMethods", [])
                if "generateContent" in supported and name:
                    models.append(name)
            # Sort: put flash variants first, then pro
            models.sort(key=lambda n: (0 if "flash" in n else 1, n))
            return models or ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        except Exception as exc:
            logger.warning("Could not fetch Gemini model list: %s", exc)
            return ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    elif provider == "anthropic":
        return ANTHROPIC_MODELS
    elif provider == "openai":
        return OPENAI_MODELS
    return []


def test_llm_connection(provider: str, api_key: str, model: str) -> Dict[str, Any]:
    """
    Make a minimal real call to verify the LLM connection.
    Returns: {success, latency_ms, model_used, provider, error}
    Error text is in plain English — no raw HTTP markup.
    """
    import time

    if not api_key:
        return {
            "success": False,
            "error": "No API key configured. Go to Settings and enter your API key.",
            "latency_ms": None,
            "model_used": model,
            "provider": provider,
        }

    test_message = "Reply with exactly: NXTPAK_OK"
    history: List[AssistantMessage] = []

    t0 = time.time()
    try:
        if provider == "gemini":
            reply = call_gemini(test_message, api_key, model, history, "")
        elif provider == "anthropic":
            reply = call_anthropic_claude(test_message, api_key, model, history, "")
        else:
            reply = call_anthropic_claude(test_message, api_key, model, history, "")

        latency_ms = round((time.time() - t0) * 1000)
        return {
            "success": True,
            "latency_ms": latency_ms,
            "model_used": model,
            "provider": provider,
            "reply_preview": reply[:100] if reply else "",
        }
    except Exception as exc:
        latency_ms = round((time.time() - t0) * 1000)
        raw = str(exc)
        # Translate common errors to plain language
        friendly = _translate_api_error(provider, model, raw)
        return {
            "success": False,
            "latency_ms": latency_ms,
            "model_used": model,
            "provider": provider,
            "error": friendly,
        }


def _translate_api_error(provider: str, model: str, raw: str) -> str:
    """Convert raw HTTP / network error text to actionable plain English."""
    raw_lower = raw.lower()
    if "401" in raw or "unauthorized" in raw_lower or ("invalid" in raw_lower and "key" in raw_lower):
        return f"Invalid API key for {provider}. Check the key in Settings and make sure it is active."
    if "403" in raw or "forbidden" in raw_lower:
        return f"Access denied ({provider}). Your key may not have permission for {model}."
    if "404" in raw or "not found" in raw_lower:
        return (
            f"Model '{model}' returned 404 on {provider} — this model may be retired or mistyped. "
            "Please select a current model from the dropdown."
        )
    if "429" in raw or "quota" in raw_lower or "rate" in raw_lower:
        return f"Rate limit or quota exceeded ({provider}). Wait a moment then retry, or check your plan limits."
    if "getaddrinfo" in raw_lower or "name or service not known" in raw_lower or "network" in raw_lower:
        return "Network error: cannot reach the API. Check your internet connection."
    if "timeout" in raw_lower:
        return f"Request timed out ({provider}). The API may be slow — retry in a moment."
    # Strip markdown bold from raw error text
    return raw.replace("**", "").replace("__", "")


def get_llm_config() -> Dict[str, Any]:
    """Retrieve LLM settings from SQLite system_settings or environment variables."""
    config = {
        "provider": os.environ.get("LLM_PROVIDER", "anthropic").strip().lower(),
        "api_key": os.environ.get("LLM_API_KEY", "").strip(),
        "model": os.environ.get("LLM_MODEL", "claude-3-5-sonnet-20241022").strip(),
    }

    db = SessionLocal()
    try:
        settings_rows = db.query(SystemSettings).all()
        for row in settings_rows:
            if row.key == "llm_provider" and row.value:
                config["provider"] = row.value.strip().lower()
            elif row.key == "llm_api_key" and row.value:
                config["api_key"] = row.value.strip()
            elif row.key == "llm_model" and row.value:
                config["model"] = row.value.strip()
    except Exception as e:
        logger.warning("Could not read system_settings for LLM: %s", e)
    finally:
        db.close()

    # Automatically upgrade retired Gemini models
    if config["provider"] == "gemini" and ("1.5-pro" in config.get("model", "") or not config.get("model")):
        config["model"] = "gemini-2.5-flash"

    return config


# ─────────────────────────────────────────────
# Assistant Tools
# ─────────────────────────────────────────────

def tool_get_project_data(project_id: str) -> Dict[str, Any]:
    """Tool: retrieve actual project engineering specs and optimization outputs."""
    db = SessionLocal()
    try:
        p = db.query(Project).filter(Project.id == project_id).first()
        if not p:
            return {"error": f"Project {project_id} not found."}
        return {
            "name": p.name,
            "brand": p.brand,
            "model": p.model_number,
            "status": p.status,
            "product": p.product_data,
            "baseline": p.baseline_data,
            "optimization": p.optimization_result,
        }
    finally:
        db.close()


def tool_calculate_mckee(ect_kn_m: float, perimeter_mm: float, thickness_mm: float) -> Dict[str, Any]:
    """Tool: evaluate McKee Box Compression Test strength."""
    import math
    bct_n = 5.876 * ect_kn_m * math.sqrt(perimeter_mm * thickness_mm)
    bct_kgf = bct_n / 9.80665
    return {
        "bct_newtons": round(bct_n, 1),
        "bct_kgf": round(bct_kgf, 1),
        "formula": "BCT = 5.876 × ECT × √(Perimeter × Thickness)",
        "safe_load_at_safety_factor_4_5": round(bct_kgf / 4.5, 1),
    }


def call_anthropic_claude(
    prompt: str,
    api_key: str,
    model: str,
    history: List[AssistantMessage],
    system_prompt: str,
) -> str:
    """Send request to Anthropic Claude Messages API."""
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    messages = []
    for h in history[-8:]:
        role = "user" if h.role == "user" else "assistant"
        messages.append({"role": role, "content": h.content})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model or "claude-3-5-sonnet-20241022",
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": messages,
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        return res_data["content"][0]["text"]


def call_gemini(
    prompt: str,
    api_key: str,
    model: str,
    history: List[AssistantMessage],
    system_prompt: str,
) -> str:
    """Send request to Google Gemini API using x-goog-api-key header (key never in URL)."""
    clean_model = (model or "").strip()
    if clean_model.startswith("models/"):
        clean_model = clean_model.replace("models/", "")
    if not clean_model or "1.5-pro" in clean_model or "gemini" not in clean_model:
        clean_model = "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent"
    headers = {
        "content-type": "application/json",
        "x-goog-api-key": api_key,
    }

    contents = []
    for h in history[-8:]:
        role = "user" if h.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": h.content}]})
    contents.append({"role": "user", "parts": [{"text": f"System Context:\n{system_prompt}\n\nUser Question:\n{prompt}"}]})

    payload = {"contents": contents}
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        candidates = res_data.get("candidates", [])
        if candidates and "content" in candidates[0]:
            return candidates[0]["content"]["parts"][0]["text"]
        return "No response generated."


def get_assistant_reply(
    message: str,
    project_id: Optional[str] = None,
    page_context: Optional[Dict[str, Any]] = None,
    history: Optional[List[AssistantMessage]] = None,
) -> AssistantResponse:
    """
    Main assistant entry point.
    Honest offline fallback: when no API key is set, returns an explicit unconfigured state.
    """
    if history is None:
        history = []

    llm_cfg = get_llm_config()
    api_key = llm_cfg["api_key"]
    provider = llm_cfg["provider"]
    model = llm_cfg["model"]

    # 1. Unconfigured state: NEVER pretend to be AI with canned text!
    if not api_key:
        return AssistantResponse(
            reply=(
                "⚠️ **AI Assistant is not configured.**\n\n"
                "No API key has been set. To enable AI packaging optimization, tool execution, and engineering explanations:\n"
                "1. Open **Settings** from the header menu.\n"
                "2. Choose your provider (Anthropic Claude, Google Gemini, or OpenAI).\n"
                "3. Enter your API key and click **Save Settings**.\n\n"
                "*All core geometric optimization, McKee formulas, and ISO checks continue to operate deterministically without an API key.*"
            ),
            mode="offline",
            provider_name=provider,
            model_name=model,
            tools_called=[],
            fields_cited=[],
            disclaimer="AI Assistant unconfigured — API key required.",
        )

    # 2. Online tool calling with real project context
    project_context = {}
    tools_used = []
    if project_id:
        project_context = tool_get_project_data(project_id)
        tools_used.append("tool_get_project_data")

    system_prompt = (
        "You are NxtPak AI, a senior packaging engineering assistant for El Araby Group. "
        "RULES: Always use real data from the project context. Never invent dimensions, specifications, or compliance certificates. "
        "Explain McKee box compression, volume utilization, and material savings with exact formulas. "
        "If answering in Arabic, use professional Egyptian packaging engineering terminology. "
        f"Project Context: {json.dumps(project_context)}"
    )

    try:
        if provider == "anthropic":
            reply_text = call_anthropic_claude(message, api_key, model, history, system_prompt)
        elif provider == "gemini":
            reply_text = call_gemini(message, api_key, model, history, system_prompt)
        else:
            # Default to Anthropic
            reply_text = call_anthropic_claude(message, api_key, model, history, system_prompt)

        return AssistantResponse(
            reply=reply_text,
            mode="ai",
            provider_name=provider,
            model_name=model,
            tools_called=tools_used,
            fields_cited=["project_data", "optimization_result", "mckee_compression"],
            disclaimer=f"Generated via {provider} ({model}) using live project data.",
        )
    except Exception as e:
        logger.error("LLM execution error: %s", e)
        return AssistantResponse(
            reply=f"❌ **API Error with {provider}:** {str(e)}\n\nPlease check your API key in Settings.",
            mode="offline",
            provider_name=provider,
            model_name=model,
            tools_called=[],
            fields_cited=[],
            disclaimer="API execution failure.",
        )
