# -*- coding: utf-8 -*-
"""把「THE NORTHERN LEXICON / 北境词林」整套 UI 系统注入 _template.html。

始终从 design/_template.before.html（未改造的原始模板）读取，可反复运行：
    python design/apply.py      -> 改 _template.html
    python build_app.py         -> 注入高中词库，生成单文件 index.html

保留原有全部 13 个 section / id / 事件绑定 / 学习逻辑，
只重组外层框架、替换目次、新增扉页，并注入字体、样式与脚本。
"""
import os, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, '_template.html')
BASE = os.path.join(ROOT, 'design', '_template.before.html')
FONTS = os.path.join(ROOT, 'design', 'fonts.css')
CSS = os.path.join(ROOT, 'design', 'theme.css')
JS = os.path.join(ROOT, 'design', 'theme.js')

src = open(BASE, encoding='utf-8').read()
fonts = open(FONTS, encoding='utf-8').read()
css = open(CSS, encoding='utf-8').read()
js = open(JS, encoding='utf-8').read()

# ---------- 1. 字体 + 设计层 CSS ----------
assert '</style>' in src
src = src.replace('</style>', '\n' + fonts + '\n/* ===== 欧洲剑与魔法 UI 系统 ===== */\n' + css + '\n</style>', 1)

# ---------- 2. 拆出原有 DOM 片段 ----------
b0 = src.index('<body>') + len('<body>')
b1 = src.index('</main>')
body = src[b0:b1]
head_part, tail_part = src[:b0], src[b1 + len('</main>'):]

s0 = body.index('<div class="stats">')
n0 = body.index('<nav class="tabs"')
n1 = body.index('</nav>', n0) + len('</nav>')
stats_block = body[s0:n0]
sections = body[n1:]
sections = sections.replace('<section id="study" class="view">',
                            '<section id="study" class="view hidden">', 1)
assert 'id="study" class="view hidden"' in sections

# ---------- 3. 纹章符号（每个章节一枚，线性雕刻感，不用 emoji） ----------
SIGILS = {
 'home':      'M3 4 Q7 2 12 4 Q17 2 21 4 V20 Q17 18 12 20 Q7 18 3 20 Z M12 4 V20',
 'study':     'M12 2 L14 6 V17 H10 V6 Z M7 17 H17 M12 17 V21',
 'sent':      'M5 3 H19 V21 H5 Z M8 8 H16 M8 12 H16 M8 16 H13',
 'grammar':   'M5 6 H19 V21 H5 Z M3 6 L12 2 L21 6 M10 21 V15 H14 V21',
 'phonetics': 'M4 12 C9 7 15 7 20 4 V20 C15 17 9 17 4 12 Z M4 12 H2',
 'list':      'M8 12 A4 4 0 1 1 12 16 L12 21 M12 16 L17 16 M17 16 V19',
 'review':    'M6 3 H18 M6 21 H18 M8 3 C8 9 16 9 16 12 C16 15 8 15 8 21 M16 3 C16 9 8 9 8 12 C8 15 16 15 16 21',
 'mastered':  'M12 2 L20 5 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V5 Z M8 12 L11 15 L16 9',
 'quiz':      'M12 2 L14 9 L21 9 L15 14 L17 21 L12 17 L7 21 L9 14 L3 9 L10 9 Z',
 'listen':    'M4 9 H8 L15 4 V20 L8 15 H4 Z M18 9 C20 11 20 13 18 15',
 'speak':     'M6 5 Q4 12 8 17 M18 5 Q20 12 16 17 M4 12 H20 M10 20 H14',
 'dict':      'M4 20 L18 4 L20 6 L6 22 Z M4 20 H8 M10 16 L18 8',
 'paper':     'M5 3 H19 V21 H5 Z M8 8 H16 M8 12 H16 M12 16 A2 2 0 1 0 12 20 A2 2 0 1 0 12 16',
 'gramq':     'M3 18 L5 7 L9 12 L12 5 L15 12 L19 7 L21 18 Z M4 21 H20',
}

def tab(view, no, zh, la, active=False):
    return ('<button class="tab%s" data-view="%s"><i><svg viewBox="0 0 24 24" aria-hidden="true">'
            '<path d="%s"/></svg></i><span>%s</span><em>%s · %s</em></button>'
            % (' active' if active else '', view, SIGILS[view], zh, no, la))

NAV = '''<nav class="tabs" aria-label="功能导航">
 <div class="toc-head">Index capitulorum · 纹章目次</div>
 <div class="toc-group">I · Verba / 记与读</div>
 <div class="tab-row">
 {a}
 </div>
 <div class="toc-group">II · Memoria / 温故</div>
 <div class="tab-row">
 {b}
 </div>
 <div class="toc-group">III · Probatio / 试与练</div>
 <div class="tab-row">
 {c}
 </div>
</nav>'''.format(
    a='\n  '.join([
        tab('home','00','扉页','Frontispiece',True),
        tab('study','01','词条','Verba'),
        tab('sent','02','短句','Sententiae'),
        tab('grammar','03','语法','Grammatica'),
        tab('phonetics','04','音标','Phonetica'),
        tab('list','05','词库检索','Index'),
    ]),
    b='\n  '.join([
        tab('review','06','待复习','Revisenda'),
        tab('mastered','07','已掌握','Memoria'),
    ]),
    c='\n  '.join([
        tab('quiz','08','小测验','Tentamen'),
        tab('listen','09','听力测试','Auditus'),
        tab('speak','10','口语跟读','Vox'),
        tab('dict','11','默写练习','Scriptio'),
        tab('paper','12','测试卷','Probatio'),
        tab('gramq','13','语法测试','Examen'),
    ]),
)

