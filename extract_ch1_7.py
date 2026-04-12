"""Extract chapters 1-7 from 字精成.pdf (PDF pages 8-99)"""
import pdfplumber

pdf_path = 'books/字精成.pdf'
out_raw = 'rules/ch1_7_raw.txt'
out_rules = 'rules/rules_jingcheng_ch1_7.md'

print('Extracting ch1-7 (PDF pages 8-99)...')

with pdfplumber.open(pdf_path) as pdf:
    raw_text = ''
    for i in range(7, 100):  # pages 8-100 (0-indexed 7-99)
        text = (pdf.pages[i].extract_text() or '').replace('戍', '戌')
        raw_text += f'\n[PAGE{i+1}]\n{text}'

with open(out_raw, 'w', encoding='utf-8') as f:
    f.write(raw_text)

print(f'Raw text saved: {len(raw_text)} chars')

# Now parse into structured rules
lines = raw_text.split('\n')

rules = []
rules.append('# 字精成 第一至七章 规则提取\n')
rules.append('## 第一章 基础知识\n')
rules.append('（阴阳五行、天干地支基础——已在rule1中实现，此处略）\n')

rules.append('\n## 第二章 排盘方法步骤\n')
rules.append('（排盘算法——已在rule1中实现，此处略）\n')

# Extract ch3 onwards - collect significant text blocks
current_section = None
current_text = []

def flush_section():
    if current_section and current_text:
        text = ' '.join(current_text).strip()
        if len(text) > 50:
            rules.append(f'\n### {current_section}\n')
            rules.append(text + '\n')

import re

for line in lines:
    line = line.strip()
    if not line or line.startswith('[PAGE') or line.isdigit():
        continue

    # Detect section headers
    if re.match(r'第[三四五六七八]章', line) or re.match(r'第[一二三四五六七]节', line):
        flush_section()
        current_section = line
        current_text = []
    elif current_section and len(line) > 5:
        current_text.append(line)

flush_section()

# Write structured rules file
with open(out_rules, 'w', encoding='utf-8') as f:
    f.write('\n'.join(rules))

print(f'Rules saved to {out_rules}')
print('Done!')
