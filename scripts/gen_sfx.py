"""Procedural sound-effect library for NeuroCast (royalty-free, generated).

usage: python scripts/gen_sfx.py            -> writes public/sfx/*.wav
Names must match src/lib/sfx.tsx (SFX table). Replace any file with your own sound of the same name.
"""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "sfx")
rng = np.random.default_rng(7)


def t_(dur):
    return np.arange(int(SR * dur)) / SR


def env_ar(n, a, r, curve=2.0):
    """attack fraction a, release fraction r (of n samples)"""
    x = np.linspace(0, 1, n)
    e = np.ones(n)
    ai = max(1, int(n * a))
    e[:ai] = np.linspace(0, 1, ai) ** curve
    ri = max(1, int(n * r))
    e[-ri:] = np.linspace(1, 0, ri) ** curve
    return e


def sweep_noise(dur, f0, f1, width=0.35, f_mid=None):
    """band-passed noise whose centre frequency glides f0 -> (f_mid) -> f1, via STFT masking"""
    n = int(SR * dur)
    x = rng.standard_normal(n + 2048)
    f, tt, Z = signal.stft(x, SR, nperseg=1024)
    k = np.linspace(0, 1, Z.shape[1])
    if f_mid is None:
        fc = f0 * (f1 / f0) ** k
    else:
        fc = np.where(k < 0.5, f0 * (f_mid / f0) ** (k * 2), f_mid * (f1 / f_mid) ** ((k - 0.5) * 2))
    lf = np.log(np.maximum(f, 1))[:, None]
    mask = np.exp(-((lf - np.log(fc)[None, :]) ** 2) / (2 * width ** 2))
    _, y = signal.istft(Z * mask, SR, nperseg=1024)
    y = y[:n]
    return y / (np.abs(y).max() + 1e-9)


def pan(mono, p):
    """p in [-1,1] scalar or per-sample array -> stereo"""
    p = np.broadcast_to(p, mono.shape)
    l = mono * np.sqrt((1 - p) / 2)
    r = mono * np.sqrt((1 + p) / 2)
    return np.stack([l, r], 1)


def bell(f0, dur, partials=((1, 1, 0.9), (2.76, 0.5, 0.5), (5.4, 0.25, 0.3), (8.93, 0.12, 0.2)), attack=0.003):
    t = t_(dur)
    y = np.zeros_like(t)
    for m, a, tau in partials:
        y += a * np.sin(2 * np.pi * f0 * m * t) * np.exp(-t / tau)
    y *= np.minimum(1, t / attack)
    return y


def click(dur=0.03, fc=3000, tau=0.006):
    t = t_(dur)
    n = rng.standard_normal(len(t))
    b, a = signal.butter(2, [fc * 0.6 / (SR / 2), min(0.99, fc * 1.6 / (SR / 2))], "band")
    return signal.lfilter(b, a, n) * np.exp(-t / tau)


