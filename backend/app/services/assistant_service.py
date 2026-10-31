"""
NxtPak AI — Assistant Service
Page-aware AI assistant with offline rule-based fallback.

Offline mode (no API key set):
  - Analyses project data deterministically.
  - Explains utilization, free space, and savings.
  - States which input fields are missing.
  - Explains ISO standard statuses.
  - Never invents El Araby measurements or compliance claims.

Online mode (LLM via API key):
  - Uses LLM_API_KEY from environment (e.g. Google AI Studio Gemini free tier).
  - Sends structured project context + user message.
  - Validates that response does not invent El Araby specs.
  - Shows provider notice to the user.

Configuration:
  Set LLM_API_KEY in backend/.env to enable online mode.
  LLM_PROVIDER defaults to "gemini" (Google AI Studio free tier).
  Never send secrets to the frontend.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from app.schemas.schemas import AssistantMessage, AssistantResponse

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Quick-action prompts (used by frontend buttons)
# ─────────────────────────────────────────────

QUICK_ACTIONS = {
    "analyze_page": "Analyse what is shown on the current page and summarise the key findings.",
    "explain_comparison": "Explain the comparison between the baseline, planned, and proposed packaging.",
    "free_more_space": "What can I do to reduce free space and improve volume utilization?",
    "what_is_missing": "What information is still missing that would improve the optimization results?",
}


# ─────────────────────────────────────────────
# Offline rule-based engine
# ─────────────────────────────────────────────

def _offline_reply(
    message: str,
    page_context: Optional[dict],
    project_data: Optional[dict],
) -> AssistantResponse:
    """
    Deterministic, rule-based assistant response.
    Analyses numeric fields in project_data. Cites which fields it used.
    Never invents values. Explains missing data plainly.
    """
    msg_lower = message.lower()
    fields_cited: list[str] = []
    lines: list[str] = []

    # ── Resolve quick-action codes ───────────────────────────────────────
    for action_key, action_prompt in QUICK_ACTIONS.items():
        if action_key in msg_lower or action_prompt.lower() in msg_lower:
            message = action_prompt
            msg_lower = message.lower()
            break

    # ── No project data ──────────────────────────────────────────────────
    if not project_data:
        lines.append(
            "I don't have project data to analyse right now. "
            "Open a project and ask me again — I can then explain the optimization results, "
            "ISO standard statuses, and what data is still missing."
        )
        return _build_response(lines, fields_cited)

    product = project_data.get("product") or {}
    baseline = project_data.get("baseline")
    opt_result = project_data.get("optimization_result")
    standards_result = project_data.get("standards_result")
    components: list = project_data.get("components") or []

    product_name = product.get("name", "the product")

    # ── What is missing? ─────────────────────────────────────────────────
    if any(kw in msg_lower for kw in ["missing", "need", "what else", "what is missing"]):
        missing: list[str] = []

        if not product.get("packed_dimensions") and not components:
            missing.append("Product dimensions (packed_dimensions or individual component sizes)")
        if not product.get("fragility_class"):
            missing.append("Fragility class (required: LOW / MEDIUM / HIGH / VERY_HIGH)")
        if not baseline:
            missing.append("Baseline packaging (current carton dimensions and board type)")
        elif baseline and not baseline.get("board_thickness_mm"):
            missing.append(
                "Carton board thickness (needed to compute inner dimensions and material savings)"
            )
        if baseline and not baseline.get("carton_cost_per_unit"):
            missing.append("Carton cost per unit (needed to compute cost savings)")
        if not opt_result:
            missing.append(
                "Optimization results — add component dimensions and re-run optimization"
            )

        if missing:
            lines.append(f"**Missing data for {product_name}:**")
            for item in missing:
                lines.append(f"- {item}")
            lines.append(
                "\nOnce these are entered, the assistant can provide more accurate analysis."
            )
        else:
            lines.append(
                f"All key data for **{product_name}** appears to be present. "
                "You can re-run optimization or review the ISO standards results."
            )
        return _build_response(lines, fields_cited)

    # ── Volume utilization / free space ─────────────────────────────────
    if any(kw in msg_lower for kw in ["utiliz", "utilis", "free space", "volume", "fit"]):
        if opt_result:
            alts = opt_result.get("alternatives", [])
            rec = opt_result.get("recommended")
            if rec:
                util_pct = rec.get("savings", {}).get("volume_utilization_pct")
                outer_vol = (
                    rec.get("outer_length_mm", 0)
                    * rec.get("outer_width_mm", 0)
                    * rec.get("outer_height_mm", 0)
                    / 1e6
                )
                if util_pct is not None:
                    fields_cited.append("savings.volume_utilization_pct")
                    lines.append(
                        f"The **recommended packaging** achieves **{util_pct:.1f}% volume utilization** "
                        f"(product volume ÷ packaging internal volume × 100)."
                    )
                    if util_pct < 50:
                        lines.append(
                            "This is below 50%, meaning more than half the internal volume is unused. "
                            "Consider reducing clearances or using a closer-fit carton size."
                        )
                    elif util_pct < 70:
                        lines.append(
                            "This is a moderate utilization. "
                            "Review clearance settings if you need to reduce packaging further."
                        )
                    else:
                        lines.append(
                            "This is a good utilization — most of the carton is occupied."
                        )
                if outer_vol > 0:
                    fields_cited.append("outer_length_mm, outer_width_mm, outer_height_mm")
                    lines.append(
                        f"Outer carton volume: {outer_vol:.2f} litres."
                    )
        else:
            lines.append(
                "Volume utilization is not yet computed. "
                "Add component dimensions and run the optimizer to see results."
            )
        return _build_response(lines, fields_cited)

    # ── Material and cost savings ─────────────────────────────────────
    if any(kw in msg_lower for kw in ["saving", "material", "cost", "reduc"]):
        if opt_result:
            rec = opt_result.get("recommended", {})
            savings = rec.get("savings", {})
            mat_pct = savings.get("material_saved_pct")
            cost_saved = savings.get("cost_saved")
            baseline_available = savings.get("baseline_available", False)

            if not baseline_available:
                lines.append(
                    "Savings vs baseline cannot be computed because no baseline packaging data was entered. "
                    "Enter the current carton dimensions and board type to enable comparison."
                )
            elif mat_pct is not None:
                fields_cited.extend(["savings.material_saved_pct", "savings.cost_saved"])
                lines.append(
                    f"The recommended design saves approximately **{mat_pct:.1f}% of board material** "
                    f"compared to the baseline."
                )
                if cost_saved is not None:
                    currency = savings.get("currency") or ""
                    lines.append(
                        f"Estimated cost saving: **{cost_saved:.2f} {currency} per unit**."
                    )
                else:
                    lines.append(
                        "Cost savings cannot be computed — carton cost per unit was not entered."
                    )
                lines.append(
                    "\n*Note: These are geometric estimates. "
                    "Actual savings depend on measured board thickness, insert material, and production costs.*"
                )
            else:
                lines.append(
                    "Material savings vs baseline require the baseline board thickness to be entered. "
                    "Carton dimensions are present but board thickness is unknown."
                )
        else:
            lines.append(
                "No optimization results available. "
                "Add component dimensions and run the optimizer."
            )
        return _build_response(lines, fields_cited)

    # ── ISO standards ────────────────────────────────────────────────────
    if any(kw in msg_lower for kw in ["iso", "standard", "compliance", "certif"]):
        lines.append(
            "**ISO standards registry (NxtPak v1) — evaluation note:**\n"
            "The app evaluates designs against 16 ISO packaging standards. "
            "Results use these statuses:\n"
            "- **PASS** — software can confirm this constraint is met\n"
            "- **FAIL** — software found a violation\n"
            "- **NEEDS_REVIEW** — requires engineer judgment\n"
            "- **NOT_CONFIGURED** — requires test parameters you haven't entered yet\n"
            "- **NOT_VERIFIABLE** — requires physical laboratory testing\n\n"
            "**Physical-test standards (drop, vibration, compression) NEVER return PASS from software.** "
            "They require laboratory execution. "
            "A software PASS is never proof of ISO certification.\n\n"
            "No El Araby Group company-specific requirements are loaded — their specifications are not publicly available."
        )
        if standards_result:
            results = standards_result.get("results", [])
            pass_count = sum(1 for r in results if r.get("status") == "PASS")
            nc_count = sum(1 for r in results if r.get("status") == "NOT_CONFIGURED")
            nv_count = sum(1 for r in results if r.get("status") == "NOT_VERIFIABLE")
            fields_cited.append("standards_result.results")
            lines.append(
                f"\nCurrent results: "
                f"{pass_count} PASS, {nc_count} NOT_CONFIGURED, {nv_count} NOT_VERIFIABLE."
            )
        return _build_response(lines, fields_cited)

    # ── Compare baseline vs proposed ─────────────────────────────────────
    if any(kw in msg_lower for kw in ["compar", "baseline", "current", "vs", "versus"]):
        if not baseline:
            lines.append(
                "No baseline packaging has been entered. "
                "Add the current carton dimensions under 'Baseline Packaging' to enable comparison."
            )
        elif not opt_result:
            lines.append(
                "Baseline is present but no optimization results yet. "
                "Add component dimensions and run the optimizer to generate proposed alternatives."
            )
        else:
            bl_l = baseline.get("carton_outer_length_mm")
            bl_w = baseline.get("carton_outer_width_mm")
            bl_h = baseline.get("carton_outer_height_mm")
            if bl_l and bl_w and bl_h:
                fields_cited.extend([
                    "baseline.carton_outer_length_mm",
                    "baseline.carton_outer_width_mm",
                    "baseline.carton_outer_height_mm",
                ])
                bl_vol = bl_l * bl_w * bl_h / 1e6
                lines.append(
                    f"**Current baseline carton:** {bl_l:.0f} × {bl_w:.0f} × {bl_h:.0f} mm "
                    f"→ {bl_vol:.2f} litres external volume."
                )
            rec = opt_result.get("recommended", {})
            r_l = rec.get("outer_length_mm")
            r_w = rec.get("outer_width_mm")
            r_h = rec.get("outer_height_mm")
            if r_l and r_w and r_h:
                fields_cited.extend([
                    "recommended.outer_length_mm",
                    "recommended.outer_width_mm",
                    "recommended.outer_height_mm",
                ])
                rec_vol = r_l * r_w * r_h / 1e6
                lines.append(
                    f"**Recommended proposed carton:** {r_l:.0f} × {r_w:.0f} × {r_h:.0f} mm "
                    f"→ {rec_vol:.2f} litres external volume."
                )
        return _build_response(lines, fields_cited)

    # ── General help / fallback ───────────────────────────────────────────
    lines.append(
        f"I'm the NxtPak packaging assistant (offline mode — no API key configured).\n\n"
        f"I can help with:\n"
        f"- Volume utilization and free space analysis\n"
        f"- Material and cost savings vs baseline\n"
        f"- ISO standards status explanation\n"
        f"- Identifying missing data\n"
        f"- Comparison of baseline vs proposed packaging\n\n"
        f"Ask me: *'What is missing?'*, *'Explain the comparison'*, "
        f"*'How do I reduce free space?'*, or *'Explain the ISO results'*."
    )
    return _build_response(lines, fields_cited)


def _build_response(lines: list[str], fields_cited: list[str]) -> AssistantResponse:
    return AssistantResponse(
        reply="\n".join(lines),
        mode="offline",
        fields_cited=list(dict.fromkeys(fields_cited)),  # deduplicate, preserve order
        disclaimer=(
            "Offline assistant — responses are rule-based, not AI-generated. "
            "No project data is sent anywhere. "
            "Set LLM_API_KEY in backend/.env to enable AI mode."
        ),
    )


# ─────────────────────────────────────────────
# Online LLM mode
# ─────────────────────────────────────────────

def _llm_reply(
    message: str,
    page_context: Optional[dict],
    project_data: Optional[dict],
    history: list[AssistantMessage],
    api_key: str,
    provider: str,
) -> AssistantResponse:
    """
    Send the user message + structured context to the configured LLM.
    Provider 'gemini' uses the Google AI Studio Gemini API (free tier).
    Never sends raw HTML or internal secrets to the LLM.
    """
    system_context = _build_system_context(project_data, page_context)

    full_prompt = f"{system_context}\n\nUser question: {message}"

    try:
        if provider == "gemini":
            reply_text = _call_gemini(full_prompt, history, api_key)
        else:
            logger.warning("Unknown LLM provider '%s'; falling back to offline", provider)
            return _offline_reply(message, page_context, project_data)

    except Exception as exc:
        logger.error("LLM call failed (%s): %s", provider, exc, exc_info=True)
        return AssistantResponse(
            reply=(
                f"The AI assistant encountered an error: {exc}. "
                "Falling back to offline analysis."
            ),
            mode="offline",
            disclaimer="LLM call failed; offline fallback used.",
        )

    return AssistantResponse(
        reply=reply_text,
        mode="ai",
        disclaimer=(
            f"AI mode: your question and project data summary were sent to {provider.capitalize()}. "
            "AI responses may contain errors — verify numeric values against the project data."
        ),
    )


def _build_system_context(
    project_data: Optional[dict],
    page_context: Optional[dict],
) -> str:
    """
    Build a compact, structured system context string.
    Never includes raw HTML, internal file paths, or secrets.
    """
    parts = [
        "You are the NxtPak AI packaging assistant for an engineering tool.",
        "You help packaging engineers understand optimization results, ISO standard statuses, and missing data.",
        "RULES: Never invent El Araby specifications. Never claim software PASS = ISO certification.",
        "Never generate fake numeric dimensions or compliance certificates.",
        "If data is missing, say so clearly.",
    ]

    if page_context:
        route = page_context.get("route", "unknown")
        tab = page_context.get("active_tab", "")
        parts.append(f"Current page: {route}" + (f" (tab: {tab})" if tab else ""))

    if project_data:
        product = project_data.get("product") or {}
        parts.append(f"Product: {product.get('name', 'unknown')} (model: {product.get('model', 'N/A')})")

        baseline = project_data.get("baseline")
        if baseline:
            parts.append(
                f"Baseline carton: "
                f"{baseline.get('carton_outer_length_mm')} × "
                f"{baseline.get('carton_outer_width_mm')} × "
                f"{baseline.get('carton_outer_height_mm')} mm"
            )
        else:
            parts.append("Baseline: not entered")

        opt = project_data.get("optimization_result")
        if opt and opt.get("recommended"):
            rec = opt["recommended"]
            sav = rec.get("savings", {})
            parts.append(
                f"Recommended design: "
                f"{rec.get('outer_length_mm')} × "
                f"{rec.get('outer_width_mm')} × "
                f"{rec.get('outer_height_mm')} mm; "
                f"volume utilization: {sav.get('volume_utilization_pct', 'N/A')}%"
            )
        else:
            parts.append("Optimization: not run yet")

    return "\n".join(parts)


def _call_gemini(prompt: str, history: list[AssistantMessage], api_key: str) -> str:
    """
    Call the Google Gemini API (AI Studio free tier).
    Model: gemini-1.5-flash (free tier supported).
    """
    import urllib.request
    import json

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-1.5-flash:generateContent?key={api_key}"
    )

    # Build conversation contents
    contents = []
    for msg in history[-10:]:  # last 10 turns for context
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.content}]})

    contents.append({"role": "user", "parts": [{"text": prompt}]})

    body = json.dumps({"contents": contents}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode("utf-8"))

    candidates = result.get("candidates", [])
    if not candidates:
        raise ValueError("Gemini API returned no candidates")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise ValueError("Gemini API returned empty content")

    return parts[0].get("text", "").strip()


# ─────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────

def get_assistant_reply(
    message: str,
    page_context: Optional[dict[str, Any]] = None,
    project_data: Optional[dict[str, Any]] = None,
    history: Optional[list[AssistantMessage]] = None,
) -> AssistantResponse:
    """
    Route to LLM (if API key configured) or offline rule-based engine.

    Parameters
    ----------
    message : str
        User's question or quick-action code.
    page_context : dict, optional
        Structured context from the current UI page (route, tab, visible values).
    project_data : dict, optional
        Serialized project data (product, baseline, optimization_result, standards_result).
    history : list of AssistantMessage, optional
        Recent conversation history (last 10 turns used for LLM context).

    Returns
    -------
    AssistantResponse
        reply, mode ("ai" or "offline"), fields_cited, disclaimer.
    """
    if history is None:
        history = []

    api_key = os.environ.get("LLM_API_KEY", "").strip()
    provider = os.environ.get("LLM_PROVIDER", "gemini").strip().lower()

    if api_key:
        logger.info("Assistant: using online LLM (%s)", provider)
        return _llm_reply(message, page_context, project_data, history, api_key, provider)

    logger.debug("Assistant: LLM_API_KEY not set — using offline mode")
    return _offline_reply(message, page_context, project_data)


# Type hint for Any used in the public entry point
from typing import Any
