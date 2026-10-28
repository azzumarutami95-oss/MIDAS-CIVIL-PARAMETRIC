#!/usr/bin/env python3
"""Create original geometric app icons; development requires Pillow only."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
target = root / 'desktop' / 'assets'
target.mkdir(parents=True, exist_ok=True)
image = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
d = ImageDraw.Draw(image)
d.rounded_rectangle((8, 8, 504, 504), 100, fill='#16304f')
d.polygon([(256, 78), (406, 166), (256, 254), (106, 166)], fill='#80cbe7')
d.polygon([(106, 166), (256, 254), (256, 430), (106, 342)], fill='#287fba')
d.polygon([(256, 254), (406, 166), (406, 342), (256, 430)], fill='#ee9950')
d.line([(106, 253), (256, 342), (406, 253)], fill='#fff4dd', width=10)
image.save(target / 'icon.png')
image.save(target / 'icon.ico', sizes=[(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)])
print('Desktop PNG/ICO assets generated.')
