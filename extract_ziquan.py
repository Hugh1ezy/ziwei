"""Extract all content from 字全.pdf (钦天四化紫微斗数)"""
import pdfplumber
import re

fname = 'books/字全.pdf'
out_raw  = 'rules/ziquan_raw.txt'
out_rules = 'rules/rules_ziquan.md'

print('Extracting...')

with pdfplumber.open(fname) as pdf:
    total = len(pdf.pages)
    raw = ''
    for i in range(total):
        text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
        raw += f'\n[PAGE{i+1}]\n{text}'

with open(out_raw, 'w', encoding='utf-8') as f:
    f.write(raw)

print(f'Raw: {len(raw):,} chars, {total} pages')

# ─── Parse into rules ───────────────────────────────────────────────
lines = [l.strip() for l in raw.split('\n')]

def is_skip(l):
    if not l: return True
    if re.match(r'^\[PAGE\d+\]$|^\d{1,3}$', l): return True
    if '钦天四化紫微斗数命理学' in l and len(l) < 30: return True
    if '许铨仁老讲述' in l: return True
    if '整理版' in l and len(l) < 10: return True
    return False

clean = [l for l in lines if not is_skip(l)]

out = []
out.append('# 钦天四化紫微斗数命理学 规则提取\n')
out.append('> 许铨仁老师讲述，北派钦天四化体系，重宫象星三合一\n')

current_section = None
current_buf = []

def flush():
    if current_section and current_buf:
        out.append(f'\n## {current_section}\n')
        for l in current_buf:
            if len(l) > 6:
                out.append(f'- {l}' if not l.startswith('-') else l)

for l in clean:
    # Section header: A01, A02... or 宫-specific headers
    if re.match(r'^[AB]\d{2}', l):
        flush()
        current_section = l
        current_buf = []
    elif re.match(r'^[命兄夫子财疾迁奴官田福父].{0,3}宫[，,]?$', l) or re.match(r'^[命兄夫子财疾迁奴官田福父].{0,3}宫$', l):
        # Palace sub-header
        current_buf.append(f'\n**{l}**')
    elif re.match(r'^[★◎△☆●]', l):
        current_buf.append(l)
    elif re.match(r'^[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩]|^[①②③④⑤⑥⑦⑧⑨⑩]|^[一二三四五六七八九十]+[、．]', l):
        current_buf.append(f'\n**{l}**')
    elif current_section and len(l) > 10:
        current_buf.append(l)

flush()

rules_text = '\n'.join(out)
with open(out_rules, 'w', encoding='utf-8') as f:
    f.write(rules_text)

print(f'Rules: {len(rules_text):,} chars → {out_rules}')
print('Done!')
