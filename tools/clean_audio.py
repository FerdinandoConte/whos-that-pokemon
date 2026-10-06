"""Cleanup pipeline for Daniele's recorded Pokémon cries.

Steps per file (only Pokédex numbers inside the requested range):
  1. decode to mono 48 kHz float; if the recording clipped (overloaded),
     rebuild the flattened peaks with ffmpeg adeclip
  2. high-pass at 80 Hz (handling noise, rumble)
  3. spectral gate: noise profile from the quietest frames, gentle subtraction
  4. trim leading/trailing silence with an adaptive threshold, keep short pre/post roll
  5. fade in 8 ms / fade out 60 ms
  6. gentle compression + two-pass EBU R128 loudness normalisation (-16 LUFS, -1 dBTP)
  7. encode mp3 mono 44.1 kHz 80 kbps
A JSON report with before/after measurements is written for the test suite.

Usage: python3 -I clean_audio.py <src_dir> <out_dir> <report.json> [max_id]
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt, stft, istft

SR = 48000
TARGET_LUFS = -16.0
TARGET_TP = -1.0
PRE_ROLL = 0.03
POST_ROLL = 0.12
FADE_IN = 0.008
FADE_OUT = 0.06


def load(path, declip=False):
    af = ["-af", "adeclip"] if declip else []
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, *af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def clipped_samples(x):
    """Samples stuck at full scale: the recording overloaded (digital clipping)."""
    return int((np.abs(x) > 0.995).sum())


def frame_db(x, win=0.02):
    w = int(win * SR)
    n = max(1, len(x) // w)
    fr = x[: n * w].reshape(n, w)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)


def active_region(x):
    """Return (start_s, end_s) of the voiced part using an adaptive threshold."""
    db = frame_db(x)
    floor = np.percentile(db, 10)
    top = np.percentile(db, 98)
    thr = max(floor + 0.40 * (top - floor), top - 30.0)
    act = np.where(db > thr)[0]
    if len(act) == 0:
        return 0.0, len(x) / SR, float(floor), float(top)
    # split into bursts (gap > 100 ms); drop edge blips that are short AND
    # much quieter than the cry itself (taps, breaths, button clicks)
    groups = np.split(act, np.where(np.diff(act) > 5)[0] + 1)
    def keep(g):
        return len(g) >= 3 or db[g].max() > top - 12
    groups = [g for g in groups if keep(g)] or groups
    # a separate, much quieter sound before or after the cry (breath, rustle,
    # hum) is trimmed away; quiet parts between two loud bursts are kept
    loud = [i for i, g in enumerate(groups) if db[g].max() > top - 22]
    if loud:
        groups = groups[loud[0]: loud[-1] + 1]
    return groups[0][0] * 0.02, (groups[-1][-1] + 1) * 0.02, float(floor), float(top)


def spectral_gate(x):
    nper, hop = 1024, 256
    f, t, X = stft(x, fs=SR, nperseg=nper, noverlap=nper - hop, window="hann")
    mag = np.abs(X)
    energy = mag.mean(0)
    quiet = energy <= np.percentile(energy, 15)
    if quiet.sum() < 3:
        return x
    noise = mag[:, quiet].mean(1, keepdims=True)
    noise_sd = mag[:, quiet].std(1, keepdims=True)
    thresh = noise + 1.5 * noise_sd
    gain = np.clip((mag - thresh) / (mag + 1e-12), 0.0, 1.0)
    gain = np.maximum(gain, 0.12)  # never fully mute: avoids "musical noise"
    # smooth mask in time and frequency
    k = np.ones((3, 3)) / 9.0
    from scipy.signal import convolve2d
    gain = convolve2d(gain, k, mode="same", boundary="symm")
    _, y = istft(X * gain, fs=SR, nperseg=nper, noverlap=nper - hop, window="hann")
    return y[: len(x)]


def loudness(path_or_args):
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", path_or_args, "-af",
         "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    p = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", r.stderr)
    return (float(i[-1]) if i else None), (float(p[-1]) if p and p[-1] != "-inf" else None)


def process(args):
    src, dst = args
    pid = int(os.path.basename(src)[:-4])
    x = load(src)
    in_clipped = clipped_samples(x)
    declipped = in_clipped > 5
    if declipped:
        # rebuild the clipped peaks before anything else (ffmpeg adeclip)
        x = load(src, declip=True)
    raw_dur = len(x) / SR
    s0, e0, floor, top = active_region(x)

    sos = butter(4, 80, btype="highpass", fs=SR, output="sos")
    y = sosfiltfilt(sos, x)
    y = spectral_gate(y)

    s, e, _, _ = active_region(y)
    a = max(0, int((s - PRE_ROLL) * SR))
    b = min(len(y), int((e + POST_ROLL) * SR))
    # share of the cry's energy (above the noise floor) that survives the trim
    hp = sosfiltfilt(sos, x)
    noise_pow = 10 ** (floor / 10)
    total = max(1e-12, float((hp ** 2).sum() - noise_pow * len(hp)))
    kept = float((hp[a:b] ** 2).sum() - noise_pow * (b - a))
    retained = max(0.0, min(1.0, kept / total))
    y = y[a:b].copy()
    fi, fo = int(FADE_IN * SR), int(FADE_OUT * SR)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo)

    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "a.wav")
        wavfile.write(wav, SR, (y * 32767).clip(-32768, 32767).astype(np.int16))
        pre = "acompressor=threshold=-24dB:ratio=2.5:attack=5:release=80:makeup=1"
        lim = f"alimiter=limit={10 ** ((TARGET_TP - 0.5) / 20):.4f}:attack=2:release=40:level=false"
        # Gain + limiter, iterated: plain loudnorm cannot reach the target on
        # peaky cries without breaking the true-peak ceiling, a limiter can.
        gain = 0.0
        stage = os.path.join(td, "b.wav")
        for _ in range(3):
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", wav, "-af",
                 f"{pre},volume={gain:.2f}dB,{lim}", stage], check=True)
            measured, _ = loudness(stage)
            if measured is None:
                break
            err = TARGET_LUFS - measured
            if abs(err) < 0.4:
                break
            gain += err
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", stage,
             "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "80k", dst],
            check=True)

    out = load(dst)
    so, eo, floor_o, top_o = active_region(out)
    lufs_in, _ = loudness(src)
    lufs_out, peak_out = loudness(dst)
    return dict(
        id=pid,
        in_dur=round(raw_dur, 3), out_dur=round(len(out) / SR, 3),
        in_lead=round(s0, 3), in_tail=round(raw_dur - e0, 3),
        out_lead=round(so, 3), out_tail=round(len(out) / SR - eo, 3),
        in_voiced=round(e0 - s0, 3), out_voiced=round(eo - so, 3),
        in_snr=round(top - floor, 1), out_snr=round(top_o - floor_o, 1),
        in_lufs=lufs_in, out_lufs=lufs_out, out_peak=peak_out,
        bytes=os.path.getsize(dst),
        trim_start=round(a / SR, 3), trim_end=round(b / SR, 3),
        retained=round(retained, 4),
        in_clipped=in_clipped, declipped=declipped,
    )


def main():
    src, out_dir, report = sys.argv[1], sys.argv[2], sys.argv[3]
    max_id = int(sys.argv[4]) if len(sys.argv) > 4 else 493
    os.makedirs(out_dir, exist_ok=True)
    jobs = []
    for f in sorted(os.listdir(src)):
        if not re.fullmatch(r"\d+\.mp3", f):
            continue
        pid = int(f[:-4])
        if 1 <= pid <= max_id:
            jobs.append((os.path.join(src, f), os.path.join(out_dir, f"{pid}.mp3")))
    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(process, jobs))
    res.sort(key=lambda r: r["id"])
    json.dump(res, open(report, "w"), indent=1)
    print(f"processed {len(res)} files")


if __name__ == "__main__":
    main()
