"""
精简汇编 字精成.pdf 全书规则 → rules_jingcheng_compact.md
策略：
  - 不重复ch8/ch9（已在rule2_mingong.json/rule2_other_palaces.json中）
  - 提取：术语表、星曜分级、十二宫意义、分析方法、运限规则、四化规则、灾厄规则
  - 最大程度精简，保证准确性
"""
import re

def read_raw(path):
    with open(path, encoding='utf-8') as f:
        return f.read().replace('戍','戌')

def extract_section(raw, start_kw, end_kw=None, max_chars=None):
    """从raw文本中提取start_kw到end_kw之间的段落"""
    idx = raw.find(start_kw)
    if idx < 0:
        return ''
    if end_kw:
        end = raw.find(end_kw, idx + len(start_kw))
        if end < 0:
            end = idx + (max_chars or 20000)
    else:
        end = idx + (max_chars or 20000)
    return raw[idx:end]

def clean_lines(text, min_len=8, skip_patterns=None):
    """提取有意义的行"""
    skip = skip_patterns or []
    result = []
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        if re.match(r'^\[PAGE\d+\]$|^\d{1,3}$', line):
            continue
        if len(line) < min_len:
            continue
        if any(re.search(p, line) for p in skip):
            continue
        result.append(line)
    return result


# ═══════════════════════════════════════
# 读取原始文本
# ═══════════════════════════════════════
print('Reading files...')
raw17   = read_raw('rules/ch1_7_raw.txt')
raw1012 = read_raw('rules/ch10_12_raw.txt')
raw1314 = read_raw('rules/ch13_14_raw.txt')
raw15ap = read_raw('rules/ch15_app_raw.txt')

out = []

# ═══════════════════════════════════════
# 一、术语快查
# ═══════════════════════════════════════
out.append('# 字精成 规则精简汇编\n')
out.append('> ch8/ch9星情已在rule2_mingong.json和rule2_other_palaces.json中，本文不重复。\n')

out.append('\n## 一、术语快查\n')
terms = [
    '**正星14颗**：紫微、天机、太阳、武曲、天同、廉贞、天府、太阴、贪狼、巨门、天相、天梁、七杀、破军',
    '**六吉星**：左辅、右弼、天魁、天钺、文昌、文曲；加禄存、天马为八吉',
    '**四煞**：擎羊、陀罗、火星、铃星；加天空、地劫为六煞',
    '**四化**：化禄（吉/财）、化权（权/竞争）、化科（名/贵人）、化忌（凶/损耗）',
    '**三方四正**：本宫+三合两宫+对冲宫，为论命主线',
    '**朝/冲**：吉星居对宫=朝，凶/化忌在对宫=冲',
    '**辅/夹**：吉星分居两邻宫=辅，凶星夹=夹',
    '**庙>旺>得地>利益>平和>陷落**：星曜亮度六级，庙旺充分发挥，陷落全无力',
    '**四恶曜**：杀破廉贪（七杀、破军、廉贞、贪狼），失陷遇煞大凶，入庙反具横发力',
    '**杀破狼**：永远三合会照，限年逢之主变革开创',
    '**大限**：每10年一段；**小限**：逐年流动；**流年**：当年运气',
    '**天罗地网**：辰宫（天罗）、戌宫（地网），捆绑之象',
    '**旬空**：当年干支所在旬中缺失的两地支，所属宫位运气受损',
    '**截空**：生年干支决定，所落宫位亦主空亡',
]
for t in terms:
    out.append(f'- {t}')


# ═══════════════════════════════════════
# 二、星曜分级分类
# ═══════════════════════════════════════
out.append('\n\n## 二、星曜分级（甲乙丙）\n')

# Extract from ch4 area in ch1_7_raw
ch4_text = extract_section(raw17, '第四章', '第五章', 8000)
ch4_lines = clean_lines(ch4_text, min_len=6)

