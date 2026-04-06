# 紫微斗数排盘系统 — 强制开发指令

---

## 一、技术架构

- **前端**：单一 `ziwei.html`（HTML + CSS + JS，无框架）
- **农历**：CDN 引用 `lunar-javascript` 开源库
- **AI 解读**：`worker.js`（Cloudflare Worker，调用 Claude API，第三阶段实现）
- **部署**：GitHub Pages → https://hugh1ezy.github.io/ziwei/
- **仓库**：https://github.com/Hugh1ezy/ziwei（main 分支）

---

## 二、规则文件结构（必须维护）

规则文本仅保留两个主文件：

| 文件 | 用途 | 主要内容 |
|------|------|----------|
| `rules/rules_paiping.md` | **排盘规则** | 天干地支、命身宫推算、五行局、紫微星位、十四主星安布、四化表、辅星安布、大限流年 |
| `rules/rules_jiedu.md` | **解读规则** | 十二宫含义、四化象、星曜性情/疾病/职业、格局断语、运势分析方法 |

- 其余 `rules/` 中的 md 文件为原始提取备份，**不用于程序读取**
- AI 解读时，只引用 `rules_paiping.md` 和 `rules_jiedu.md` 中的内容

---

## 三、每次更新同步流程（由 Claude 自动执行，用户无需操作）

> **每次完成任何改动后，Claude 必须立即自动执行以下步骤，不等待用户指令。**

```bash
# Claude 执行：暂存改动的文件（不用 git add . 或 git add books/）
git add index.html ziwei.html                              # 如有修改
git add rules/rules_paiping.md rules/rules_jiedu.md        # 如有修改
git add rules/rule2_data.js                                # 如有修改
git add memory_log.md instructions.md                      # 如有修改

# 提交（含 Co-Author 标注）
git commit -m "描述本次改动"

# 推送 → GitHub Pages 约1分钟自动更新
git push
```

⚠️ 每次 push 前必须已更新 `memory_log.md`。
⚠️ 绝不 `git add books/`（PDF 不入库）。
⚠️ push 成功后告知用户网址：https://hugh1ezy.github.io/ziwei/

---

## 四、书籍处理流程（每次读完一本书必须执行）

### 步骤 1 — 原始提取
```python
# 提取 PDF 全文（保存为 rules/书名_raw.txt，不入 git）
with pdfplumber.open('books/xxx.pdf') as pdf:
    text = ''.join(p.extract_text() or '' for p in pdf.pages)
    text = text.replace('戍','戌')
```

### 步骤 2 — 内容分类
判断每条规则属于哪个文件：
- 「怎么排盘」→ `rules_paiping.md`
- 「怎么解读」→ `rules_jiedu.md`
- 一条规则只进一个文件

### 步骤 3 — 三步合并（必须按顺序）

**① 查重复**：扫描目标文件，找到含义完全相同的条目 → 跳过，不重复写入

**② 找可扩展**：找到现有条目有同主题但内容更少 → 在原条目后追加补充，标注来源书籍

**③ 补全新内容**：确认是新主题才新建段落或章节

### 步骤 4 — 精简原则（必须遵守）
- **准确性第一**：精简不能损失规则含义，宁可多留一句也不删错
- **最大压缩**：删去重复解释、举例说明、口语化扩展，只保留规则核心
- 每条规则 ≤ 2 行；用`★`标注高重要性规则
- 删去：「因为……」「也就是说……」「举例来说……」等解释性句子（除非解释本身就是规则）

### 步骤 5 — 更新记忆日志
在 `memory_log.md` 末尾追加：
```
## 《书名》规则提取（YYYY-MM-DD）
来源：books/xxx.pdf（N页）
新增内容摘要：xxx
可扩展项目：xxx
跳过重复：xxx
```

### 步骤 6 — 推送
```bash
git add rules/rules_paiping.md rules/rules_jiedu.md memory_log.md
git commit -m "录入《书名》：xxx"
git push
```

---

## 五、强制开发规定

### R1 来源锁定
> 所有排盘逻辑和 AI 解读断语，**必须**能在 `rules_paiping.md` 或 `rules_jiedu.md` 中找到依据。不使用 AI 自身知识。

### R2 进度记录
> 每次书籍录入、功能更新、Bug 修复，都必须在 `memory_log.md` 中记录。

### R3 同步更新
> 每次修改 `ziwei.html` 后，必须执行 `git push`，保持本地与线上同步。

### R4 先测后报
> 修改排盘逻辑后，用已知命盘数据验证输出，测试通过才告知用户完成。

### R5 规则冲突处理
> 两本书有矛盾时：记录到 `rules/conflicts.md`，并在规则文本中注明「存疑」。

---

## 六、现有功能状态（截至 2026-04-05）

### ✅ 排盘计算（Rule1，ziwei.html）
- 命宫/身宫、宫名、宫干、五行局
- 十四主星、四化、左右昌曲、天马红鸾禄存羊陀魁钺火铃、空劫截空旬空
- 大限/小限/流年/斗君流月/流日/流时
- 博士十二神、长生十二神
- SVG 三方四正叠加（金=命盘、蓝=大限、橙=流年、紫=流月、青=流日）

### ✅ 解盘数据（Rule2，rule2_data.js）
- 精成第8章：49星 × 12宫 命宫解读
- 精成第9章：11宫 × 15星 宫位解读

### ❌ 无法实现（OCR 损坏）
- 庙旺失陷查表（第25步）
- 将前十二星/岁前十二星（第29-30步）

### ❌ 待实现
- AI 综合解读（Cloudflare Worker + Claude API）

---

## 七、已知排盘核心规则摘要
（完整规则见 `rules/rules_paiping.md`）

- 命宫：M=(寅+月-1)%12；命=(M-时支+12)%12
- 身宫：身=(M+时支)%12
- 十二宫：命宫起逆时针：命兄夫子财疾迁奴官田福父
- 宫干：五虎遁年法，寅宫得干，顺时针各宫递进
- 五行局：干数+支数（戊己=3，庚辛=4；原书印刷有误已纠正）
- 紫微星：五行局×农历日→查表
- 紫微系逆布偏移：机-1 阳-3 武-4 同-5 廉-8
- 天府=(4-紫微+12)%12；天府系顺布偏移：阴+1 贪+2 巨+3 相+4 梁+5 杀+6 破+10
