"""
合并构建 rules/rules_jiedu.md：
  - 基础：rules_ziquan_compact.md（宫位含义 A01 + 四化象 A02-A09 + 星性 B01-B13）
  - 补充：rules_jingcheng_compact.md（术语、四化论断法、灾厄判断）
  - 新增：字2.pdf 提取的紫微星新规则（三步合并：跳重复→扩展→新内容）
"""
import re

# ─── 载入基础文件 ─────────────────────────────────────────────────────────────
with open('rules/rules_ziquan_compact.md', encoding='utf-8') as f:
    zq = f.read()
with open('rules/rules_jingcheng_compact.md', encoding='utf-8') as f:
    jc = f.read()

# ─── 从 jingcheng 提取关键章节 ───────────────────────────────────────────────
def extract_jc_section(heading_keyword, lines_limit=None):
    """从 jingcheng_compact 提取特定章节内容"""
    m = re.search(rf'(?m)^## [一二三四五六七八九十]+[、．]\s*{heading_keyword}.*?\n(.*?)(?=\n## |\Z)',
                  jc, re.DOTALL)
    if not m:
        return ''
    content = m.group(0)
    if lines_limit:
        lines = content.split('\n')
        content = '\n'.join(lines[:lines_limit])
    return content

jc_terms   = extract_jc_section('术语')         # 一、术语快查
jc_sihua   = extract_jc_section('四化论断')     # 六、四化论断法精要
jc_zaiE    = extract_jc_section('灾厄')         # 七、各类灾厄判断
jc_huoYong = extract_jc_section('活用')         # 九、活用预测

# 从 jingcheng 提取分析步骤（四、先天命数分析步骤 + 五、岁限运势分析）
jc_steps_raw = re.search(
    r'(?m)^## 四、先天命数分析步骤.*?(?=\n## 六|\Z)', jc, re.DOTALL)
jc_steps = jc_steps_raw.group(0) if jc_steps_raw else ''

# ─── 字2.pdf 新增规则（紫微星，已完成三步合并去重）────────────────────────────
zi2_ziwei_new = '''
**左右辅弼（关键）**
★ 不会左右：多劳碌，有成败，不能贵；因帝王星自我为中心，凡事躬亲，难成大业
★ 会左右：才能充分发挥，量度大能容人，主有成就
★ 本命会左右，大限紫微不会左右：不主孤（孤以本命为准）
★ 左右夹辅命宫≠命会左右：夹辅属外在助力，非本人特质；论个性时效果相同

**煞星影响**
★ 四煞在陷无制冲命（奴欺主）：多残疾或不善终；军人行限逢之多壮烈牺牲
★ 会煞多：孤意加重，个性不稳，心地狭小，容易奴欺主

**化权（壬年）分宫效果**
★ 化权入命身（会左右）：无往不利；无左右→仅小范围自鸣得意
★ 化权入财（庙旺）：财过旺；（陷地）：来而不全留
★ 化权入官禄：指挥一切称心；无辅则平

**化科（乙年）分宫效果**
★ 化科入命身：声誉眷顾极佳；（弱地）→虚名
★ 化科入财帛：主富；（弱地）→多奖金酬劳费，不旺
★ 化科入官禄：大而有名；（弱地）→广告极佳

**分宫新增效果**
★ 疾厄宫：主脾胃之疾、湿热、杂痨等症（扩展原有条目）
★ 田宅宫：主富裕，近有高楼、名人坟墓等，皆主吉
★ 福德宫：男命陷弱（懒散，不勤劳）；女命庙旺（安享之命）

**格局断语（来源：字2.pdf，10条新格局）**
★【紫微居午无刑忌】紫微在午宫，无羊陀化忌冲破：甲己丁年生人命至公卿
★【紫府朝垣活禄逢】三合紫府来朝，无煞冲破，再逢化禄：终生福厚至三公
★【紫府夹命贵格】仅限命宫在寅或申，紫府二星前后夹命垣：富贵双全，一生多贵人助
★【君臣庆会】命身见紫微+左右+天相昌曲+魁钺+天府+禄马，无煞冲破：极品之贵
★【桃花犯主】紫贪坐命+身命三合见廉贞/天姚/文曲/咸池等桃花星多：主男女邪淫
★【极居卯酉僧道格】紫贪在卯酉命，再逢空劫四煞：与富贵缘薄，主脱俗僧道；若加火铃→反主富贵但为人怪异
★【紫杀化权反吉】紫微七杀同宫（巳亥），壬年化权：反作祯祥，以巳宫较亥宫更佳
★【紫杀空亡虚名】紫杀同宫逢截路空亡或旬中空亡：虚有美名，祖业佳但本人无独创建树
★【紫破欺公格】紫破+武曲会羊陀冲命身：欺公祸乱，多横发一时，最终破败，煞多则凶死
★【紫破辰戌君臣不义】命身分居辰戌逢紫破：先贵终败，君臣不义；会左右或魁钺可减轻，无魁钺→对人热心但易受势利对待
★【因人而贵】命会左右，迁移宫紫微亦会左右：逢贵人因人而贵
'''

