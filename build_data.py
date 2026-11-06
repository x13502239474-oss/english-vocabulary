# -*- coding: utf-8 -*-
"""从三本高中词汇 EPUB 生成与「词根联想·英语词汇」兼容的词库。

A = 海豚出版社《乱序版》       -> 交叉校验 / 补缺
B = 新东方绿宝书系列（西安交大） -> 主词库（核心词 40 List + 认知词 + 简单词）
C = 20 天背完高考核心词汇       -> 高频标记、20 天分组、真题例句

输出 data/words.json、data/sents.json、data/meta.json
"""
import zipfile, re, html, json, os, sys, collections

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.abspath(__file__))
EPUB = os.path.normpath(os.path.join(ROOT, '..', '_epub'))
OUT = os.path.join(ROOT, 'data')
os.makedirs(OUT, exist_ok=True)

LBL = {'记': '【记】', '参': '【参】', '辨': '【辨】', '考': '【考】', '搭': '【搭】'}
POS = re.compile(r'^(n|v|vt|vi|adj|adv|prep|art|pron|conj|int|num|aux|abbr|pl)\.\s', re.I)


def clean(frag):
    t = re.sub(r'<br\s*/?>', ' ', frag, flags=re.I)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t).replace('\u3000', ' ').replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', t).strip()


def p_iter(s):
    for m in re.finditer(r'<p\b([^>]*)>(.*?)</p>', s, re.S | re.I):
        attrs, body = m.group(1), m.group(2)
        cm = re.search(r'class="([^"]*)"', attrs)
        yield (cm.group(1) if cm else ''), body, attrs


def blank(word, lst, tier):
    return {'word': word, 'phonetic': '', 'definition': '', 'memory': '',
            'example': '', 'list': lst, 'tier': tier, 'hot': 0, 'day': 0, 'exam': ''}


def add_memory(w, label, val):
    w['memory'] += (('\n' if w['memory'] else '') + label + val)


def parse_B():
    """绿宝书系列版：主词库。"""
    z = zipfile.ZipFile(os.path.join(EPUB, 'B.epub'))
    out, cur, lst = [], None, 'Word List 1'

    def flush():
        nonlocal cur
        if cur and cur.get('word') and re.match(r'^[A-Za-z]', cur['word']):
            out.append(cur)
        cur = None

    for page in ['OEBPS/text00007.html', 'OEBPS/text00008.html']:
        s = z.read(page).decode('utf-8', 'ignore')
        for cls, body, attrs in p_iter(s):
            txt = clean(body)
            if not txt:
                continue
            if cls in ('title1', 'title2', 'title3'):
                m = re.match(r'Word List\s*(\d+)', txt, re.I)
                if m:
                    lst = 'Word List %d' % int(m.group(1)); flush()
                elif '认知词' in txt:
                    lst = '认知词'; flush()
                elif '简单单词' in txt:
                    lst = '简单单词'; flush()
                continue
            if cls == 'subtitle':
                flush()
                w = txt.strip()
                if re.match(r'^[A-Za-z]', w):
                    cur = blank(w, lst, '核心词' if lst.startswith('Word List') else lst)
                continue
            if cur is None:
                continue
            if cls == 'normaltext4' and not cur['phonetic']:
                cur['phonetic'] = txt.strip()
                continue
            if cls == 'normaltext3':
                m = re.match(r'^([记例参辨考搭])\s+(.*)$', txt)
                if m:
                    kind, val = m.group(1), m.group(2)
                    if kind == '例':
                        cur['example'] = (cur['example'] + ' // ' + val).strip() if cur['example'] else val
                    else:
                        add_memory(cur, LBL[kind], val)
                else:
                    cur['definition'] = (cur['definition'] + ' ' + txt).strip() if cur['definition'] else txt
        flush()

    # 简单单词是表格：<td>word</td><td>/音标/释义</td><td>□</td>
    s = z.read('OEBPS/text00009.html').decode('utf-8', 'ignore')
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S | re.I):
        tds = [clean(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S | re.I)]
        if len(tds) < 2:
            continue
        w, rest = tds[0], tds[1]
        if not re.match(r'^[A-Za-z]', w):
            continue
        m = re.match(r'^(/[^/]+/)\s*(.*)$', rest)
        if m:
            ph, df = m.group(1), m.group(2)
        else:
            m2 = re.search(r'(/[^/]+/)\s*(.*)$', rest)
            ph, df = (m2.group(1), m2.group(2)) if m2 else ('', rest)
        e = blank(w, '简单单词', '简单单词')
        e['phonetic'], e['definition'] = ph, df
        out.append(e)
    z.close()
    return out


