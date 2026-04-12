"""
Extract rules from all raw chapter text files of 字精成.pdf
Writes structured markdown rule files.
"""
import re

def clean(text):
    """Clean up extracted text lines."""
    text = text.strip()
    # Remove pure page numbers
    if re.match(r'^\[PAGE\d+\]$', text) or re.match(r'^\d{1,3}$', text):
        return ''
    return text

def read_raw(path):
    with open(path, encoding='utf-8') as f:
        return f.read().replace('戍','戌')

def lines_from(text):
    return [l.strip() for l in text.split('\n') if l.strip() and not re.match(r'^\[PAGE\d+\]$|^\d{1,3}$', l.strip())]

def join_lines(ls, min_len=5):
    result = []
    buf = ''
    for l in ls:
        if len(l) < min_len and buf:
            buf += l
        elif l.endswith('，') or l.endswith('；') or l.endswith('：') or l.endswith('、'):
            buf += l
        else:
            if buf:
                result.append(buf + l)
                buf = ''
            else:
                result.append(l)
    if buf:
        result.append(buf)
    return result

# ─────────────────────────────────────────────
# CH1-7 extraction
# ─────────────────────────────────────────────
def extract_ch1_7(raw):
    out = ['# 字精成 第一至七章 规则要点\n']
    out.append('> 第一、二章为基础知识和排盘方法，已在rule1中实现，此处只补充论断相关内容。\n')

    ls = lines_from(raw)

    # Find chapter boundaries
    ch3_start = next((i for i,l in enumerate(ls) if '第三章' in l), 0)
    ch4_start = next((i for i,l in enumerate(ls) if '第四章' in l), ch3_start)
    ch5_start = next((i for i,l in enumerate(ls) if '第五章' in l), ch4_start)
    ch6_start = next((i for i,l in enumerate(ls) if '第六章' in l), ch5_start)

    # CH3: 术语解释
    out.append('\n## 第三章 术语解释\n')
    sec = ls[ch3_start:ch4_start]
    for l in sec:
        if '第三章' in l or len(l)<4:
            continue
        if re.match(r'[\u4e00-\u9fff]{2,8}[：:]', l) or re.match(r'\d+[、．]', l):
            out.append(f'- {l}')
        elif len(l) > 10:
            out.append(l)

    # CH4: 星曜分级
    out.append('\n## 第四章 诸星分级分类\n')
    sec = ls[ch4_start:ch5_start]
    for l in sec:
        if '第四章' in l or len(l)<4:
            continue
        out.append(l)

    # CH5: 十二宫意义
    out.append('\n## 第五章 十二宫意义\n')
    sec = ls[ch5_start:ch6_start]
    current_gong = None
    for l in sec:
        if '第五章' in l: continue
        gong_match = re.match(r'([命兄夫子财疾迁奴官田福父]\w{0,2}宫)', l)
        if gong_match:
            if current_gong:
                out.append('')
            current_gong = gong_match.group(1)
            out.append(f'\n### {current_gong}')
        elif current_gong and len(l) > 8:
            out.append(f'- {l}')

    # CH6: 分析推演
    out.append('\n## 第六章 分析推演方法\n')
    sec = ls[ch6_start:]
    for l in sec:
        if '第六章' in l: continue
        if re.match(r'第[一二三四五六七八九十]+节', l):
            out.append(f'\n### {l}')
        elif len(l) > 8:
            out.append(f'- {l}' if not l.startswith('-') else l)

    return '\n'.join(out)

# ─────────────────────────────────────────────
# CH10-12 extraction
# ─────────────────────────────────────────────
def extract_ch10_12(raw):
    out = ['# 字精成 第十至十二章 规则要点\n']
    ls = lines_from(raw)

    ch10_start = next((i for i,l in enumerate(ls) if '第十章' in l and '运势' in l), 0)
    ch11_start = next((i for i,l in enumerate(ls) if '第十一章' in l), len(ls))
    ch12_start = next((i for i,l in enumerate(ls) if '第十二章' in l), len(ls))

    # CH10
    out.append('\n## 第十章 岁限运势分析\n')
    sec = ls[ch10_start:ch11_start]
    for l in sec:
        if '第十章' in l: continue
        if re.match(r'第[一二三四五六七八九十]+节', l):
            out.append(f'\n### {l}')
        elif re.match(r'[△☆◎一二三四五六七八九十]\w', l) or re.match(r'\d+[、．]', l):
            out.append(f'- {l}')
        elif len(l) > 10:
            out.append(f'- {l}')

    # CH11: 只提炼方法论，不复述命例
    out.append('\n## 第十一章 命例推演（方法要点）\n')
    sec = ls[ch11_start:ch12_start]
    # Only include methodological passages (skip specific name references)
    skip_names = {'蒋介石','毛泽东','例一','例二','例三','例四'}
    for l in sec:
        if '第十一章' in l: continue
        if any(n in l for n in skip_names): continue
        if re.match(r'[△☆]', l):
            out.append(f'\n**{l.lstrip("△☆").strip()}**')
        elif len(l) > 15:
            out.append(f'- {l}')

    # CH12: 灾厄预测
    out.append('\n## 第十二章 预测灾厄\n')
    sec = ls[ch12_start:]
    for l in sec:
        if '第十二章' in l: continue
        if re.match(r'第[一二三四五六七八九十]+节', l):
            out.append(f'\n### {l}')
        elif re.match(r'\d+[、．]|[△☆◎]', l):
            out.append(f'- {l}')
        elif len(l) > 8:
            out.append(f'- {l}')

    return '\n'.join(out)

