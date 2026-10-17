#!/usr/bin/env python3
"""Tile PNG stills into a labelled contact sheet for review: sheet.py out.png cols w in1.png in2.png ..."""
import sys
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
h = w * 9 // 16; rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), (40, 40, 40)); d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS); x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y)); d.text((x + 6, y + 4), f.split('/')[-1], fill=(255, 255, 0))
sheet.save(out)
