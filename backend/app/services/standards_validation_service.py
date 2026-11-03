"""Grounded verification for user-added standards metadata."""

from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from urllib.parse import urlparse
import urllib.request
from typing import Any

from app.services.assistant_service import get_llm_config


def validate_standard_entry(entry: dict[str, Any]) -> dict[str, Any]:
    config = get_llm_config()
    if config.get("provider") != "gemini" or not config.get("api_key"):
        return {
            "valid": False,
            "reason": "Standards verification is unavailable: configure Gemini in Settings and retry.",
            "mismatches": [{"field": "verification", "entered": "Save standard", "found": "Gemini with search grounding is not configured."}],
            "found": {},
            "sources": [],
        }

    model = str(config.get("model") or "gemini-2.5-flash").replace("models/", "")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    prompt = """Verify the following standards metadata using Google Search. Search the official standards organization or publisher first. Do not reproduce copyrighted standard text. Confirm identifier, organization, title, version/edition if provided, and source URL if provided. Return only JSON with this shape: {"valid": boolean, "reason": string, "mismatches": [{"field": string, "entered": string, "found": string}], "found": {"identifier": string, "organization": string, "title": string, "version": string, "source_url": string}}. Set valid=true only if reliable search evidence supports the supplied identifier, organization, title and any supplied version/source URL. If uncertain, set valid=false and explain the uncertainty.

Submitted metadata:
""" + json.dumps(entry, ensure_ascii=False)
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "tools": [{"google_search": {}}]}
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": config["api_key"]},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        return {
            "valid": False,
            "reason": f"Could not verify this standard because the search provider failed ({type(exc).__name__}). Retry later.",
            "mismatches": [{"field": "verification", "entered": "Submitted standard", "found": "No verification response was available."}],
            "found": {},
            "sources": [],
        }

    candidate = (response_data.get("candidates") or [{}])[0]
    answer = "\n".join(part.get("text", "") for part in candidate.get("content", {}).get("parts", []) if part.get("text"))
    metadata = candidate.get("groundingMetadata") or {}
    sources = []
    seen: set[str] = set()
    for chunk in metadata.get("groundingChunks", []):
        page = chunk.get("web") or {}
        source_url = page.get("uri")
        if source_url and source_url not in seen:
            seen.add(source_url)
            sources.append({"title": page.get("title") or "Web source", "url": source_url})

    parsed: dict[str, Any] = {}
    try:
        match = re.search(r"\{.*\}", answer, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
    except (json.JSONDecodeError, TypeError):
        parsed = {}

    valid = parsed.get("valid") is True and bool(sources)
    reason = str(parsed.get("reason") or ("No grounded sources were returned." if not sources else "The model did not return a verifiable result."))
    mismatches = parsed.get("mismatches") if isinstance(parsed.get("mismatches"), list) else []
    found = parsed.get("found") if isinstance(parsed.get("found"), dict) else {}
    if valid:
        def compact(value: Any) -> str:
            return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())

        for field, found_field in (("standard_identifier", "identifier"), ("organization", "organization")):
            expected = compact(entry.get(field))
            actual = compact(found.get(found_field))
            org_aliases = {
                "iso": {"iso", "internationalorganizationforstandardization"},
                "ista": {"ista", "internationalsafetransitassociation"},
                "astm": {"astm", "astminternational", "americansocietyfortestingandmaterials"},
            }
            matches = expected in actual or actual in org_aliases.get(expected, set())
            if not expected or not actual or not matches:
                mismatches.append({"field": field, "entered": str(entry.get(field) or ""), "found": str(found.get(found_field) or "No matching value returned")})
        expected_title = str(entry.get("title") or "").casefold().strip()
        actual_title = str(found.get("title") or "").casefold().strip()
        if not actual_title or SequenceMatcher(None, expected_title, actual_title).ratio() < 0.78:
            mismatches.append({"field": "title", "entered": str(entry.get("title") or ""), "found": actual_title or "No matching title returned"})
        if entry.get("version"):
            expected_version, actual_version = compact(entry.get("version")), compact(found.get("version"))
            if not actual_version or expected_version not in actual_version:
                mismatches.append({"field": "version", "entered": str(entry["version"]), "found": str(found.get("version") or "No matching version returned")})
        if entry.get("source_url"):
            submitted_host = (urlparse(str(entry["source_url"])).hostname or "").casefold().removeprefix("www.")
            grounded_hosts = {(urlparse(item["url"]).hostname or "").casefold().removeprefix("www.") for item in sources}
            found_url = str(found.get("source_url") or "")
            found_host = (urlparse(found_url).hostname or "").casefold().removeprefix("www.")
            if not submitted_host or not any(host == submitted_host or host.endswith(f".{submitted_host}") or submitted_host.endswith(f".{host}") for host in grounded_hosts | {found_host} if host):
                mismatches.append({"field": "source_url", "entered": str(entry["source_url"]), "found": found_url or ", ".join(sorted(grounded_hosts)) or "No matching publisher source"})
        if mismatches:
            valid = False
            reason = "The grounded results do not match all submitted standard details."
    if parsed.get("valid") is True and not sources:
        valid = False
        reason = "The model response was not accompanied by grounded source links."
        mismatches = [{"field": "sources", "entered": entry.get("source_url") or "Not provided", "found": "No grounded source links."}]
    if not valid and not mismatches:
        for field, found_field in (("standard_identifier", "identifier"), ("organization", "organization"), ("title", "title"), ("version", "version"), ("source_url", "source_url")):
            entered = entry.get(field)
            if entered:
                mismatches.append({"field": field, "entered": str(entered), "found": str(found.get(found_field) or "Not confirmed by grounded search")})
    return {"valid": valid, "reason": reason, "mismatches": mismatches, "found": found, "sources": sources}
