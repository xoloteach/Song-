#!/usr/bin/env python3
"""Independent audio analysis of the source MP3 (verification of the supplied package).
Outputs analysis/audio_features.json (per-video-frame envelopes @30fps, beats, onsets)
and analysis/spectrogram.png for visual inspection."""
import json, sys, numpy as np, librosa
from PIL import Image
src = sys.argv[1]; out = sys.argv[2]
y, sr = librosa.load(src, sr=44100, mono=True)
dur = len(y)/sr
FPS = 30
hop = 441  # 10ms
S = np.abs(librosa.stft(y, n_fft=4096, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
def band(lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return S[m].sum(0)
bands = {'sub': band(20, 65), 'kick': band(65, 160), 'lowmid': band(160, 500),
         'mid': band(500, 2500), 'presence': band(2500, 6000), 'air': band(6000, 16000)}
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
times = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=hop)
onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
# percussive-specific onset curves
def flux(b):
    d = np.diff(np.log1p(b*10), prepend=0); d[d < 0] = 0; return d
kick_flux = flux(bands['kick'] + bands['sub']*0.5)
snare_flux = flux(band(1500, 5000))
hat_flux = flux(bands['air'])
tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, start_bpm=126, tightness=200)
beat_t = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
tempo2, beats2 = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, start_bpm=90)
def pick(fl, delta, wait):
    p = librosa.util.peak_pick(fl, pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=delta, wait=wait)
    return [round(float(times[i]), 3) for i in p]
kicks = pick(kick_flux, np.percentile(kick_flux, 97)*0.5, 12)
snares = pick(snare_flux, np.percentile(snare_flux, 97)*0.5, 12)
# resample envelopes to video frames
nF = int(np.ceil(dur*FPS))
ft = np.arange(nF)/FPS
def env(x):
    x = np.interp(ft, times, x)
    hi = np.percentile(x, 99.5) or 1
    return np.clip(x/hi, 0, 1.5).round(4).tolist()
# smoothed per-frame
feat = {k: env(v) for k, v in bands.items()}
feat['rms'] = env(rms)
feat['onset'] = env(onset)
# novelty segmentation from chroma+mfcc
mf = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop*10, n_mfcc=13)
ch = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop*10)
X = np.vstack([librosa.util.normalize(mf, axis=1), ch])
bounds = librosa.segment.agglomerative(X, 24)
bt = librosa.frames_to_time(bounds, sr=sr, hop_length=hop*10)
# silence
fr = librosa.feature.rms(y=y, frame_length=4410, hop_length=441)[0]
db = 20*np.log10(fr+1e-9)
ft2 = librosa.frames_to_time(np.arange(len(fr)), sr=sr, hop_length=441)
loud = ft2[db > -50]
res = {'duration': dur, 'sr_analysis': sr, 'fps': FPS, 'frames': nF,
       'tempo_126seed': float(np.atleast_1d(tempo)[0]), 'tempo_90seed': float(np.atleast_1d(tempo2)[0]),
       'beats': [round(float(b), 3) for b in beat_t], 'kicks': kicks, 'snares': snares,
       'segments': [round(float(b), 2) for b in bt],
       'last_audible_sec': round(float(loud[-1]), 3), 'first_audible_sec': round(float(loud[0]), 3),
       'env': feat}
json.dump(res, open(out + '/audio_features.json', 'w'))
# spectrogram picture: 1 px per 0.1s
M = librosa.amplitude_to_db(librosa.feature.melspectrogram(S=S**2, sr=sr, n_mels=128), ref=np.max)
M = M[:, ::10]
img = ((M - M.min())/(M.max()-M.min())*255).astype(np.uint8)[::-1]
img = np.repeat(img, 2, axis=0)
Image.fromarray(img).save(out + '/spectrogram.png')
# energy per second profile
print('duration', dur, 'tempo', res['tempo_126seed'], res['tempo_90seed'], 'beats', len(beat_t))
print('first/last audible', res['first_audible_sec'], res['last_audible_sec'])
print('segments', res['segments'])
print('beat intervals median', np.median(np.diff(beat_t)))
print('first beats', res['beats'][:12])
print('kicks', len(kicks), kicks[:20]); print('snares', len(snares), snares[:20])
sec = np.arange(int(dur))
e = np.interp(sec, ft, np.array(feat['rms']))
s = np.interp(sec, ft, np.array(feat['sub']))
print('per-second rms/sub:')
for i in range(0, len(sec), 1):
    print(f'{i:3d} {"#"*int(e[i]*40):40s} {"*"*int(s[i]*30)}')
