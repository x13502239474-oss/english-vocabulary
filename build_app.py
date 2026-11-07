# -*- coding: utf-8 -*-
"""把「词根联想·英语词汇」原型改造成高中版。

从 _template.html 读取原型（不改动），注入高中词库，做最小侵入式适配：
  - 内嵌数据换成高中 words/sents，语法课程沿用原型
  - 新增「高考高频」「20 天冲刺 Day 01-20」虚拟分组
  - 分级排序、初中文案、测试卷标题适配
  - localStorage 键加 hs- 前缀，避免与初中版进度串数据
输出 index.html（单文件，file:// 可直接打开）
"""
import json, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(ROOT, '_template.html')
OUT = os.path.join(ROOT, 'index.html')
DATA = os.path.join(ROOT, 'data')

words = json.load(open(os.path.join(DATA, 'words.json'), encoding='utf-8'))
sents = json.load(open(os.path.join(DATA, 'sents.json'), encoding='utf-8'))
meta = json.load(open(os.path.join(DATA, 'meta.json'), encoding='utf-8'))
s = open(TPL, encoding='utf-8').read()


def json_span(text, start):
    depth, instr, esc = 0, False, False
    for j in range(start, len(text)):
        c = text[j]
        if instr:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                instr = False
            continue
        if c == '"':
            instr = True
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return start, j + 1
    raise ValueError('unterminated JSON')


def func_span(text, name):
    i = text.find('function ' + name + '(')
    assert i >= 0, 'missing function ' + name
    j = text.find('{', i)
    depth, instr, esc, quote = 0, False, False, None
    k = j
    while k < len(text):
        c = text[k]
        if instr:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                instr = False
        else:
            if c in ('"', "'", '`'):
                instr, quote = True, c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return i, k + 1
        k += 1
    raise ValueError('unterminated function ' + name)


def replace_func(text, name, new):
    a, b = func_span(text, name)
    return text[:a] + new + text[b:]


def rep(text, old, new, label, count=1):
    assert old in text, 'MISS: ' + label
    return text.replace(old, new, count)


# ---------- 1. 保留原语法课程，替换内嵌数据 ----------
i = s.find('window.__VOCAB_INLINE__')
assert i >= 0
a, b = json_span(s, s.find('{', i))
gram = json.loads(s[a:b])['gram']
inline = json.dumps({'words': words, 'sents': sents, 'gram': gram},
                    ensure_ascii=False, separators=(',', ':'))
inline = inline.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
s = s[:a] + inline + s[b:]
print('inline JSON: %.2f MB | gram lessons: %d' % (len(inline) / 1048576, len(gram['lessons'])))

# ---------- 2. 文案适配 ----------
repls = [
    ('<title>词根联想英语词汇</title>', '<title>北境词林 · 高中英语自学本</title>', 'title'),
    ('初中英语综合测试卷', '高中英语综合测试卷', 'paper title'),
    ('英语测试卷（初中级别 · 自动生成）', '英语测试卷（高中词汇 · 自动生成）', 'paper comment'),
    ('听力扩展语料（初中水平，内置在页面里，离线版自动带）',
     '听力扩展语料（初中衔接素材，内置在页面里，离线版自动带）', 'listening comment'),
    ('题目取自《零基础图解英语语法》初中章节的单项填空（共 200 题，随机抽 10 题）',
     '题目取自《零基础图解英语语法》基础章节的单项填空（共 200 题，随机抽 10 题），作为高中衔接的语法复习',
     'gram quiz tip'),
    ('<select id="gramqScope"><option value="">全部学段</option>',
     '<select id="gramqScope"><option value="">全部基础阶段</option>', 'gramq scope'),
    ('<span>学段</span>', '<span>基础阶段</span>', 'gram level label'),
]
for old, new, label in repls:
    s = rep(s, old, new, label)

# ---------- 3. 顶部说明条 ----------
# 数据源说明已并入扉页的「版本记录 / COLOPHON」，不再在页首塞一条说明。
# 保留插入点，方便以后要加版本铭牌时直接改这里。
head = ''
s = rep(s, '<div class="stats">', head + '<div class="stats">', 'head note')

# ---------- 4. 虚拟分组：高考高频 + 20 天冲刺 ----------
NEW_FILTERED = '''function hsListPred(list){
  if(list==="__hot__") return w=>w.hot===1;
  if(list && list.indexOf("__day")===0){ const d=parseInt(list.slice(5),10); return w=>w.day===d; }
  return ()=>true;
}
function filtered(search, list){
  search=(search||"").trim().toLowerCase();
  const hs=hsListPred(list);
  return words.filter(w=>hs(w)&&(!list||list.indexOf("__")===0||w.list===list)
    &&(!search||[w.word,w.phonetic,w.definition,w.memory,w.example].join(" ").toLowerCase().includes(search)));
}'''
s = replace_func(s, 'filtered', NEW_FILTERED)

NEW_WPRED = '''function wPred(){
  const s=$("wordScope").value;
  const hs=hsListPred(($("listStudy")&&$("listStudy").value)||"");
  if(s==="unmastered") return w=>hs(w)&&!mastered.has(w.word);
  if(s==="review") return w=>hs(w)&&review.has(w.word);
  return hs;
}'''
s = replace_func(s, 'wPred', NEW_WPRED)

NEW_OPTIONS = '''function optionsForLists(){
  const rankList=l=>{ const n=parseInt(l.split(" ").pop()); if(!isNaN(n)) return n;
    return 1000+["认知词","简单单词","高考高频","高考真题"].indexOf(l); };
  const extras=[["__hot__","高考高频（20 天版）"]];
  for(let d=1;d<=20;d++) extras.push(["__day"+d+"__","20 天冲刺 · Day "+String(d).padStart(2,"0")]);
  for(let id of ["listStudy","listFilter"]) for(const [v,t] of extras){
    const o=document.createElement("option"); o.value=v; o.textContent=t; $(id).appendChild(o);
  }
  let lists=[...new Set(words.map(w=>w.list))].sort((a,b)=>rankList(a)-rankList(b));
  for(let id of ["listStudy","listFilter"]) for(let l of lists){
    let o=document.createElement("option");o.value=l;o.textContent=l;$(id).appendChild(o);
  }
  let slists=[...new Set(sents.map(s=>s.list).filter(Boolean))].sort((a,b)=>rankList(a)-rankList(b));
  for(let l of slists){let o=document.createElement("option");o.value=l;o.textContent=l;$("listSent").appendChild(o);}
}'''
s = replace_func(s, 'optionsForLists', NEW_OPTIONS)

# ---------- 5. 进度键隔离 ----------
s, n = re.subn(r'(["\'])vocab-', r'\1hs-vocab-', s)
print('storage keys prefixed:', n)
assert n >= 10, 'storage key replacement looks wrong'

# ---------- 6. 输出 ----------
open(OUT, 'w', encoding='utf-8').write(s)
print('OUTPUT: %s | %.2f MB' % (OUT, os.path.getsize(OUT) / 1048576))
for kw in ['高中词根联想', '高中英语综合测试卷', '__hot__', 'hs-vocab-mastered', '20 天冲刺']:
    print(' check %-22s %s' % (kw, 'OK' if kw in s else 'MISSING'))
