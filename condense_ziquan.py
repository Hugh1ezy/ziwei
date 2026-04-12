"""Condense rules_ziquan.md → rules_ziquan_compact.md
策略：
 - A sections：保留全文（已是规则性文字）
 - B sections：每星保留 ①五行属性行 ②. 开头要点 ③ ★ 开头规则 ④疾病/职业关键词行
"""
import re

SRC  = 'rules/rules_ziquan.md'
DEST = 'rules/rules_ziquan_compact.md'

with open(SRC, encoding='utf-8') as f:
    raw = f.read()

# ── 按 section 切割 ──────────────────────────────────────────────────────────
section_re = re.compile(r'^(## [AB]\d+[^\n]*)\n', re.MULTILINE)
parts = section_re.split(raw)
# parts = [前言, header1, body1, header2, body2, ...]
preamble = parts[0]
sections = []
for i in range(1, len(parts), 2):
    header = parts[i]
    body   = parts[i+1] if i+1 < len(parts) else ''
    sections.append((header, body))

def is_disease_summary(l):
    """疾病症状总结行：多个疾病词 or 含 '主xxx之疾/症' 格式"""
    disease_kw = ['症','疾','肺','肝','胆','肾','脾','胃','肠','血光','神经','癌','痛','炎','亏','带之']
    hit = sum(1 for k in disease_kw if k in l)
    has_list = '、' in l and ('如' in l or '等' in l)
    return (hit >= 2 or (hit >= 1 and has_list)) and len(l) > 12

def is_career_summary(l):
    """事物/职业总结行：含'事物行业论' 或 多个行业词以、分隔且有……等"""
    if '事物行业论' in l: return True
    if re.search(r'业.*、.*业|师.*、.*师|员.*、.*员', l): return True
    if '……等' in l and re.search(r'[业师员馆局店公司机构]', l): return True
    return False

def condense_b(header, body):
    lines = [l.strip() for l in body.split('\n')]
    out = [header]
    attr_done    = False
    disease_added = False
    career_added  = False

    for l in lines:
        if not l or l == '-': continue
        text = l[2:] if l.startswith('- ') else l

        # 第一行：五行属性行（必须含五行字符且有星/宿/主）
        if not attr_done and re.search(r'[金木水火土][金木水火土]?.*[星宿主]|化气曰', text):
            out.append(f'- {text}')
            attr_done = True
            continue

        # . 开头：核心特征要点（全部保留）
        if text.startswith('.'):
            out.append(f'- {text}')
            continue

        # ★ 开头：宫位规则（全部保留）
        if text.startswith('★'):
            out.append(f'- {text}')
            continue

        # 疾病症状总结行（每星最多一条）
        if not disease_added and is_disease_summary(text):
            out.append(f'- 【疾】{text}')
            disease_added = True
            continue

        # 事物/职业行（每星最多一条）
        if not career_added and is_career_summary(text):
            out.append(f'- 【业】{text}')
            career_added = True
            continue

    return '\n'.join(out)

output = [preamble.rstrip()]

for header, body in sections:
    if header.startswith('## A'):
        # A sections: 全保留
        output.append(header)
        output.append(body.rstrip())
    else:
        # B sections: 精简
        output.append(condense_b(header, body))
        output.append('')

result = '\n'.join(output)

with open(DEST, 'w', encoding='utf-8') as f:
    f.write(result)

orig_size = len(raw)
new_size  = len(result)
print(f'原始: {orig_size:,} chars → 精简: {new_size:,} chars ({new_size*100//orig_size}%)')
print(f'输出: {DEST}')