# Filter to keep classification-related lines
classification_keywords = ['甲级','乙级','丙级','南斗','北斗','中天','吉星','煞星','正星','辅星',
                            '紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼',
                            '巨门','天相','天梁','七杀','破军','左辅','右弼','文昌','文曲',
                            '天魁','天钺','禄存','天马','擎羊','陀罗','火星','铃星','天空','地劫',
                            '分类','分级','属']
kept = []
for l in ch4_lines[:150]:
    if any(k in l for k in classification_keywords) or (len(l) < 60 and re.search(r'[甲乙丙]级|[南北中]斗|正星|辅星', l)):
        kept.append(f'- {l}')
for l in kept[:60]:
    out.append(l)


# ═══════════════════════════════════════
# 三、十二宫基本意义
# ═══════════════════════════════════════
out.append('\n\n## 三、十二宫意义\n')

palaces = [
    ('命宫', '本人性格、才华、容貌、先天命势、一生概况'),
    ('兄弟宫', '兄弟姐妹情况；亦代表本人交友、合伙及钱财流通'),
    ('夫妻宫', '配偶情况及婚姻状况；亦看异性缘'),
    ('子女宫', '子女及下属情况；亦看性生活及创意'),
    ('财帛宫', '本人财运、收支情况、理财能力'),
    ('疾厄宫', '健康、疾病；亦看意外伤害'),
    ('迁移宫', '出行、迁移、外地发展；亦看外在环境与人际'),
    ('奴仆宫', '部下、朋友、合伙人；亦看员工关系'),
    ('官禄宫', '事业、职业、名誉、社会地位'),
    ('田宅宫', '不动产、家宅、家庭环境；亦看存款积累'),
    ('福德宫', '精神享受、修养、福气；亦看内心世界'),
    ('父母宫', '父母情况；亦看上司、长辈；亦代表文书、容貌'),
]
for gong, meaning in palaces:
    out.append(f'- **{gong}**：{meaning}')


# ═══════════════════════════════════════
# 四、先天命数分析步骤
# ═══════════════════════════════════════
out.append('\n\n## 四、先天命数分析步骤\n')

ch6_text = extract_section(raw17, '第六章', '[PAGE', 15000)
ch6_lines = clean_lines(ch6_text, min_len=10)

# 手工添加核心步骤（从文本中归纳）
steps = [
    '1. **看命宫**：确定命主基本性情与格局高低（主星庙旺=格高）',
    '2. **看三方四正**：命宫+财帛+官禄+迁移，综合判断命格',
    '3. **看身宫**：补充命宫不足，增强或削弱命主某方面特质',
    '4. **看命身合一宫**：命身同宫力量集中，性格鲜明',
    '5. **看格局**：有无特殊格局（如紫府朝垣、日月照壁等）',
    '6. **看六亲宫**：逐一分析兄/夫/子/父/奴等宫星情',
    '7. **看主星庙陷**：庙旺星发挥吉性，陷落星暴露凶性',
    '8. **看吉凶星组合**：吉星会聚=格局提升；四煞加会=破格',
    '9. **看四化**：生年四化落宫，定先天吉凶的触发宫位',
    '10. **综合论断**：先看大势，再断细节；先看本宫，再看三方',
]
for s in steps:
    out.append(s)

# 格局相关
out.append('\n### 格局要点')
out.append('- **吉格条件**：命宫主星庙旺+三方有吉星扶助+无六煞冲破')
out.append('- **凶格条件**：主星陷落+四煞齐聚+化忌冲命')
out.append('- **中等格**：有吉有凶，看大运流年是否引动吉凶')
out.append('- **杀破狼格**：三方杀破狼聚，主变动开创，入庙富贵，失陷漂泊')
out.append('- **机月同梁格**：天机、太阴、天同、天梁聚，宜公职安稳')
out.append('- **紫府朝垣**：紫微天府同宫或三方会，主大贵')
out.append('- **日月照壁**：太阳太阴对照命宫（子午/卯酉轴），主名望')


# ═══════════════════════════════════════
# 五、大小限流年分析方法
# ═══════════════════════════════════════
out.append('\n\n## 五、岁限运势分析\n')

