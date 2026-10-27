"""Transcribe an app recording locally; no model or network downloads at runtime."""
import argparse
import json
import os
import sys
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", required=True)
    args = parser.parse_args()
    if not Path(args.model, "model.bin").is_file():
        raise RuntimeError("Локальная модель распознавания не установлена")
    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    segments, info = model.transcribe(args.audio, language="ru", beam_size=3, vad_filter=True,
                                      condition_on_previous_text=False,
                                      vad_parameters={"min_silence_duration_ms": 500})
    text = " ".join(segment.text.strip() for segment in segments).strip()
    print(json.dumps({"text": text, "duration": info.duration}, ensure_ascii=True), flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=True), flush=True)
        sys.exit(1)
