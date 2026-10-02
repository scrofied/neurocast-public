#!/usr/bin/env python
"""把一组静帧拼成一张带文件名的核对图，用于逐镜验收（开图看，不是看数字）。

用法：
  python scripts/qa/sheet.py <输出.jpg> <列数> <图1> <图2> ...

例：
  python scripts/qa/sheet.py out/_stills.jpg 4 out/_stills_*/001_s1_number.png ...
  python scripts/qa/sheet.py out/op.jpg 3 out/0930op3/f00000.png out/0930op3/f00015.png ...

每格左上角会画上帧文件名（如 f00062），方便对着时间轴逐帧核对。
`--stills` 最后一步拼总览图会稳定失败（spawnSync python EBUSY），用这个脚本自己拼。

注意：必须用带 PIL 的 python（系统 python 没有）：
  C:/Users/scrrofied/.workbuddy/binaries/python/envs/default/Scripts/python.exe
"""
import os
import sys

from PIL import Image, ImageDraw

if len(sys.argv) < 4:
    print(__doc__)
    sys.exit(1)

out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
cell = int(os.environ.get("SHEET_CELL", "470"))
label_h = 26
fs = [f for f in files if os.path.exists(f)]
missing = [f for f in files if not os.path.exists(f)]
if not fs:
    print("没有可用图片")
    sys.exit(1)

w, h = cell, int(cell * 9 / 16)
rows = (len(fs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * (h + label_h)), "black")
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    x, y = (i % cols) * w, (i // cols) * (h + label_h)
    sheet.paste(Image.open(f).convert("RGB").resize((w, h)), (x, y + label_h))
    draw.text((x + 7, y + 7), os.path.basename(f)[:-4], fill="white")

sheet.save(out, quality=86)
if missing:
    print("跳过不存在的 %d 个文件" % len(missing))
print("saved %s %s  %d frames" % (out, sheet.size, len(fs)))