# Extract ch10 key content
ch10_text = extract_section(raw1012, '第十章', '第十一章', 40000)
ch10_lines = clean_lines(ch10_text, min_len=10)

# Key methodology lines
method_keywords = ['大限', '小限', '流年', '流月', '流日', '太岁', '化忌', '化禄',
                   '四化', '天干', '吉凶', '看法', '论断', '分析', '步骤', '方法',
                   '三方', '本宫', '对宫', '引动', '冲破', '合']
kept = []
for l in ch10_lines:
    if any(k in l for k in method_keywords) and len(l) > 15:
        kept.append(l)

# Deduplicate similar lines
seen_prefixes = set()
deduped = []
for l in kept:
    prefix = l[:20]
    if prefix not in seen_prefixes:
        seen_prefixes.add(prefix)
        deduped.append(l)

for l in deduped[:120]:
    out.append(f'- {l}')


# ═══════════════════════════════════════
# 六、四化论断法精要
# ═══════════════════════════════════════
out.append('\n\n## 六、四化论断法精要（南北派结合）\n')

out.append('\n### 6.1 四化基本含义')
sihua = [
    '**化禄**：财禄、桃花、增益，入何宫则该宫事项有收获/机遇',
    '**化权**：权力、竞争、固执，入何宫则该宫事项有掌控欲/竞争',
    '**化科**：名誉、文才、贵人缘，入何宫则该宫事项有助力/文书',
    '**化忌**：阻滞、损耗、执着，入何宫则该宫事项有麻烦/破损',
]
for s in sihua:
    out.append(f'- {s}')

out.append('\n### 6.2 河洛数理基础')
heluo = [
    '先天八卦数：乾1兑2离3震4巽5坎6艮7坤8',
    '后天八卦数：坎1坤2震3巽4中5乾6兑7艮8离9',
    '河图口诀：一六共宗居北，二七同道居南，三八为朋居东，四九为友居西，五十居中',
    '同宫数之和=5或10→有缘/合；差为5→互为对冲',
]
for h in heluo:
    out.append(f'- {h}')

out.append('\n### 6.3 宫位太极转换')
taiji = [
    '命宫为原太极；任意宫均可作为新太极（该宫主事之人的命宫）',
    '以兄弟宫为太极→看兄弟命运；以夫妻宫为太极→看配偶命运',
    '新太极点后的十二宫顺序同原命盘，吉凶判断方法相同',
    '原命盘为体（我），新命盘为用（六亲）；两盘联动分析',
]
for t in taiji:
    out.append(f'- {t}')

out.append('\n### 6.4 四化入宫关键规则')
# Extract from ch14 the key 化禄/化权/化科/化忌 rules
ch14_text = extract_section(raw1314, '第十四章', '', 60000)
ch14_lines = clean_lines(ch14_text, min_len=12)

sihua_rules = []
for l in ch14_lines:
    if re.search(r'化[禄权科忌].{2,20}[入宫冲照]|[入宫冲照].{2,15}化[禄权科忌]', l):
        sihua_rules.append(l)
    elif re.search(r'化忌|化禄|化权|化科', l) and len(l) < 80:
        sihua_rules.append(l)

seen = set()
for l in sihua_rules[:100]:
    key = l[:30]
    if key not in seen:
        seen.add(key)
        out.append(f'- {l}')

out.append('\n### 6.5 流年四化看法')
liunian_rules = [
    '流年=命盘"人盘"，看当年发生之事',
    '流年四化入原命宫→当年命主本人的吉凶总体',
    '流年化忌入财帛→破财之年；入疾厄→有病；入官禄→事业受阻',
    '流年化禄+流年化忌同宫→有得有失，财来财去',
    '大限化忌冲流年化忌→双忌聚，大凶之年',
    '流年化禄叠原命化禄（同宫）→财运大旺之年',
    '看流年：先看大限盘，再看流年盘，以大限为体、流年为用',
]
for r in liunian_rules:
    out.append(f'- {r}')


