#!/usr/bin/env bash
# Concatenate rendered segments and encode the delivery file: H.264 High, yuv420p, 30 fps CFR, AAC from the original MP3.
set -euo pipefail
cd "$(dirname "$0")/.."
SEG=render/segments; OUT=final/music-video.mp4; AUDIO="song/Ten - Anno Domini Beats.mp3"
mkdir -p final
ls $SEG/seg_*.mp4 | sort | sed "s#^#file '$(pwd)/#; s#\$#'#" > $SEG/list.txt
VB=${VB:-4300k}
ffmpeg -hide_banner -y -f concat -safe 0 -i $SEG/list.txt -an -c:v libx264 -preset slow -tune animation -b:v $VB -pass 1 -passlogfile $SEG/x264 -pix_fmt yuv420p -r 30 -f mp4 /dev/null
ffmpeg -hide_banner -y -f concat -safe 0 -i $SEG/list.txt -i "$AUDIO" -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -tune animation -b:v $VB -maxrate 9M -bufsize 12M -pass 2 -passlogfile $SEG/x264 -profile:v high -pix_fmt yuv420p -r 30 -fps_mode cfr \
  -c:a aac -b:a 256k -t 163.5 -movflags +faststart $OUT
ls -la $OUT
