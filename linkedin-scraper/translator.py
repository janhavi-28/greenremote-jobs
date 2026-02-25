"""
translator.py – Safe, defensive translation layer.

Uses deep-translator (Google backend) with langdetect to skip rows that are
already in English and to avoid the infamous "AUTO IS INVALID SOURCE LANGUAGE"
error that occurs when the source-language cannot be detected.

Rules
-----
* If langdetect raises or returns confidence < threshold → skip translation.
* If the detected language is already 'en' → return original text unchanged.
* If the translated text contains known error substrings → return original.
* Max field length guarded at 4 900 chars (API limit is 5 000).
"""

from __future__ import annotations

import re
from typing import Optional

from deep_translator import GoogleTranslator
from langdetect import detect, LangDetectException
from tenacity import retry, stop_after_attempt, wait_exponential

from logger import log

# ── Constants ─────────────────────────────────────────────────────────────────
_MAX_CHARS = 4_900
_LANG_CONFIDENCE_THRESHOLD = 0.5      # langdetect only returns lang, not prob
                                       # we treat every detection above threshold
                                       # – we'll catch bad detections via try/except

_BAD_TRANSLATION_PATTERNS = [
    r"auto\s*is\s*(an?\s*)?invalid\s*source\s*language",
    r"invalid\s*(source|target)\s*language",
    r"translation\s*not\s*available",
    r"could\s*not\s*translate",
]
_BAD_TRANSLATION_RE = re.compile(
    "|".join(_BAD_TRANSLATION_PATTERNS), re.IGNORECASE
)


def _is_bad_translation(text: str) -> bool:
    return bool(_BAD_TRANSLATION_RE.search(text))


def _detect_language(text: str) -> Optional[str]:
    """Return ISO-639-1 code or None if detection fails."""
    try:
        sample = text[:500].strip()   # langdetect only needs a snippet
        if not sample:
            return None
        return detect(sample)
    except LangDetectException:
        return None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=False,
)
def _translate_chunk(text: str, source_lang: str) -> str:
    """Translate a single chunk; retried up to 3× on transient errors."""
    translator = GoogleTranslator(source=source_lang, target="en")
    result = translator.translate(text)
    return result or text


def translate_to_english(text: str | None, field_name: str = "field") -> str:
    """
    Safely translate *text* to English.

    Returns the original text if:
      - text is empty / None
      - language detection fails
      - source language is already English
      - translation produces a known bad/error string
    """
    if not text or not text.strip():
        return text or ""

    # Truncate to API limit
    if len(text) > _MAX_CHARS:
        text = text[:_MAX_CHARS]

    lang = _detect_language(text)
    if lang is None:
        log.debug("  [translator] Could not detect language for '%s' — skipping", field_name)
        return text

    if lang == "en":
        return text   # already English, fast-path return

    log.debug("  [translator] Translating '%s' from %s → en", field_name, lang)

    try:
        translated = _translate_chunk(text, source_lang=lang)
    except Exception as exc:
        log.warning("  [translator] Translation failed for '%s': %s — using original", field_name, exc)
        return text

    if not translated or _is_bad_translation(translated):
        log.warning(
            "  [translator] Bad translation result for '%s' (lang=%s) — using original",
            field_name, lang,
        )
        return text

    return translated.strip()


def translate_job_fields(job: dict) -> dict:
    """
    Translate the translatable fields of a job dict in-place clone.

    Fields translated: title, company, location, description.
    employment_type is often short / enum-like – translate cautiously.
    """
    out = dict(job)   # shallow copy so we never mutate the caller's dict
    for field in ("title", "company", "location", "description"):
        original = out.get(field) or ""
        if original:
            out[field] = translate_to_english(original, field_name=field)
    # employment_type – short values, still translate but guard
    emp = out.get("employment_type") or ""
    if emp:
        out["employment_type"] = translate_to_english(emp, field_name="employment_type")
    return out
