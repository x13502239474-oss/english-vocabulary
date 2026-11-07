# -*- coding: utf-8 -*-
"""裁掉生成图右下角水印，统一调成「北境白日」的明亮冷调，输出到 assets/。

    python design/prepare_assets.py

输出五张同一片北境的场景图 scene-01..05.jpg（雪岭 / 霜晨 / 松林 / 堡门 / 石庭），
外加冷调羊皮纸底纹 parchment.jpg 与冷调静物 relics.jpg；hero.jpg 为 scene-01 副本。
旧的暖色场景自动备份到 assets/warm/，随时可回退。
"""
import glob, os, shutil, sys
from PIL import Image, ImageEnhance

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design', 'assets')
DST = os.path.join(ROOT, 'assets')
WARM = os.path.join(DST, 'warm')
os.makedirs(DST, exist_ok=True)


def find(key):
    hits = glob.glob(os.path.join(SRC, 'Photorealistic_' + key + '*.png'))
    if not hits:
        raise SystemExit('missing source image: ' + key)
    return max(hits, key=os.path.getmtime)


def save(im, name, quality=86):
    p = os.path.join(DST, name)
    im.convert('RGB').save(p, 'JPEG', quality=quality, optimize=True, progressive=True)
    print('  %-18s %s  %.0f KB' % (name, im.size, os.path.getsize(p) / 1024))


def gamma_lut(g):
    return [min(255, int((i / 255) ** g * 255)) for i in range(256)]


def cold(im, gamma=0.90, r=0.97, g=1.00, b=1.04, color=0.94):
    """抬亮暗部、压一点暖红、给一点冷蓝，保持整体明亮不灰暗。"""
    L = gamma_lut(gamma)
    ch = im.convert('RGB').split()
    mult = (r, g, b)
    out = [c.point([min(255, int(v * m)) for v in L]) for c, m in zip(ch, mult)]
    return ImageEnhance.Color(Image.merge('RGB', tuple(out))).enhance(color)


# 回退备份（只在首次执行时保留暖色版本）
if not os.path.isdir(WARM):
    os.makedirs(WARM)
    for i in range(1, 6):
        p = os.path.join(DST, 'scene-0%d.jpg' % i)
        if os.path.isfile(p):
            shutil.copyfile(p, os.path.join(WARM, 'scene-0%d.jpg' % i))
    print('  warm/ 已备份旧暖色场景')

SCENES = [
    ('scene-01.jpg', find('cinematic_Nordi')),      # NIX  雪岭白日
    ('scene-02.jpg', find('frost_morning_N')),      # GELU 霜晨草径
    ('scene-03.jpg', find('pine_forest_Nor')),      # SILVA 松林天光
    ('scene-04.jpg', find('castle_gate_Nor')),      # ARX  堡前晴雪
    ('scene-05.jpg', find('stone_courtyard')),      # LUX  石庭冷光
]
for name, path in SCENES:
    im = Image.open(path)
    w, h = im.size
    im = im.crop((0, 0, w, h - int(h * 0.085)))     # 去右下角水印带
    im = cold(im, gamma=0.90, r=0.97, g=1.00, b=1.04, color=0.94)
    im.thumbnail((1600, 1000), Image.LANCZOS)
    save(im, name, 86)
shutil.copyfile(os.path.join(DST, 'scene-01.jpg'), os.path.join(DST, 'hero.jpg'))

# 冷调羊皮纸底纹
im = Image.open(find('flat_lay'))
w, h = im.size
im = im.crop((int(w * .07), int(h * .05), w, h - int(h * .085)))
im.thumbnail((900, 900), Image.LANCZOS)
im = cold(im, gamma=0.96, r=0.93, g=0.98, b=1.07, color=0.70)
save(ImageEnhance.Contrast(im).enhance(.92), 'parchment.jpg', 78)

# 冷调静物：斑驳铁剑 / 盾徽 / 火漆卷轴
im = Image.open(find('museum_still'))
w, h = im.size
im = im.crop((0, 0, w, h - int(h * .085)))
im.thumbnail((900, 900), Image.LANCZOS)
im = cold(im, gamma=0.82, r=0.88, g=0.97, b=1.10, color=0.78)
save(im, 'relics.jpg', 84)

print('assets ready:', DST)
