from pathlib import Path
from utils import clean_subtitle, to_slug, build_output_path, format_md, extract_video_id, pick_transcript_source, normalize_protocol_relative_url


def test_clean_subtitle_vtt_basic():
    raw = (
        "WEBVTT\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "Ola mundo\n\n"
        "00:00:02.000 --> 00:00:04.000\n"
        "Segunda linha\n"
    )
    assert clean_subtitle(raw) == "Ola mundo\nSegunda linha"


def test_clean_subtitle_srt_basic():
    raw = (
        "1\n"
        "00:00:00,000 --> 00:00:02,000\n"
        "Ola mundo\n\n"
        "2\n"
        "00:00:02,000 --> 00:00:04,000\n"
        "Segunda linha\n"
    )
    assert clean_subtitle(raw) == "Ola mundo\nSegunda linha"


def test_clean_subtitle_removes_inline_tags():
    raw = (
        "WEBVTT\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "<c>Ola</c> <00:00:01.000>mundo\n"
    )
    assert clean_subtitle(raw) == "Ola mundo"


def test_clean_subtitle_dedups_consecutive_rolling_captions():
    raw = (
        "WEBVTT\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "Ola mundo\n\n"
        "00:00:01.500 --> 00:00:03.000\n"
        "Ola mundo\n\n"
        "00:00:03.000 --> 00:00:05.000\n"
        "Terceira linha\n"
    )
    assert clean_subtitle(raw) == "Ola mundo\nTerceira linha"


def test_clean_subtitle_ignores_note_and_style_blocks():
    raw = (
        "WEBVTT\n\n"
        "STYLE\n"
        "::cue { color: white; }\n\n"
        "NOTE isto e um comentario\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "Ola mundo\n"
    )
    assert clean_subtitle(raw) == "Ola mundo"


def test_clean_subtitle_strips_utf8_bom():
    raw = (
        "﻿WEBVTT\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "Ola mundo\n"
    )
    assert clean_subtitle(raw) == "Ola mundo"


def test_to_slug_basic():
    assert to_slug("Introdução ao Kubernetes") == "introducao-ao-kubernetes"


def test_build_output_path():
    path = build_output_path(
        output_dir=Path("output"),
        disciplina="Minha Disciplina",
        module_index=1,
        module_name="Módulo Um",
        lesson_index=2,
        lesson_name="Aula Dois",
    )
    assert path == Path("output/minha-disciplina/01-modulo-um/02-aula-dois.md")


def test_format_md():
    md = format_md(
        title="Aula Um",
        module="Módulo Um",
        disciplina="Minha Disciplina",
        content="Texto da legenda limpo.",
    )
    assert md == (
        "# Aula Um\n\n"
        "**Módulo:** Módulo Um  \n"
        "**Disciplina:** Minha Disciplina\n\n"
        "---\n\n"
        "Texto da legenda limpo.\n"
    )


def test_extract_video_id_from_embed_url():
    src = "https://mdstrm.com/embed/69a03edb0a982b6ea69bf8b5?jsapi=true&autoplay=false"
    assert extract_video_id(src) == "69a03edb0a982b6ea69bf8b5"


def test_extract_video_id_returns_none_when_not_mdstrm():
    assert extract_video_id("https://example.com/other") is None


def test_pick_transcript_source_prefers_text_transcription():
    data = {
        "subtitles": [{"language": "pt", "file": "//cdn.example/subs/x.vtt"}],
        "ai": {"transcription": {"textUrl": "//cdn.example/transcription/x.txt"}},
    }
    assert pick_transcript_source(data) == ("text", "//cdn.example/transcription/x.txt")


def test_pick_transcript_source_falls_back_to_vtt():
    data = {
        "subtitles": [{"language": "pt", "file": "//cdn.example/subs/x.vtt"}],
        "ai": {},
    }
    assert pick_transcript_source(data) == ("vtt", "//cdn.example/subs/x.vtt")


def test_pick_transcript_source_returns_none_when_nothing_available():
    assert pick_transcript_source({}) == (None, None)


def test_normalize_protocol_relative_url_adds_https():
    assert normalize_protocol_relative_url("//cdn.example/file.vtt") == "https://cdn.example/file.vtt"


def test_normalize_protocol_relative_url_leaves_absolute_url_untouched():
    assert normalize_protocol_relative_url("https://cdn.example/file.vtt") == "https://cdn.example/file.vtt"