def parse_A():
    """海豚版：用于补缺与补充进阶单词。"""
    z = zipfile.ZipFile(os.path.join(EPUB, 'A.epub'))
    out, cur, lst = [], None, 'Word List 1'

    def flush():
        nonlocal cur
        if cur and cur.get('word') and re.match(r'^[A-Za-z]', cur['word']):
            out.append(cur)
        cur = None

    pages = ['OEBPS/text%05d.html' % i for i in range(6, 47)]
    for page in pages:
        s = z.read(page).decode('utf-8', 'ignore')
        for cls, body, attrs in p_iter(s):
            txt = clean(body)
            if not txt:
                continue
            if cls in ('chapter-one-xu', 'chapter-one', 'chapter-two'):
                m = re.match(r'Word List\s*(\d+)', txt, re.I)
                if m:
                    lst = 'Word List %d' % int(m.group(1)); flush()
                elif '进阶单词' in txt:
                    lst = '进阶单词'; flush()
                continue
            if cls == 'word-title':
                flush()
                m = re.match(r'^(.+?)\s*(\[[^\]]+\].*)$', txt)
                w = m.group(1).strip() if m else txt.strip()
                ph = m.group(2).strip() if m else ''
                if re.match(r'^[A-Za-z]', w):
                    cur = blank(w, lst, '核心词' if lst.startswith('Word List') else '认知词')
                    cur['phonetic'] = ph
                continue
            if cur is None:
                continue
            if cls == 'bodytext':
                m = re.match(r'^【([记例参辨考搭])】\s*(.*)$', txt)
                if m:
                    kind, val = m.group(1), m.group(2)
                    if kind == '例':
                        cur['example'] = (cur['example'] + ' // ' + val).strip() if cur['example'] else val
                    else:
                        add_memory(cur, LBL[kind], val)
                else:
                    cur['definition'] = (cur['definition'] + ' ' + txt).strip() if cur['definition'] else txt
        flush()
    z.close()
    return out


def parse_C():
    """20 天版：2000 高频词、Day 分组、真题例句。"""
    z = zipfile.ZipFile(os.path.join(EPUB, 'C.epub'))
    hot, day_words = {}, collections.defaultdict(list)
    for i in range(2, 22):
        day = i - 1
        s = z.read('OEBPS/text%05d.html' % i).decode('utf-8', 'ignore')
        cur = None
        for cls, body, attrs in p_iter(s):
            hm = re.search(
                r'<span class="kindle-cn-bold">([^<]+)</span>\s*/\s*'
                r'<span class="kindle-cn-eng-yinbiao">([^<]*)</span>', body, re.S)
            if hm:
                w = clean(hm.group(1)).strip()
                ph = '/' + clean(hm.group(2)) + '/'
                if not re.match(r'^[A-Za-z][A-Za-z\-\.\s\'/]*$', w):
                    cur = None
                    continue
                cur = blank(w, '高考高频', '高频词')
                cur['phonetic'], cur['day'] = ph, day
                cur['zh'] = ''
                hot[w.lower()] = cur
                day_words[day].append(w)
                continue
            if cur is None:
                continue
            lm = re.search(r'<span class="kindle-cn-letter-circle">([释搭例])</span>', body)
            if not lm:
                continue
            kind = lm.group(1)
            zhm = re.search(r'<span class="kaiti">(.*?)</span>', body, re.S)
            zh = clean(zhm.group(1)) if zhm else ''
            body2 = re.sub(r'<span class="kindle-cn-letter-circle">.*?</span>', '', body, flags=re.S)
            body2 = re.sub(r'<span class="kaiti">.*?</span>', '', body2, flags=re.S)
            en = clean(body2)
            if kind == '释':
                cur['definition'] = (cur['definition'] + ' ' + en).strip()
            elif kind == '搭':
                add_memory(cur, LBL['搭'], en)
            elif kind == '例':
                cur['example'] = (cur['example'] + ' // ' + en).strip() if cur['example'] else en
                cur['exam'] = (en + ' ' + zh).strip()
                cur['zh'] = zh
    z.close()
    return hot, day_words


