# 把书按主星拆开：每颗星一个文件，只收提到该星的段落（前后各带2行），标明书名和行号。
# 空格全部去掉（精成原文字间有空格，去掉才能搜到星名，也更省字数）。
# 用法：python3 split_by_star.py   输出到 books/by_star/
import os, re
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'books')
BOOKS = [  # (书名, 文件)
 ('精成', 'txt/jc.txt'), ('全书卷一', 'quanshu_卷一_raw.txt'), ('全书卷二', 'quanshu_卷二_raw.txt'),
 ('全书卷三', 'quanshu_卷三_raw.txt'), ('字全2', 'txt/字全2.txt'), ('字陆', 'txt/字陆.txt'),
 ('南北派', 'zi_nanbeipai_raw.txt'), ('字全书', '字全书_extracted.txt'), ('令东来', 'txt/字令.txt'),
 ('听课笔记', 'txt/字听课笔记.txt'), ('内部讲义', 'neibu_raw.txt'), ('命理新编下', 'mingli_xinbian_xia_raw.txt'),
 ('字3', 'zi3_raw.txt'), ('字4', 'zi4_raw.txt'),
]
STARS = {'紫微':['紫微'],'天机':['天机','天機'],'太阳':['太阳','太陽'],'武曲':['武曲'],'天同':['天同'],
 '廉贞':['廉贞','廉貞'],'天府':['天府'],'太阴':['太阴','太陰'],'贪狼':['贪狼','貪狼'],'巨门':['巨门','巨門'],
 '天相':['天相'],'天梁':['天梁'],'七杀':['七杀','七殺'],'破军':['破军','破軍']}
CTX = 2
out = os.path.join(B, 'by_star'); os.makedirs(out, exist_ok=True)
texts = {}
for name, f in BOOKS:
    p = os.path.join(B, f)
    if not os.path.exists(p): print('缺', f); continue
    lines = open(p, encoding='utf-8', errors='ignore').read().splitlines()
    texts[name] = [x for x in (re.sub(r'\s+', '', l) for l in lines) if x]
for star, keys in STARS.items():
    pat = re.compile('|'.join(keys)); parts = []; total = 0
    for name, lines in texts.items():
        hit = [i for i, l in enumerate(lines) if pat.search(l)]
        if not hit: continue
        spans = []
        for i in hit:
            a, b = max(0, i-CTX), min(len(lines)-1, i+CTX)
            if spans and a <= spans[-1][1]+1: spans[-1][1] = b
            else: spans.append([a, b])
        parts.append(f'\n######## {name}（{len(hit)}处）########')
        for a, b in spans:
            parts.append(f'--- {name} 第{a+1}行 ---'); parts += lines[a:b+1]
        total += len(hit)
    open(os.path.join(out, star+'.txt'), 'w', encoding='utf-8').write('\n'.join(parts))
    print(star, total, '处', sum(len(x) for x in parts)//1000, 'K字')
