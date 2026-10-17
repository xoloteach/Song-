#!/usr/bin/env python3
"""Run example Blender scene with Blender background mode. Blender must be installed separately."""
import argparse, shutil, subprocess, sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',default='../final/blender-frame.png');p.add_argument('--frame',type=int,default=1);p.add_argument('--blender',default='blender');a=p.parse_args()
exe=shutil.which(a.blender) or (a.blender if Path(a.blender).is_file() else None)
if not exe:sys.exit('Blender executable not found; install Blender or pass --blender /absolute/path/blender')
script=Path(__file__).resolve().parent.parent/'blender/scene.py';dest=Path(a.output).resolve();dest.parent.mkdir(parents=True,exist_ok=True)
command=[str(exe),'-b','-t','2','-P',str(script),'--','--output',str(dest),'--frame',str(a.frame)]
print('Running:', ' '.join(command));sys.exit(subprocess.call(command))