# ─── 在 ziquan B02 节后插入新规则 ───────────────────────────────────────────
# B02 在 ziquan_compact 中的位置
b02_match = re.search(r'(## B02 紫微星.*?)(\n## B03)', zq, re.DOTALL)
if b02_match:
    b02_content = b02_match.group(1)
    b02_new     = b02_content + '\n' + zi2_ziwei_new.strip()
    zq_updated  = zq[:b02_match.start()] + b02_new + zq[b02_match.end()-len('\n## B03'):]
else:
    zq_updated = zq + '\n' + zi2_ziwei_new

# ─── 组装 rules_jiedu.md ────────────────────────────────────────────────────
header = '''# 紫微斗数解读规则
> 来源：《字全》许铨仁（钦天四化）、《字精成》大德山人、《字2》（紫微星详解）
> 更新：2026-04-05 | 规则三步合并：查重→扩展→新增

---

'''

# 术语章（来源 jingcheng）
terms_section = '''## 第一章 核心术语（来源：字精成）

''' + (jc_terms.split('\n', 1)[1] if '\n' in jc_terms else jc_terms) + '\n\n---\n\n'

# 宫位+四化象章（来源 ziquan A01-A09，从 zq_updated 提取）
a_sections_match = re.search(r'(## A01.*?)(?=## B01)', zq_updated, re.DOTALL)
a_sections = a_sections_match.group(1) if a_sections_match else ''

a_chapter = '''## 第二章 十二宫含义与四化象（来源：字全·钦天四化）

''' + a_sections + '\n---\n\n'

# 四化论断法章（来源 jingcheng）
sihua_section = '''## 第三章 四化论断法精要（来源：字精成）

''' + (jc_sihua.split('\n', 1)[1] if '\n' in jc_sihua else jc_sihua) + '\n\n---\n\n'

# 分析方法章（来源 jingcheng）
steps_section = '''## 第四章 先天命数与运势分析方法（来源：字精成）

''' + jc_steps + '\n\n---\n\n'

# 星性章（来源 ziquan B01-B13，含字2新增）
b_sections_match = re.search(r'(## B01.*)', zq_updated, re.DOTALL)
b_sections = b_sections_match.group(1) if b_sections_match else ''

b_chapter = '''## 第五章 星曜性情·疾病·职业（来源：字全 + 字2新增）

''' + b_sections + '\n\n---\n\n'

# 灾厄章（来源 jingcheng）
zaie_section = '''## 第六章 各类灾厄判断（来源：字精成）

''' + (jc_zaiE.split('\n', 1)[1] if '\n' in jc_zaiE else jc_zaiE) + '\n\n---\n\n'

# 活用章（来源 jingcheng）
huoyong_section = '''## 第七章 活用预测方法（来源：字精成）

''' + (jc_huoYong.split('\n', 1)[1] if '\n' in jc_huoYong else jc_huoYong)

result = header + terms_section + a_chapter + sihua_section + steps_section + b_chapter + zaie_section + huoyong_section

with open('rules/rules_jiedu.md', 'w', encoding='utf-8') as f:
    f.write(result)

print(f'rules_jiedu.md: {len(result):,} chars, {len(result.splitlines())} lines')
print('Done.')
