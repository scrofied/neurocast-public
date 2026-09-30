"""Exact A/V check: find where snippets of the source voice track sit inside the rendered mix (cross-correlation).
usage: python xcorr_check.py <source.wav> <mix.wav> <expected_offset_sec> t1 t2 ...   (t = source times)
"""
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import correlate, resample_poly


def load(p, sr=8000):
    r, x = wavfile.read(p)
    x = x.astype(np.float32)
    if x.ndim > 1:
        x = x.mean(1)
    g = np.gcd(int(r), sr)
    return resample_poly(x, sr // g, int(r) // g).astype(np.float32), sr


src, sr = load(sys.argv[1])
mix, _ = load(sys.argv[2])
off = float(sys.argv[3])
for t in map(float, sys.argv[4:]):
    a = int(t * sr)
    snip = src[a : a + int(1.5 * sr)]
    exp = t + off
    lo = max(0, int((exp - 1.0) * sr))
    win = mix[lo : lo + int(3.5 * sr)]
    c = correlate(win - win.mean(), snip - snip.mean(), mode="valid")
    k = int(np.argmax(c))
    found = (lo + k) / sr
    print(f"source {t:7.2f}s -> expected {exp:7.3f}s, found {found:7.3f}s, error {1000 * (found - exp):+6.1f} ms")
