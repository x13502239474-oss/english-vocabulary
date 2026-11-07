# -*- coding: utf-8 -*-
"""下载开源欧洲字体并生成内嵌 base64 的 design/fonts.css。

字体来自 Google Fonts（SIL OFL 开源），只取 latin 子集，转 base64 内嵌，
因此单文件 index.html 离线打开也能保持真正的碑铭体 / 哥特体 / 古印刷衬线。

    python design/fetch_fonts.py
"""
import base64, os, re, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'design', 'fonts.css')
PROXY = 'http://127.0.0.1:29758'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY}))


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return opener.open(req, timeout=40).read()


FAMILIES = [
    ('Cinzel', 'Cinzel:wght@400;700',
     [(400, 'normal'), (700, 'normal')]),
    ('Cormorant Garamond', 'Cormorant+Garamond:ital,wght@0,400;0,600;1,400',
     [(400, 'normal'), (600, 'normal'), (400, 'italic')]),
    ('UnifrakturMaguntia', 'UnifrakturMaguntia',
     [(400, 'normal')]),
]

faces = []
for name, query, wanted in FAMILIES:
    css = get('https://fonts.googleapis.com/css2?family=' + query + '&display=swap').decode('utf-8')
    blocks = re.findall(r'/\*\s*([\w\-]+)\s*\*/\s*@font-face\s*\{([^}]+)\}', css, re.S)
    latin = [b for sub, b in blocks if sub == 'latin']
    if not latin:
        latin = [b for sub, b in blocks if 'latin' in sub]
    if not latin:
        latin = re.findall(r'@font-face\s*\{([^}]+)\}', css, re.S)
    picked = 0
    for block in latin:
        m = re.search(r'url\((https://[^)]+?)\)', block)
        if not m:
            continue
        fw = re.search(r'font-weight:\s*(\d+)', block)
        fs = re.search(r'font-style:\s*(\w+)', block)
        weight = int(fw.group(1)) if fw else 400
        style = fs.group(1) if fs else 'normal'
        if (weight, style) not in wanted:
            continue
        data = get(m.group(1))
        b64 = base64.b64encode(data).decode('ascii')
        faces.append(
            "@font-face{font-family:'%s';font-style:%s;font-weight:%d;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2')}" % (name, style, weight, b64))
        picked += 1
        print('  %-22s %s %d  %.1f KB' % (name, style, weight, len(data) / 1024))
    if not picked:
        print('  WARN: no latin face for', name)

if not faces:
    raise SystemExit('No fonts downloaded; check proxy')
open(OUT, 'w', encoding='utf-8').write(
    '/* 欧洲碑铭 / 哥特 / 古印刷衬线字体，SIL OFL，latin 子集内嵌 */\n'
    + '\n'.join(faces) + '\n')
print('fonts.css: %.1f KB | %d faces' % (os.path.getsize(OUT) / 1024, len(faces)))