# ─────────────────────────────────────────────
# CH13-14 extraction
# ─────────────────────────────────────────────
def extract_ch13_14(raw):
    out = ['# 字精成 第十三至十四章 规则要点\n']
    ls = lines_from(raw)

    ch13_start = next((i for i,l in enumerate(ls) if '第十三章' in l), 0)
    ch14_start = next((i for i,l in enumerate(ls) if '第十四章' in l), len(ls))

    # CH13: 八卦类象
    out.append('\n## 第十三章 八卦卦位万物类象\n')
    sec = ls[ch13_start:ch14_start]
    current_gua = None
    for l in sec:
        if '第十三章' in l: continue
        if re.match(r'[△☆]?\d*[、．]?[乾坤震巽坎离艮兑]卦', l):
            current_gua = l.strip('△☆').strip()
            out.append(f'\n### {current_gua}')
        elif current_gua and len(l) > 5:
            out.append(f'- {l}')
        elif len(l) > 5:
            out.append(f'- {l}')

    # CH14: 四化论断法
    out.append('\n## 第十四章 四化论断法\n')
    sec = ls[ch14_start:]
    for l in sec:
        if '第十四章' in l: continue
        if re.match(r'第[一二三四五六七八九十]+节', l):
            out.append(f'\n### {l}')
        elif re.match(r'[△☆◎一二三四五六七八九十]\w', l):
            out.append(f'\n**{l}**')
        elif re.match(r'\d+[、．]|化[禄权科忌]', l):
            out.append(f'- {l}')
        elif len(l) > 8:
            out.append(f'- {l}')

    return '\n'.join(out)

# ─────────────────────────────────────────────
# CH15 + Appendix extraction
# ─────────────────────────────────────────────
def extract_ch15_app(raw):
    out = ['# 字精成 第十五章及附录一 规则要点\n']
    ls = lines_from(raw)

    ch15_start = next((i for i,l in enumerate(ls) if '第十五章' in l), 0)
    app1_start = next((i for i,l in enumerate(ls) if '附录一' in l or '斗数星情基本要义表' in l), len(ls))

    # CH15: 活用预测
    out.append('\n## 第十五章 活用斗数预测百事\n')
    sec = ls[ch15_start:app1_start]
    for l in sec:
        if '第十五章' in l: continue
        if re.match(r'第[一二三四五六七八九十]+[节節]', l) or re.match(r'\d+[、．]测', l):
            out.append(f'\n### {l}')
        elif re.match(r'[△☆◎]', l):
            out.append(f'\n**{l.lstrip("△☆◎")}**')
        elif re.match(r'\d+[、．]|[一二三四五六七八九十]+[、．]', l):
            out.append(f'- {l}')
        elif len(l) > 8:
            out.append(f'- {l}')

    # Appendix 1: Star table
    out.append('\n## 附录一 斗数星情基本要义表\n')
    out.append('| 星名 | 斗分 | 五行 | 化气 | 基本要义 |\n|--|--|--|--|--|')
    sec = ls[app1_start:]
    # The table content is tricky to parse from PDF - collect lines and group
    star_lines = [l for l in sec if len(l) > 4 and '附录' not in l and '斗数星情' not in l]
    # Output raw lines for the appendix since table parsing is complex
    for l in star_lines[:200]:  # cap at 200 lines
        out.append(f'- {l}')

    return '\n'.join(out)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
print('Reading raw files...')

files = {
    'ch1_7':    'rules/ch1_7_raw.txt',
    'ch10_12':  'rules/ch10_12_raw.txt',
    'ch13_14':  'rules/ch13_14_raw.txt',
    'ch15_app': 'rules/ch15_app_raw.txt',
}

raws = {}
for k, path in files.items():
    raws[k] = read_raw(path)
    print(f'  {path}: {len(raws[k]):,} chars')

print('\nExtracting rules...')

results = {
    'ch1_7':    extract_ch1_7(raws['ch1_7']),
    'ch10_12':  extract_ch10_12(raws['ch10_12']),
    'ch13_14':  extract_ch13_14(raws['ch13_14']),
    'ch15_app': extract_ch15_app(raws['ch15_app']),
}

out_files = {
    'ch1_7':    'rules/rules_jingcheng_ch1_7.md',
    'ch10_12':  'rules/rules_jingcheng_ch10_12.md',
    'ch13_14':  'rules/rules_jingcheng_ch13_14.md',
    'ch15_app': 'rules/rules_jingcheng_ch15_app.md',
}

for k, content in results.items():
    path = out_files[k]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  Written {path}: {len(content):,} chars')

print('\nDone! All rule files written.')