# ---------- 4. 扉页 ----------
BLADE = '''<svg class="blade-svg" viewBox="0 0 600 60" role="img" aria-label="铁剑锻造进度">
 <polygon points="4,30 12,22 20,30 12,38" fill="#6b5540"/>
 <rect x="18" y="10" width="9" height="40" fill="#8a6a3a"/>
 <polygon points="27,19 560,20 560,40 27,41" fill="#4d5658"/>
 <clipPath id="bladeClip"><polygon points="27,19 560,20 560,40 27,41"/></clipPath>
 <rect id="bladeLit" x="27" y="18" width="0" height="24" fill="#c9d1cf" clip-path="url(#bladeClip)"/>
 <polygon points="560,20 596,30 560,40" fill="#4d5658"/>
 <path d="M28 30 L560 30" stroke="#8d9593" stroke-width=".8" fill="none" opacity=".55"/>
 <path d="M300 22 L316 25 M360 35 L378 37 M420 23 L438 26 M480 34 L498 36" stroke="#8d9593" stroke-width=".7" fill="none"/>
 <circle cx="12" cy="30" r="2.5" fill="#dcc079"/>
</svg>'''
MG_BLADE = BLADE.replace('id="bladeClip"', 'id="mgBladeClip"') \
                .replace('url(#bladeClip)', 'url(#mgBladeClip)') \
                .replace('id="bladeLit"', 'id="mgBladeLit"')

HOME = '''
<section id="home" class="view">
 <div class="hero-wrap">
  <div class="hero">
   <img id="heroImg" src="assets/scene-01.jpg" alt="阳光草原、古老城堡与重甲骑士">
   <div class="hero-copy">
    <div class="hero-kicker">Anno MMXXVI · Privata Chronica</div>
  <div class="hero-la">THE NORTHERN<br>LEXICON</div>
  <div class="hero-cn">北境词林 · 高中英语</div>
  <div class="hero-motto">Verba · Arma · Memoria</div>
    <div class="hero-rule"></div>
   </div>
  </div>
  <div class="scene-plate">
   <div>
    <div class="sp-la" id="sceneLa">AURORA</div>
    <div class="sp-zh" id="sceneZh">晨光草原</div>
   </div>
   <div class="sp-ctrl">
    <button id="sceneNext" title="换一幅">↻ 换一幅</button>
    <select id="sceneCycle" aria-label="背景更换周期">
     <option value="daily">每日</option>
     <option value="weekly">每周</option>
     <option value="monthly">每月</option>
     <option value="hour">随时段</option>
     <option value="visit">每次打开</option>
     <option value="fixed">固定</option>
    </select>
   </div>
  </div>
 </div>

 <div class="front-grid">
  <div class="quest">
   <div class="panel-title"><h2>主线委托</h2><span>Quest log</span></div>
   <ul class="stone-list" id="questList"></ul>
  </div>
  <div class="forge">
   <div class="panel-title"><h2>铁剑 · 锻造进度</h2><span>The blade</span></div>
   ''' + BLADE + '''
   <div class="blade-meta"><span>暗铁 <b id="bladePct">0.0%</b> 亮银</span><span id="bladeNum">—</span></div>
   <p class="blade-note">每刻下一枚符文，剑身就多锻亮一分。进度取自本机真实掌握记录，不虚构；四十处遗迹对应四十个 Word List。</p>
  </div>
 </div>

 <div class="sites-block">
  <div class="panel-title"><h2>四十处遗迹</h2><span>40 word lists</span><span id="casePct">—</span></div>
  <div class="site-grid" id="siteGrid"></div>
  <div class="site-tip" id="siteTip">每一格是一处遗迹，对应一个 Word List；着墨越深，这一处的词记得越牢。</div>
 </div>

 <div class="runes-block">
  <div class="panel-title"><h2>今日三枚符文</h2><span>Three sorts for today</span></div>
  <div class="rune-row" id="runeRow"></div>
 </div>

 <div class="front-entries">
  <button class="entr" data-go="study"><span class="n">01 / VERBA</span><span class="t">开卷 · 词条</span><span class="e">Begin with entries</span></button>
  <button class="entr" data-go="sent"><span class="n">02 / SENTENTIAE</span><span class="t">短句</span><span class="e">Read the lines</span></button>
  <button class="entr" data-go="phonetics"><span class="n">04 / PHONETICA</span><span class="t">音标</span><span class="e">Learn the sounds</span></button>
 </div>

 <div class="colophon">
  <b>COLOPHON · 版本记录</b>　词库 <b id="coloWords">—</b> 词 / 短句 <b id="coloSents">—</b> 句 / 遗迹 <b>XL</b> 处 / 技艺 <b>XIII</b> 章。<br>
  数据源：绿宝书系列版（主词库）＋ 20 天背完高考核心词汇（高频标记 / 真题例句 / 20 天计划）＋ 海豚版（校补）；语法课程与听力语料沿用初中版作为衔接复习。<br>
  学习进度保存在本机浏览器，不上传；在「词库检索」中可导出与合并进度。
 </div>
</section>
'''

