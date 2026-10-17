#!/usr/bin/env python3
"""Verify MP4 streams, frame rate, and duration against optional source audio."""
import argparse, json, subprocess, sys
p=argparse.ArgumentParser();p.add_argument('video');p.add_argument('--audio');a=p.parse_args()
def probe(path):
    r=subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',path],capture_output=True,text=True,check=True)
    return json.loads(r.stdout)
try:
    v=probe(a.video);streams=v['streams']; vd=next(s for s in streams if s['codec_type']=='video');aud=next((s for s in streams if s['codec_type']=='audio'),None)
    dur=float(v['format']['duration']); rate=vd.get('avg_frame_rate','0/1'); nom,den=map(int,rate.split('/'));fps=nom/den if den else 0
    checks={'has_video':True,'h264_video':vd['codec_name']=='h264','1920x1080':vd['width']==1920 and vd['height']==1080,'30_fps':abs(fps-30)<0.02,'yuv420p':vd.get('pix_fmt')=='yuv420p','aac_audio':aud is not None and aud['codec_name']=='aac'}
    print('Video seconds:',round(dur,3),'FPS:',round(fps,3),'Streams:',len(streams))
    if a.audio:
        expected=float(probe(a.audio)['format']['duration']);checks['duration_matches_audio']=abs(dur-expected)<=0.10
        print('Audio seconds:',round(expected,3),'Duration delta:',round(dur-expected,3))
    checks['full_decode']=subprocess.run(['ffmpeg','-v','error','-i',a.video,'-f','null','-'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE).returncode==0
    for k,ok in checks.items():print(('PASS' if ok else 'FAIL'),k)
    sys.exit(0 if all(checks.values()) else 1)
except Exception as e:print('Verification error:',e,file=sys.stderr);sys.exit(2)