def place(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if j > i:
        buf[i:j] += x[: j - i]


def norm(x, peak=0.7):
    return x * (peak / (np.abs(x).max() + 1e-9))


def save(name, x):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    x = norm(x)
    fade = int(SR * 0.004)
    x[:fade] *= np.linspace(0, 1, fade)[:, None]
    x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    os.makedirs(OUT, exist_ok=True)
    wavfile.write(os.path.join(OUT, f"{name}.wav"), SR, (x * 32767).astype(np.int16))
    print(f"  {name}.wav  {len(x) / SR:.2f}s")


def whoosh(dur=0.62, lo=350, hi=3200, end=900, w=0.45):
    y = sweep_noise(dur, lo, end, width=w, f_mid=hi)
    n = len(y)
    x = np.linspace(0, 1, n)
    e = np.where(x < 0.55, (x / 0.55) ** 2.2, ((1 - x) / 0.45) ** 1.6)
    return pan(y * e, np.linspace(-0.7, 0.7, n))


def impact(dur=1.0):
    t = t_(dur)
    f = 38 + 60 * np.exp(-t / 0.08)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * np.exp(-t / 0.28)
    b, a = signal.butter(2, 900 / (SR / 2))
    burst = signal.lfilter(b, a, rng.standard_normal(len(t))) * np.exp(-t / 0.035)
    y = sub * 1.0 + burst * 0.6 + click(dur, 2500, 0.004) * 0.25
    return np.tanh(y * 1.6)


def main():
    print("generating ->", os.path.abspath(OUT))
    save("whoosh", whoosh())
    save("swish", whoosh(0.32, 900, 5000, 1800, 0.4))
    save("swipe", whoosh(0.22, 1500, 6500, 3000, 0.35))
    save("impact", impact())

    t = t_(0.22)
    f = 300 + 700 * np.exp(-t / 0.018)
    pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) + click(0.22, 4000, 0.003) * 0.2
    save("pop", pop)

    save("click", click(0.12, 2600, 0.007) + click(0.12, 5200, 0.004) * 0.5)
    t = t_(0.1)
    save("tick", np.sin(2 * np.pi * 4200 * t) * np.exp(-t / 0.006) * 0.6 + click(0.1, 6000, 0.002) * 0.2)
    save("ding", bell(1320, 1.3))

    # riser: noise sweeping up + gliding tone, crescendo
    dur = 1.6
    t = t_(dur)
    nz = sweep_noise(dur, 300, 5500, width=0.5)
    tone = np.sin(2 * np.pi * np.cumsum(220 * (4 ** (t / dur))) / SR) * 0.35
    e = (t / dur) ** 2.5
    save("riser", pan((nz * 0.8 + tone) * e, np.sin(t * 9) * 0.3))

    # glitch: gated square / noise stutter, bitcrushed
    dur = 0.4
    t = t_(dur)
    sq = np.sign(np.sin(2 * np.pi * 180 * t)) * 0.5 + rng.standard_normal(len(t)) * 0.4
    gate = (np.floor(t * 40) % 3 != 1).astype(float) * (rng.random(int(dur * 40) + 1)[(t * 40).astype(int)] > 0.25)
    crushed = np.round(sq * 6) / 6
    save("glitch", pan(crushed * gate * np.exp(-t / 0.25), rng.uniform(-0.6, 0.6, len(t))))

    # typing: bursts of keyboard clicks
    buf = np.zeros(int(SR * 1.3))
    at = 0.02
    while at < 1.2:
        k = click(0.05, rng.uniform(1800, 3800), 0.012) * rng.uniform(0.6, 1.0)
        th = np.sin(2 * np.pi * 150 * t_(0.05)) * np.exp(-t_(0.05) / 0.01) * 0.5
        place(buf, k + th, at)
        at += rng.uniform(0.055, 0.11)
    save("typing", buf)

    # bubbles: upward chirps + low rumble
    buf = np.zeros(int(SR * 1.5))
    for _ in range(11):
        d = rng.uniform(0.03, 0.06)
        tt = t_(d)
        f0 = rng.uniform(250, 500)
        ch = np.sin(2 * np.pi * np.cumsum(f0 * (2.4 ** (tt / d))) / SR) * np.sin(np.pi * tt / d)
        place(buf, ch * rng.uniform(0.4, 1), rng.uniform(0.05, 1.35))
    b, a = signal.butter(2, 220 / (SR / 2))
    rumble = signal.lfilter(b, a, rng.standard_normal(len(buf))) * np.linspace(1, 0, len(buf)) * 0.8
    save("bubbles", buf + rumble)

    # sparkle: scattered high pings
    L = np.zeros((int(SR * 1.0), 2))
    for _ in range(18):
        f0 = rng.uniform(2500, 7000)
        d = rng.uniform(0.08, 0.25)
        tt = t_(d)
        ping = np.sin(2 * np.pi * f0 * tt) * np.exp(-tt / (d / 3))
        s = pan(ping * rng.uniform(0.3, 1), rng.uniform(-0.9, 0.9))
        i = int(rng.uniform(0, 0.75) * SR)
        L[i : i + len(s)] += s[: len(L) - i]
    save("sparkle", L)

    # success: quick major arpeggio
    buf = np.zeros(int(SR * 1.0))
    for i, fr in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
        place(buf, bell(fr, 0.8, ((1, 1, 0.35), (2, 0.25, 0.2), (3, 0.1, 0.12))) * (0.8 if i < 3 else 0.5), i * 0.07)
    save("success", buf)

    # stamp: short thud + paper slap
    t = t_(0.45)
    thud = np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.09)
    save("stamp", np.tanh((thud + click(0.45, 1800, 0.02) * 0.7) * 1.5))


if __name__ == "__main__":
    main()
