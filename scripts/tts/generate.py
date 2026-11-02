#!/usr/bin/env python3
import json
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOCALES = ROOT / "web" / "locales"
OUT = ROOT / "web" / "audio"
VOICES = Path(__file__).resolve().parent / ".voices"
PIPER = {"en": "en_GB-alba-medium"}
CORAL = "CoRal-project/roest-v3-chatterbox-500m"


def lines(lang):
    table = json.loads((LOCALES / f"{lang}.json").read_text())
    keys = sorted((k for k in table if re.fullmatch(r"mascot\.\d+", k)), key=lambda k: int(k.split(".")[1]))
    return [(k.replace(".", "_"), table[k]) for k in keys]


def sentences(text):
    return [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]


def to_mp3(wav, mp3):
    mp3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", "loudnorm=I=-18:TP=-2,silenceremove=start_periods=1:start_threshold=-50dB",
                    "-ac", "1", "-ar", "24000", "-b:a", "64k", str(mp3)], check=True)


def run_piper():
    from piper import PiperVoice
    VOICES.mkdir(exist_ok=True)
    for lang, name in PIPER.items():
        if not (VOICES / f"{name}.onnx").exists():
            subprocess.run([sys.executable, "-m", "piper.download_voices", "--download-dir", str(VOICES), name], check=True)
        voice = PiperVoice.load(str(VOICES / f"{name}.onnx"))
        for key, text in lines(lang):
            with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
                with wave.open(tmp.name, "wb") as w:
                    voice.synthesize_wav(text, w)
                to_mp3(Path(tmp.name), OUT / "piper" / lang / f"{key}.mp3")
            print("piper", lang, key, flush=True)


def run_chatterbox():
    import torch
    import torchaudio as ta
    from huggingface_hub import snapshot_download
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    torch.manual_seed(7)
    coral = ChatterboxMultilingualTTS.from_local(
        snapshot_download(CORAL, allow_patterns=["*.safetensors", "*.json", "*.txt", "*.pt", "*.model"]), device="cpu")
    prompt = VOICES / "mascot_prompt.wav"
    VOICES.mkdir(exist_ok=True)
    for lang in ["da"]:
        for key, text in lines(lang):
            parts = []
            for s in sentences(text):
                kwargs = {"audio_prompt_path": str(prompt)} if prompt.exists() else {}
                parts.append(coral.generate(s, language_id=lang, temperature=0.7, **kwargs))
                parts.append(torch.zeros(1, int(coral.sr * 0.25)))
            wav = torch.cat(parts, dim=1)
            if not prompt.exists():
                ta.save(str(prompt), wav, coral.sr)
            with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
                ta.save(tmp.name, wav, coral.sr)
                to_mp3(Path(tmp.name), OUT / "chatterbox" / lang / f"{key}.mp3")
            print("chatterbox", lang, key, flush=True)


if __name__ == "__main__":
    engines = sys.argv[1:] or ["piper", "chatterbox"]
    if "piper" in engines:
        run_piper()
    if "chatterbox" in engines:
        run_chatterbox()
