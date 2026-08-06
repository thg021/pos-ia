import re
from pathlib import Path
from slugify import slugify

_TIMESTAMP_RE = re.compile(r"\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}")
# SEQUENCE_RE matches all-digit lines (SRT cue indices, WebVTT numeric cue identifiers).
# Edge cases (known limitations, not fixed):
#   - Bare numeric captions (e.g., a caption that is just "42") will be incorrectly dropped.
#   - Non-numeric WebVTT cue identifiers (e.g., "cue-1" before a timestamp) will leak into output.
_SEQUENCE_RE = re.compile(r"^\d+$")
_TAG_RE = re.compile(r"<[^>]+>")
_MDSTRM_EMBED_RE = re.compile(r"mdstrm\.com/embed/([a-f0-9]+)")


def clean_subtitle(raw: str) -> str:
    # Strip UTF-8 BOM if present (common in VTT files fetched from the web)
    raw = raw.lstrip("﻿")

    lines: list[str] = []
    in_style_block = False

    for line in raw.splitlines():
        stripped = line.strip()

        if not stripped:
            in_style_block = False
            continue
        if stripped == "WEBVTT":
            continue
        if stripped.startswith("NOTE"):
            continue
        if stripped == "STYLE":
            in_style_block = True
            continue
        if in_style_block:
            continue
        if _TIMESTAMP_RE.search(stripped):
            continue
        if _SEQUENCE_RE.match(stripped):
            continue

        clean_line = _TAG_RE.sub("", stripped).strip()
        if not clean_line:
            continue
        if lines and lines[-1] == clean_line:
            continue
        lines.append(clean_line)

    return "\n".join(lines)


def to_slug(text: str) -> str:
    return slugify(text, allow_unicode=False, separator="-")


def format_md(title: str, module: str, disciplina: str, content: str) -> str:
    return (
        f"# {title}\n\n"
        f"**Módulo:** {module}  \n"
        f"**Disciplina:** {disciplina}\n\n"
        f"---\n\n"
        f"{content}\n"
    )


def build_output_path(
    output_dir: Path,
    disciplina: str,
    module_index: int,
    module_name: str,
    lesson_index: int,
    lesson_name: str,
) -> Path:
    disciplina_dir = to_slug(disciplina)
    module_dir = f"{module_index:02d}-{to_slug(module_name)}"
    lesson_file = f"{lesson_index:02d}-{to_slug(lesson_name)}.md"
    return output_dir / disciplina_dir / module_dir / lesson_file


def extract_video_id(iframe_src: str) -> str | None:
    match = _MDSTRM_EMBED_RE.search(iframe_src)
    return match.group(1) if match else None


def pick_transcript_source(mdstrm_json: dict) -> tuple[str, str] | tuple[None, None]:
    ai = mdstrm_json.get("ai") or {}
    transcription = ai.get("transcription") or {}
    text_url = transcription.get("textUrl")
    if text_url:
        return ("text", text_url)

    subtitles = mdstrm_json.get("subtitles") or []
    if subtitles:
        file_url = subtitles[0].get("file")
        if file_url:
            return ("vtt", file_url)

    return (None, None)


def normalize_protocol_relative_url(url: str) -> str:
    if url.startswith("//"):
        return "https:" + url
    return url