# ---------- 5. 框架 ----------
FRAME_OPEN = '''
<header class="rampart">
 <button class="menu-btn" id="menuBtn" aria-label="打开目次">☰</button>
 <div class="brand">
  <svg class="brand-sigil" viewBox="0 0 34 38" aria-hidden="true">
   <path d="M1 1 H33 V23 L17 37 L1 23 Z" fill="#c4b18c" stroke="#866729" stroke-width="2"/>
   <path d="M15 7 H19 V26 H15 Z M8 14 H26 V18 H8 Z" fill="#8d2f24"/>
  </svg>
  <div><b class="brand-cn">北境词林</b><small class="brand-la">The Northern Lexicon</small></div>
 </div>
 <div class="rampart-mid">Verba · Arma · Memoria · Anno MMXXVI</div>
 <div class="rampart-right"><span class="rune-count">符文 <b id="rampartCount">0</b> / <span id="heroWords">3,559</span></span></div>
</header>

<div class="keep">
 <aside class="toc" id="toc">
  ''' + NAV + '''
  <div class="toc-foot">
   <b>EX LIBRIS</b><br>3559 VERBA · 4322 LINEAE<br>XL SITUS · XIII CAPITULA
   <div class="leather-strap"></div>
  </div>
  <button class="nav-close" id="navClose">关闭目次 ✕</button>
 </aside>

 <main class="folio">
  <div class="folio-head">
   <div class="illum-initial" id="illumInit">C</div>
   <div class="folio-titles">
    <div class="folio-la" id="folioLa">CHAPTER 00 · SYLVA BOREALIS</div>
    <div class="folio-zh" id="folioZh">扉页</div>
   </div>
   <span class="folio-spacer"></span>
   <span class="folio-progress" id="folioProgress"></span>
   <span class="folio-date" id="folioDate"></span>
  </div>
  <div class="folio-body">
''' + HOME

FRAME_CLOSE = '''
  </div>
  <div class="folio-foot">
   <span>The Northern Lexicon · 高中英语自学本</span>
   <span class="pf-num" id="folioNum">00 / 13</span>
   <span id="mgFolio">Folio 00</span>
  </div>
 </main>

 <aside class="margin">
  <div class="mg-title">Arma et litterae</div>
  <img class="mg-relic" src="assets/relics.jpg" alt="斑驳铁剑、盾徽与火漆封印卷轴">
  <div class="mg-cap">Gladius · Scutum · Sigillum</div>
  <div class="mg-blade">''' + MG_BLADE + '''</div>
  <div class="mg-pct"><span id="mgPct">0.0</span><small>%</small></div>
  <div class="mg-cap2">词库着墨率</div>
  ''' + stats_block + '''
  <div class="mg-note" id="mgNote"></div>
  <div class="mg-path-head">XIII capitula · 技艺刻度</div>
  <div class="mg-path" id="mgPath"></div>
 </aside>
</div>
<div class="nav-mask" id="navMask"></div>
<div class="wax-seal" id="waxSeal">SIGILLUM<br>MEMORIAE</div>
'''

# ---------- 6. 组装 ----------
FAVICON = ('<link rel="icon" href="data:image/svg+xml,'
           "%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E"
           "%3Cpath%20d='M4%204%20h56%20v34%20L32%2060%204%2038%20Z'%20fill='%23c4b18c'%20stroke='%23866729'%20stroke-width='3'/%3E"
           "%3Cpath%20d='M29%2012%20h6%20v30%20h-6%20Z%20M17%2024%20h30%20v6%20H17%20Z'%20fill='%238d2f24'/%3E%3C/svg%3E\">\n")
head_part = head_part.replace('<title>', FAVICON + '<title>', 1)
tail_part = tail_part.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1)
out = head_part + '<body>' + FRAME_OPEN + sections + FRAME_CLOSE + tail_part
open(TPL, 'w', encoding='utf-8').write(out)
print('apply.py OK | template %.2f MB | fonts %.0f KB | css %.0f KB | js %.0f KB'
      % (os.path.getsize(TPL)/1048576, len(fonts)/1024, len(css)/1024, len(js)/1024))
for kw in ['id="home"','class="rampart"','class="toc"','class="margin"','assets/scene-01.jpg',
           'id="sceneCycle"','id="bladeLit"','data-view="home"','id="study" class="view hidden"','UnifrakturMaguntia']:
    print('  %-36s %s' % (kw, 'OK' if kw in out else 'MISSING'))
