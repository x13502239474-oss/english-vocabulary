#!/usr/bin/env python3
# 把已生成的 5 张北境冷调 PNG 裁去底部水印、压缩成网页用 jpg。
# 不消耗任何积分：纯本地 PIL 处理。
import glob, os
from PIL import Image, ImageEnhance

SRC = 'design/assets'
DST = 'assets'

# 5 张北境场景 -> 轮换顺序
order = [
    'Photorealistic_cinematic_Nordi_',         # 北境高地（最亮，作首屏/hero）
    'Photorealistic_frost_morning_N_',         # 霜晨
    'Photorealistic_pine_forest_Nor_',         # 松林
    'Photorealistic_castle_gate_Nor_',         # 城堡门
    'Photorealistic_stone_courtyard_',         # 石庭
]

def newest(prefix):
    cands = glob.glob(os.path.join(SRC, prefix) + '*.png')
    return max(cands, key=os.path.getmtime) if cands else None

def process(path, out_name):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    im = im.crop((0, 0, w, h - int(h * 0.085)))      # 去底部水印
    im.thumbnail((1600, 1100), Image.LANCZOS)
    # 轻微提亮冷调，统一光线
    im = ImageEnhance.Brightness(im).enhance(1.03)
    im = ImageEnhance.Color(im).enhance(0.96)
    out = os.path.join(DST, out_name)
    im.save(out, 'JPEG', quality=86, optimize=True, progressive=True)
    return out, round(os.path.getsize(out) / 1024)

os.makedirs(DST, exist_ok=True)
ok = 0
for i, pre in enumerate(order, 1):
    p = newest(pre)
    if not p:
        print('MISSING', pre); continue
    out, kb = process(p, f'scene-{i:02d}.jpg')
    print(f'{out}: {kb}KB  <- {os.path.basename(p)}')
    if i == 1:
        # 首屏 hero 用同一张最亮的
        shutil_copy = out
        h2 = os.path.join(DST, 'hero.jpg')
        im = Image.open(out); im.save(h2, 'JPEG', quality=86, optimize=True, progressive=True)
        print(f'hero.jpg: {round(os.path.getsize(h2)/1024)}KB')
    ok += 1

print(f'DONE scenes={ok}/5  total assets={round(sum(os.path.getsize(os.path.join(DST,f)) for f in os.listdir(DST) if f.endswith(".jpg"))/1024)}KB')
