#!/usr/bin/env python3
"""Extended verification of final/music-video.mp4 against the source MP3.
Checks: container/stream specs, constant 30 fps (every frame timestamp), frame count, duration vs audio,
full decode without errors, frozen-picture spans, black spans, audio alignment (cross-correlation with
the source decode), audio gain/loudness unchanged (RMS ratio + EBU R128 integrated loudness)."""
import json, subprocess, sys, re
import numpy as np

video, audio = sys.argv[1], sys.argv[2]
out = {}
def run(cmd): return subprocess.run(cmd, capture_output=True, text=True)
pr = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', video]).stdout)
v = next(s for s in pr['streams'] if s['codec_type'] == 'video'); a = next(s for s in pr['streams'] if s['codec_type'] == 'audio')
out['video'] = {k: v.get(k) for k in ['codec_name', 'profile', 'width', 'height', 'pix_fmt', 'r_frame_rate', 'avg_frame_rate', 'nb_frames', 'duration']}
out['audio'] = {k: a.get(k) for k in ['codec_name', 'sample_rate', 'channels', 'bit_rate', 'duration']}
out['format'] = {'duration': pr['format']['duration'], 'size_MB': round(int(pr['format']['size']) / 1e6, 2), 'bit_rate': pr['format']['bit_rate']}
# per-frame timestamps
ts = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', video]).stdout.split()
ts = np.array([float(x) for x in ts if x])
d = np.diff(ts)
out['frames_decoded'] = int(len(ts)); out['frame_interval_min_max'] = [round(float(d.min()), 6), round(float(d.max()), 6)]
out['constant_30fps'] = bool(np.all(np.abs(d - 1 / 30) < 1e-3))
src_dur = float(json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', audio]).stdout)['format']['duration'])
out['source_audio_duration'] = src_dur; out['video_duration_delta'] = round(float(v['duration']) - src_dur, 3)
dec = run(['ffmpeg', '-v', 'error', '-i', video, '-f', 'null', '-']); out['full_decode_errors'] = dec.stderr.strip()[:500] or 'none'
# freeze / black detection
fz = run(['ffmpeg', '-i', video, '-vf', 'freezedetect=n=0.0015:d=1.0', '-map', '0:v', '-f', 'null', '-']).stderr
out['freezes_over_1s'] = [(float(s), float(e)) for s, e in zip(re.findall(r'freeze_start: ([\d.]+)', fz), re.findall(r'freeze_end: ([\d.]+)', fz))]
bk = run(['ffmpeg', '-i', video, '-vf', 'blackdetect=d=0.3:pix_th=0.06', '-map', '0:v', '-f', 'null', '-']).stderr
out['black_spans'] = re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', bk)
# audio alignment & level
def pcm(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32)
x, y = pcm(audio), pcm(video)
best = (-1e18, 0)
for lag in range(-4000, 4001, 4):
    s0 = 44100 * 30; seg = x[s0:s0 + 44100 * 8]; yy = y[s0 + lag:s0 + lag + len(seg)]
    if len(yy) == len(seg):
        c = float(np.dot(seg, yy));
        if c > best[0]: best = (c, lag)
lag = best[1]
for l2 in range(lag - 4, lag + 5):
    s0 = 44100 * 30; seg = x[s0:s0 + 44100 * 8]; yy = y[s0 + l2:s0 + l2 + len(seg)]; c = float(np.dot(seg, yy))
    if c > best[0]: best = (c, l2)
out['audio_offset_ms'] = round(best[1] / 44.1, 3)
n = min(len(x), len(y)); out['audio_rms_ratio_final_over_source'] = round(float(np.sqrt(np.mean(y[:n] ** 2)) / np.sqrt(np.mean(x[:n] ** 2))), 4)
def lufs(path):
    e = run(['ffmpeg', '-nostats', '-i', path, '-map', '0:a:0', '-af', 'ebur128', '-f', 'null', '-']).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', e); return float(m[-1]) if m else None
out['lufs_source'] = lufs(audio); out['lufs_final'] = lufs(video)
print(json.dumps(out, indent=1))
ok = (v['codec_name'] == 'h264' and v['width'] == 1920 and v['height'] == 1080 and v['pix_fmt'] == 'yuv420p' and a['codec_name'] == 'aac'
      and out['constant_30fps'] and abs(out['video_duration_delta']) <= .1 and out['full_decode_errors'] == 'none' and abs(out['audio_offset_ms']) < 5)
print('OVERALL', 'PASS' if ok else 'CHECK')
json.dump(out, open(video + '.verify.json', 'w'), indent=1)
