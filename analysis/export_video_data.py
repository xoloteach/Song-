#!/usr/bin/env python3
"""Condense analysis/audio_features.json into video/data/audio.json used by the renderer:
per-frame (30 fps) envelopes with VU-style release, onset lists, the verified 126 BPM grid,
and the sub-bass on/off map (used for 'hit-stop' choreography)."""
import json, sys, numpy as np
a = json.load(open(sys.argv[1]))
FPS = 30
N = int(round(163.5 * FPS))  # video frame count (container duration 163.500 s)
def release(x, r):
    x = np.asarray(x, float); y = np.zeros_like(x); v = 0
    for i, s in enumerate(x):
        v = max(s, v * r); y[i] = v
    return y
env = {}
for k, r in [('sub', .86), ('kick', .80), ('lowmid', .85), ('mid', .88), ('presence', .85), ('air', .75), ('rms', .9), ('onset', .7)]:
    x = np.array(a['env'][k][:N]); x = np.pad(x, (0, max(0, N - len(x))))
    env[k] = np.clip(release(x, r), 0, 1.2).round(3).tolist()
# beat grid (least squares fit of tracked beats): t = B0 + n*SPB, SPB == 60/126
b = np.array(a['beats']); n = np.round((b - b[0]) / (60 / 126))
SPB, B0 = np.polyfit(n, b, 1)
# sub-bass on/off from the raw sub envelope, cleaned
sub = np.array(a['env']['sub'][:N]); on = np.convolve(sub > .12, np.ones(5) / 5, 'same') > .5
edges = []
for i in np.flatnonzero(np.diff(on.astype(int))):
    edges.append([round((i + 1) / FPS, 3), int(on[i + 1])])
out = {'fps': FPS, 'frames': N, 'bpm': 126, 'spb': round(float(SPB), 6), 'b0': round(float(B0 - n[0] * SPB) if False else float(B0), 4),
       'kicks': a['kicks'], 'snares': a['snares'], 'subEdges': edges, 'env': env}
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print('spb', SPB, 'b0', B0, 'frames', N)