def split_en_zh(t):
    t = t.strip()
    m = re.search(r'[\u4e00-\u9fff]', t)
    if not m:
        return t.strip(), ''
    en = t[:m.start()].strip()
    return en, t[m.start():].strip()


def tidy_def(d):
    """原书把多个词性挤在一行，补空格便于阅读。"""
    return re.sub(r'(?<=[\u4e00-\u9fff；，。、）])(?=(?:n|v|vt|vi|adj|adv|prep|art|pron|conj|int|num|aux)\.)',
                  ' ', d).strip()


def main():
    words = parse_B()
    print('B 主词库:', len(words), collections.Counter(w['tier'] for w in words))
    by = {w['word'].lower(): w for w in words}

    A = parse_A()
    print('A 解析:', len(A))
    added = 0
    for a in A:
        k = a['word'].lower()
        if k in by:
            b = by[k]
            for f in ('definition', 'example', 'memory', 'phonetic'):
                if not b[f]:
                    b[f] = a[f]
        else:
            a['list'], a['tier'] = '认知词', '认知词'
            words.append(a); by[k] = a; added += 1
    print('A 补充新词:', added)

    hot, day_words = parse_C()
    print('C 高频词:', len(hot), '| Day 分组:', len(day_words))
    for w in words:
        k = w['word'].lower()
        c = hot.get(k)
        if c:
            w['hot'] = 1
            w['day'] = c['day']
            if c.get('exam'):
                w['exam'] = c['exam']
            if not w['definition']:
                w['definition'] = c['definition']
            if not w['example']:
                w['example'] = c['example']
            if c.get('memory') and not w['memory']:
                w['memory'] = c['memory']
    matched = sum(1 for w in words if w['hot'])
    print('高频标记命中:', matched, '/', len(hot))

    # C 版独有的词补入词库（B 版未收录的高频词）
    for k, c in hot.items():
        if k in by:
            continue
        c['list'], c['tier'], c['hot'] = '高考高频', '高频词', 1
        c.pop('zh', None)
        words.append(c); by[k] = c
    print('最终词库:', len(words), collections.Counter(w['tier'] for w in words))

    # 短句：从例句与真题例句中提取中英对照
    sents, seen = [], set()
    for w in words:
        chunks = [w['example']] if w['example'] else []
        for ch in chunks:
            for part in re.split(r'//', ch):
                en, zh = split_en_zh(part)
                if len(en) < 6 or not re.search(r'[A-Za-z]', en):
                    continue
                key = (w['word'].lower(), en[:60])
                if key in seen:
                    continue
                seen.add(key)
                sents.append({'en': en, 'zh': zh, 'word': w['word'], 'list': w['list']})
        if w.get('exam'):
            en, zh = split_en_zh(w['exam'])
            if len(en) >= 6:
                key = (w['word'].lower(), en[:60])
                if key not in seen:
                    seen.add(key)
                    sents.append({'en': en, 'zh': zh, 'word': w['word'], 'list': '高考真题'})
    print('短句:', len(sents))

    for w in words:
        w['definition'] = tidy_def(w['definition'])
        w.pop('zh', None)
    json.dump(words, open(os.path.join(OUT, 'words.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    json.dump(sents, open(os.path.join(OUT, 'sents.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))

    meta = {
        'total': len(words),
        'tiers': dict(collections.Counter(w['tier'] for w in words)),
        'lists': dict(collections.Counter(w['list'] for w in words)),
        'hot': sum(1 for w in words if w['hot']),
        'days': {str(d): len(v) for d, v in sorted(day_words.items())},
        'sents': len(sents),
        'with_phonetic': sum(1 for w in words if w['phonetic']),
        'with_definition': sum(1 for w in words if w['definition']),
        'with_memory': sum(1 for w in words if w['memory']),
        'with_example': sum(1 for w in words if w['example']),
        'with_exam': sum(1 for w in words if w['exam']),
    }
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print('META:', json.dumps(meta, ensure_ascii=False)[:900])
    print('\nSAMPLE:', json.dumps(words[0], ensure_ascii=False)[:600])
    print('SAMPLE SENT:', json.dumps(sents[0], ensure_ascii=False)[:300])


if __name__ == '__main__':
    main()