# ═══════════════════════════════════════
# 七、各类灾厄判断
# ═══════════════════════════════════════
out.append('\n\n## 七、各类灾厄判断\n')

ch12_text = extract_section(raw1012, '第十二章', '', 25000)
ch12_lines = clean_lines(ch12_text, min_len=10)

disaster_keywords = ['伤', '灾', '病', '破财', '官司', '车祸', '火灾', '刑', '狱',
                     '投河', '自杀', '动物', '雷电', '中毒', '吸毒', '失窃',
                     '凶星', '煞星', '化忌', '擎羊', '陀罗', '火星', '铃星']
disaster_lines = []
for l in ch12_lines:
    if any(k in l for k in disaster_keywords) and len(l) > 12:
        disaster_lines.append(l)

seen = set()
current_section = None
for l in ch12_lines[:400]:
    if re.match(r'第[一二三四五六七八九十]+节|第\d+[节節]', l):
        out.append(f'\n### {l}')
        current_section = l
    elif any(k in l for k in disaster_keywords) and len(l) > 12:
        key = l[:25]
        if key not in seen:
            seen.add(key)
            out.append(f'- {l}')


# ═══════════════════════════════════════
# 八、附录一：星情基本要义表
# ═══════════════════════════════════════
out.append('\n\n## 八、附录一 星情基本要义（精简版）\n')

app_text = extract_section(raw15ap, '附录一', '', 30000)
app_lines = clean_lines(app_text, min_len=8)

# The star table is complex - extract star entries
# Stars to look for
star_names = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼',
              '巨门','天相','天梁','七杀','破军','禄存','天马','文昌','文曲',
              '天魁','天钺','左辅','右弼','擎羊','陀罗','火星','铃星','天空','地劫']

# Collect star descriptions - the PDF table is multi-column so we need to reconstruct
# Try to find 2-char sequences matching star names followed by content
current_star = None
star_entries = {}
for l in app_lines:
    # Check if line starts with or contains a star name reference
    found_star = None
    for sn in star_names:
        if l.startswith(sn) and len(l) > len(sn) + 3:
            found_star = sn
            break
    if found_star:
        current_star = found_star
        star_entries[found_star] = l[len(found_star):].strip()
    elif current_star and len(l) > 10 and l[0] not in '第一二三四五六七八九十节':
        # Continuation
        if current_star in star_entries:
            star_entries[current_star] += '；' + l
            if len(star_entries[current_star]) > 200:
                current_star = None  # Move on

# Write star entries
if star_entries:
    out.append('| 星名 | 化气/象 | 要义 |')
    out.append('|--|--|--|')
    for sn in star_names:
        if sn in star_entries:
            entry = star_entries[sn][:150]
            # Try to extract huaqi (化气) from first part
            out.append(f'| {sn} | - | {entry} |')
else:
    # Fallback: just dump the raw lines
    for l in app_lines[:150]:
        out.append(f'- {l}')


# ═══════════════════════════════════════
# 九、活测预测方法（ch15精要）
# ═══════════════════════════════════════
out.append('\n\n## 九、活用斗数预测（精要）\n')

ch15_text = extract_section(raw15ap, '第十五章', '附录一', 20000)
ch15_lines = clean_lines(ch15_text, min_len=12)

# Key methodology
method_kw = ['测', '看', '宫', '星', '化忌', '化禄', '用神', '本宫', '太极', '方法']
ch15_kept = []
seen = set()
for l in ch15_lines:
    if any(k in l for k in method_kw) and len(l) < 100:
        key = l[:25]
        if key not in seen:
            seen.add(key)
            ch15_kept.append(l)

for l in ch15_kept[:80]:
    out.append(f'- {l}')


# ═══════════════════════════════════════
# 写文件
# ═══════════════════════════════════════
compact = '\n'.join(out)
out_path = 'rules/rules_jingcheng_compact.md'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(compact)

print(f'Written: {out_path}')
print(f'Size: {len(compact):,} chars, {len([l for l in compact.split(chr(10)) if l.strip()])} lines')
