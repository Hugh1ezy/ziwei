/**
 * 紫微斗数规则推理引擎 v1.0
 * 纯客户端JS，无需API Key
 * 数据源：rules_data.json（编码自rules_jiedu.md）
 */

let RULES_DATA = null;

async function loadRulesData() {
  if (RULES_DATA) return RULES_DATA;
  try {
    const resp = await fetch('rules/rules_data.json');
    RULES_DATA = await resp.json();
    return RULES_DATA;
  } catch (e) {
    console.warn('规则数据加载失败:', e);
    return null;
  }
}

/* ========== 常量 ========== */
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
const PALACE_NAMES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','奴仆','官禄','田宅','福德','父母'];
const LIUQIN = ['命宫','兄弟','夫妻','子女','奴仆','父母'];
const LIUWAI = ['迁移','奴仆','官禄','田宅','福德','父母'];
const LIUNEI = ['命宫','兄弟','夫妻','子女','财帛','疾厄'];
const CAI_GUAN = ['财帛','官禄'];
const CHANGSHENG = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
const CS_START = { 2: 8, 3: 11, 4: 5, 5: 8, 6: 2 }; // 五行局→长生起始支

const SIHUA_TABLE = {
  '甲':['廉贞','破军','武曲','太阳'], '乙':['天机','天梁','紫微','太阴'],
  '丙':['天同','天机','文昌','廉贞'], '丁':['太阴','天同','天机','巨门'],
  '戊':['贪狼','太阴','右弼','天机'], '己':['武曲','贪狼','天梁','文曲'],
  '庚':['太阳','武曲','太阴','天同'], '辛':['巨门','太阳','文曲','文昌'],
  '壬':['天梁','紫微','左辅','武曲'], '癸':['破军','巨门','太阴','贪狼']
};

const SANHE = [[2,6,10],[5,9,1],[8,0,4],[11,3,7]]; // 寅午戌/巳酉丑/申子辰/亥卯未

/* ========== 工具函数 ========== */

function getBranch(brIdx) { return BRANCHES[brIdx]; }
function getStem(stemIdx) { return STEMS[stemIdx]; }

function getSanfangBrs(brIdx) {
  // 返回三方四正的4个地支索引 (本宫+三合2宫+对宫)
  const duiGong = (brIdx + 6) % 12;
  let sanhe = null;
  for (const grp of SANHE) {
    if (grp.includes(brIdx)) { sanhe = grp; break; }
  }
  const result = [brIdx, duiGong];
  if (sanhe) {
    for (const b of sanhe) { if (b !== brIdx && !result.includes(b)) result.push(b); }
  }
  return result;
}

function getBranchGroup(brIdx) {
  if ([0,3,6,9].includes(brIdx)) return '子午卯酉';
  if ([4,10,1,7].includes(brIdx)) return '辰戌丑未';
  return '寅申巳亥';
}

function palaceType(palaceName) {
  const types = [];
  if (LIUQIN.includes(palaceName)) types.push('liuqin');
  if (LIUWAI.includes(palaceName)) types.push('liuwai');
  if (LIUNEI.includes(palaceName)) types.push('liunei');
  if (CAI_GUAN.includes(palaceName)) types.push('cai_guan');
  return types;
}

/* ========== 宫气计算 ========== */

function calcGongQi(ju, gender, yearBrIdx, mingBrIdx) {
  // 返回 { brIdx: '长生名称' } for all 12 palaces
  const start = CS_START[ju];
  if (start === undefined) return {};
  // 方向: 阳年男或阴年女→顺, 阴年男或阳年女→逆 (per rules_paiping)
  // But for 长生: 男顺女逆 (per rules_paiping 十八)
  const dir = (gender === 'male') ? 1 : -1;
  const map = {};
  for (let i = 0; i < 12; i++) {
    const pos = ((start + i * dir) % 12 + 12) % 12;
    map[pos] = CHANGSHENG[i];
  }
  return map;
}

/* ========== 核心推理 ========== */

function interpretChart(chartState, rule2State) {
  if (!RULES_DATA || !rule2State || !chartState) return null;
  const R = RULES_DATA;

  // Build context
  const ctx = buildContext(chartState, rule2State);
  const results = {};

  // Per-palace analysis
  for (const pName of PALACE_NAMES) {
    results[pName] = interpretPalace(ctx, pName, R);
  }

  // Global analysis
  results._geju = matchGeju(ctx, R);
  results._daxian = analyzeDaxian(ctx, R);
  results._female = (ctx.gender === 'female') ? checkFemale(ctx, R) : [];
  results._benduigong = analyzeBenDui(ctx, R);
  results._feigong = analyzeFeigong(ctx, R);
  results._liuhe = analyzeLiuhe(ctx, R);
  results._summary = generateSummary(ctx, results, R);

  return results;
}

function buildContext(chartState, rule2State) {
  const stars = rule2State.stars;
  const palaceMap = rule2State.palaceMap; // { brIdx: '宫名' }
  const mingBr = rule2State.mingGongBrIdx;
  const ju = chartState.ju || 3;
  const gender = chartState.gender || 'male';
  const yearBrIdx = chartState.yearBrIdx || 0;
  const yearStemIdx = chartState.yearStemIdx || 0;
  const yearStem = getStem(yearStemIdx);

  // Build palace→brIdx map (reverse)
  const palaceToBr = {};
  for (const [br, pName] of Object.entries(palaceMap)) {
    palaceToBr[pName] = parseInt(br);
  }

  // Build star→position map
  const starPos = {}; // starName → brIdx
  const starHua = {}; // starName → '禄'|'权'|'科'|'忌'
  for (let br = 0; br < 12; br++) {
    const s = stars[br];
    if (!s) continue;
    for (const st of (s.main || [])) { starPos[st] = br; }
    for (const st of (s.aux || [])) { starPos[st] = br; }
    if (s.hua) {
      for (const [st, h] of Object.entries(s.hua)) { starHua[st] = h; }
    }
  }

  // Natal sihua
  const sihua = SIHUA_TABLE[yearStem] || [];
  const natalHua = {};
  if (sihua[0]) natalHua[sihua[0]] = '禄';
  if (sihua[1]) natalHua[sihua[1]] = '权';
  if (sihua[2]) natalHua[sihua[2]] = '科';
  if (sihua[3]) natalHua[sihua[3]] = '忌';

  // Gongqi
  const gongqi = calcGongQi(ju, gender, yearBrIdx, mingBr);

  // Palace stems
  const palaceStemMap = rule2State.palaceStemMap || chartState.palaceStemMap || {};

  const shenBr = chartState.shenGongBrIdx !== undefined ? chartState.shenGongBrIdx : undefined;

  return {
    stars, palaceMap, palaceToBr, starPos, starHua, natalHua,
    mingBr, shenBr, ju, gender, yearStem, yearBrIdx, yearStemIdx,
    gongqi, sihua, palaceStemMap,
    daXianData: chartState.daXianData || []
  };
}

/* ---- Per-palace interpretation ---- */

function interpretPalace(ctx, palaceName, R) {
  const brIdx = ctx.palaceToBr[palaceName];
  if (brIdx === undefined) return { items: [] };
  const branch = getBranch(brIdx);
  const sData = ctx.stars[brIdx] || { main: [], aux: [], hua: {} };
  const allStars = [...(sData.main || []), ...(sData.aux || [])];
  const items = [];

  // 1. Gongqi
  const qi = ctx.gongqi[brIdx];
  if (qi && R.gongqi[qi]) {
    items.push({ type: 'gongqi', text: `宫气【${qi}】：${R.gongqi[qi].text}`, severity: 0, src: '1.x宫气' });
  }

  // 2. Star base descriptions
  for (const st of (sData.main || [])) {
    const sb = R.star_base[st];
    if (!sb) continue;
    let desc = `${st}（化气曰${sb.化气}）：${sb.kw}`;
    // Branch group
    const bg = getBranchGroup(brIdx);
    if (sb.bg && sb.bg[bg]) desc += `。${bg}：${sb.bg[bg]}`;
    // Appearance (命宫 only)
    if (palaceName === '命宫' && sb.相) desc += `。【相】${sb.相}`;
    // Disease (疾厄 only)
    if (palaceName === '疾厄' && sb.疾) desc += `。【疾】${sb.疾}`;
    // Female note
    if (ctx.gender === 'female' && sb.female) desc += `。${sb.female}`;
    // Extra note
    if (sb.note) desc += `。${sb.note}`;

    items.push({ type: 'star_base', text: desc, severity: 0, src: `5章${st}` });
  }

  // 3. Sihua analysis
  for (const st of allStars) {
    const hua = ctx.natalHua[st];
    if (!hua) continue;
    // Match sihua rules
    for (const rule of R.sihua_rules) {
      if (rule.star && rule.star !== st) continue;
      if (rule.hua && rule.hua !== hua) continue;
      if (rule.palace && rule.palace !== palaceName) continue;
      if (rule.palace_type) {
        const pt = palaceType(palaceName);
        if (!pt.includes(rule.palace_type)) continue;
      }
      // Brightness check (simplified - would need庙旺 data)
      // Skip brightness checks for now (needs MIAO_WANG table)
      items.push({
        type: 'sihua',
        text: `${st}化${hua}在${palaceName}：${rule.text}`,
        severity: rule.severity || 0,
        src: rule.src
      });
    }
  }

  // 4. Combo matching
  for (const rule of R.combo) {
    if (rule.palace && rule.palace !== palaceName) continue;
    if (rule.branch && !rule.branch.includes(branch)) continue;
    const ruleStars = rule.stars || [];
    const allPresent = ruleStars.every(s => allStars.includes(s));
    if (!allPresent) continue;
    if (rule.any_palace === undefined && !rule.palace) continue;
    // Extra condition check
    if (rule.extra) {
      if (rule.extra.includes('太阴化忌') && ctx.natalHua['太阴'] !== '忌') continue;
      if (rule.extra.includes('四煞')) {
        const sha = ['擎羊','陀罗','火星','铃星'];
        if (!sha.some(s => allStars.includes(s))) continue;
      }
    }
    items.push({
      type: 'combo',
      text: `${ruleStars.join('+')}同宫：${rule.text}`,
      severity: rule.severity || 0,
      src: rule.src
    });
  }

  return { palace: palaceName, branch, qi, items };
}

/* ---- 格局识别 ---- */

function matchGeju(ctx, R) {
  const matched = [];
  for (const g of R.geju) {
    const c = g.cond;
    let hit = false;

    if (c.palace && c.star) {
      // Star in specific palace at specific branch
      const pBr = ctx.palaceToBr[c.palace];
      const stBr = ctx.starPos[c.star];
      if (pBr !== undefined && stBr === pBr) {
        if (!c.branch || c.branch.includes(getBranch(pBr))) {
          hit = true;
        }
      }
    }

    if (c.sanfang) {
      // All stars in三方四正 of 命宫
      const sfBrs = getSanfangBrs(ctx.mingBr);
      const sfStars = [];
      for (const br of sfBrs) {
        const s = ctx.stars[br];
        if (s) sfStars.push(...(s.main || []), ...(s.aux || []));
      }
      if (c.sanfang.every(st => sfStars.includes(st))) {
        hit = true;
        if (g.branchLimit && !g.branchLimit.includes(getBranch(ctx.mingBr))) {
          // Branch limit not met - still hit but add note
          matched.push({ ...g, text: g.text + `（注：命宫不在${g.branchLimit.join('/')}，不成正格但星系特质在）`, partial: true });
          continue;
        }
      }
    }

    if (c.sanfang_or_same) {
      const sfBrs = getSanfangBrs(ctx.mingBr);
      const sfStars = [];
      for (const br of sfBrs) {
        const s = ctx.stars[br];
        if (s) sfStars.push(...(s.main || []));
      }
      if (c.sanfang_or_same.every(st => sfStars.includes(st))) hit = true;
    }

    if (c.same_palace) {
      // Two+ stars in the same palace (any palace)
      for (let br = 0; br < 12; br++) {
        const s = ctx.stars[br];
        if (!s) continue;
        const all = [...(s.main || []), ...(s.aux || [])];
        if (c.same_palace.every(st => all.includes(st))) {
          if (!c.branch || c.branch.includes(getBranch(br))) {
            hit = true;
            break;
          }
        }
      }
    }

    if (c.sanfang_has_hua) {
      // Check if三方四正 has all specified四化
      const sfBrs = getSanfangBrs(ctx.mingBr);
      const huaTypes = new Set();
      for (const br of sfBrs) {
        const s = ctx.stars[br];
        if (s && s.hua) {
          for (const h of Object.values(s.hua)) huaTypes.add(h);
        }
      }
      if (c.sanfang_has_hua.every(h => huaTypes.has(h))) hit = true;
    }

    if (c.no_main_star) {
      const pBr = ctx.palaceToBr[c.palace];
      const s = ctx.stars[pBr];
      if (!s || !s.main || s.main.length === 0) hit = true;
    }

    if (hit) {
      // Year bonus check
      let yearNote = '';
      if (g.yearBonus) {
        if (g.yearBonus.includes(ctx.yearStem)) {
          yearNote = `（${ctx.yearStem}年生人合格·上品）`;
        }
      }
      if (g.yearOnly && !g.yearOnly.includes(ctx.yearStem)) continue;
      matched.push({ ...g, text: g.text + yearNote });
    }
  }
  return matched;
}

/* ---- 大限分析 ---- */

function analyzeDaxian(ctx, R) {
  if (!ctx.daXianData || ctx.daXianData.length === 0) return [];
  const results = [];

  for (let i = 0; i < Math.min(ctx.daXianData.length, 8); i++) {
    const dx = ctx.daXianData[i];
    const brIdx = dx.brIdx;
    const palaceName = ctx.palaceMap[brIdx] || '';
    const branch = getBranch(brIdx);

    // Get daxian palace stem for flying sihua (palaceStemMap stores stem names like '甲')
    const dxStem = ctx.palaceStemMap ? ctx.palaceStemMap[brIdx] : null;
    const dxSihua = dxStem ? SIHUA_TABLE[dxStem] : null;

    const items = [];
    const sData = ctx.stars[brIdx] || { main: [], aux: [] };
    const starList = [...(sData.main || []), ...(sData.aux || [])].join('、') || '空宫';
    items.push({ text: `${dx.ageStart}-${dx.ageEnd}岁（${palaceName}·${branch}）：${starList}`, severity: 0 });

    // Gongqi
    const qi = ctx.gongqi[brIdx];
    if (qi) items.push({ text: `宫气${qi}`, severity: 0 });

    // Third limit special
    if (i === 2) {
      items.push({ text: '★第三大限为命运转折之限（进入迁移三方范围）', severity: 0, src: '4.3c' });
    }

    // Check daxian sihua vs natal
    if (dxSihua) {
      const dxJi = dxSihua[3]; // 化忌star
      const natalLu = ctx.sihua[0]; // 化禄star
      // natal禄 = daxian忌 same star → 由好变坏
      if (dxJi === natalLu) {
        items.push({ text: `★大凶：${dxJi}原局化禄逢大限化忌=由好变坏`, severity: 3, src: '4.3' });
      }
      // Check叠忌
      const natalJi = ctx.sihua[3];
      if (dxJi === natalJi) {
        items.push({ text: `★大凶：${dxJi}叠忌=大凶`, severity: 3, src: '4.3' });
      }
      // Check叠禄
      const dxLu = dxSihua[0];
      if (dxLu === natalLu) {
        items.push({ text: `叠禄：${dxLu}双禄力量大增`, severity: -1, src: '4.3' });
      }
    }

    results.push({ limit: i, ...dx, palaceName, items });
  }
  return results;
}

/* ---- 女命 ---- */

function checkFemale(ctx, R) {
  const items = [];
  for (const rule of R.female) {
    if (rule.note) { items.push({ text: rule.note, severity: 0, src: rule.src }); continue; }
    if (rule.star) {
      const stBr = ctx.starPos[rule.star];
      if (stBr === undefined) continue;
      const pName = ctx.palaceMap[stBr];
      if (rule.palace && rule.palace !== pName) continue;
      items.push({ text: rule.text, severity: rule.severity || 0, src: rule.src });
    }
    if (rule.stars) {
      // Check if all stars in same palace
      const positions = rule.stars.map(s => ctx.starPos[s]).filter(p => p !== undefined);
      if (positions.length !== rule.stars.length) continue;
      const pName = ctx.palaceMap[positions[0]];
      if (rule.palace && rule.palace !== pName) continue;
      items.push({ text: rule.text, severity: rule.severity || 0, src: rule.src });
    }
  }
  return items;
}

/* ---- 本对宫分析 ---- */

function analyzeBenDui(ctx, R) {
  const items = [];
  for (const rule of R.benduigong) {
    const [p1, p2] = rule.pair;
    const br1 = ctx.palaceToBr[p1];
    const br2 = ctx.palaceToBr[p2];
    if (br1 === undefined || br2 === undefined) continue;
    const qi1 = ctx.gongqi[br1];
    const qi2 = ctx.gongqi[br2];
    if (!qi1 || !qi2) continue;
    const lv1 = R.gongqi[qi1] ? R.gongqi[qi1].level : 5;
    const lv2 = R.gongqi[qi2] ? R.gongqi[qi2].level : 5;
    const text = lv1 > lv2 ? rule.text_strong : rule.text_weak;
    items.push({ pair: rule.pair, text: `${p1}(${qi1})vs${p2}(${qi2})：${text}`, severity: 0 });
  }
  return items;
}

/* ---- 飞宫四化分析 ---- */

function analyzeFeigong(ctx, R) {
  // 每宫宫干飞出四化→落宫→分析冲/叠/自化
  const items = [];
  for (const pName of PALACE_NAMES) {
    const brIdx = ctx.palaceToBr[pName];
    const stem = ctx.palaceStemMap ? ctx.palaceStemMap[brIdx] : null;
    if (!stem) continue;
    const sh = SIHUA_TABLE[stem];
    if (!sh) continue;
    const labels = ['禄','权','科','忌'];
    for (let k = 0; k < 4; k++) {
      const star = sh[k];
      const hua = labels[k];
      const targetBr = ctx.starPos[star];
      if (targetBr === undefined) continue;
      const targetPal = ctx.palaceMap[targetBr];
      if (!targetPal) continue;
      // 自化: 落回本宫
      if (targetBr === brIdx && hua === '忌') {
        items.push({ from: pName, to: targetPal, star, hua, type: 'self_ji',
          text: `${pName}干(${stem})飞${star}化忌回本宫=自化忌（有中化无）`, severity: 1, src: '3.4' });
      } else if (targetBr === brIdx && hua === '禄') {
        items.push({ from: pName, to: targetPal, star, hua, type: 'self_lu',
          text: `${pName}干(${stem})飞${star}化禄回本宫=自化禄（有中化无）`, severity: 0, src: '3.4' });
      }
      // 冲对宫
      const duiBr = (brIdx + 6) % 12;
      if (targetBr === duiBr && hua === '忌') {
        const duiPal = ctx.palaceMap[duiBr] || '';
        items.push({ from: pName, to: duiPal, star, hua, type: 'chong_ji',
          text: `${pName}干(${stem})飞${star}化忌冲${duiPal}=真正破坏`, severity: 2, src: '3.6' });
      }
      // 化忌冲命宫
      if (hua === '忌' && targetBr === ctx.mingBr && pName !== '命宫') {
        items.push({ from: pName, to: '命宫', star, hua, type: 'ji_chong_ming',
          text: `${pName}干(${stem})飞${star}化忌入命宫=不顺`, severity: 2, src: '3.3' });
      }
      // 禄忌同星检查（生年禄 vs 飞宫忌）
      if (hua === '忌' && ctx.natalHua[star] === '禄') {
        items.push({ from: pName, to: targetPal, star, hua, type: 'lu_ji_clash',
          text: `${pName}干飞${star}化忌（原局化禄）=禄转忌得中有失`, severity: 2, src: '3.6' });
      }
    }
  }
  return items;
}

/* ---- 六合融合分析 ---- */

const LIUHE_PAIRS = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]]; // 子丑/寅亥/卯戌/辰酉/巳申/午未

function analyzeLiuhe(ctx, R) {
  if (!R.liuhe) return [];
  const items = [];
  for (const [br1, br2] of LIUHE_PAIRS) {
    const pal1 = ctx.palaceMap[br1];
    const pal2 = ctx.palaceMap[br2];
    if (!pal1 || !pal2) continue;
    const qi1 = ctx.gongqi[br1];
    const qi2 = ctx.gongqi[br2];
    const lv1 = qi1 && R.gongqi[qi1] ? R.gongqi[qi1].level : 5;
    const lv2 = qi2 && R.gongqi[qi2] ? R.gongqi[qi2].level : 5;
    const weaker = lv1 <= lv2 ? pal1 : pal2;
    const weakQi = lv1 <= lv2 ? qi1 : qi2;
    // Match liuhe rules
    for (const rule of R.liuhe) {
      if (rule.branches.includes(BRANCHES[br1]) && rule.branches.includes(BRANCHES[br2])) {
        items.push({
          pair: [pal1, pal2],
          text: `${pal1}(${qi1||'?'})⇔${pal2}(${qi2||'?'})六合融合：${rule.text}。弱气方${weaker}(${weakQi})为问题根源`,
          severity: lv1 <= 2 || lv2 <= 2 ? 1 : 0,
          src: '2.3六合'
        });
      }
    }
  }
  return items;
}

/* ---- 综合摘要生成 ---- */

function generateSummary(ctx, results, R) {
  const lines = [];
  const geju = results._geju || [];
  const daxian = results._daxian || [];
  const feigong = results._feigong || [];
  const liuhe = results._liuhe || [];

  // 1. 命格总评
  const mingPal = results['命宫'];
  const mingStars = ctx.stars[ctx.mingBr];
  const noMain = !mingStars || !mingStars.main || mingStars.main.length === 0;
  if (noMain) {
    const duiBr = (ctx.mingBr + 6) % 12;
    const duiStars = ctx.stars[duiBr]?.main?.join('、') || '无';
    lines.push(`命宫空宫（借对宫${duiStars}），根基偏虚但${ctx.gongqi[ctx.mingBr] ? '宫气'+ctx.gongqi[ctx.mingBr] : ''}有助稳定`);
  }

  // 2. 格局
  if (geju.length > 0) {
    const names = geju.map(g => g.name).join('、');
    lines.push(`命中格局：${names}（共${geju.length}个）`);
  }

  // 3. 四化要点
  const jiStar = Object.entries(ctx.natalHua).find(([s,h]) => h === '忌');
  const luStar = Object.entries(ctx.natalHua).find(([s,h]) => h === '禄');
  if (jiStar) {
    const jiBr = ctx.starPos[jiStar[0]];
    const jiPal = jiBr !== undefined ? ctx.palaceMap[jiBr] : '?';
    lines.push(`最大凶象：${jiStar[0]}化忌落${jiPal}（${jiStar[0]==='廉贞'?'主脓血之灾':jiStar[0]==='武曲'?'主财损':jiStar[0]==='太阴'?'主投资失败':'主不顺'}）`);
  }
  if (luStar) {
    const luBr = ctx.starPos[luStar[0]];
    const luPal = luBr !== undefined ? ctx.palaceMap[luBr] : '?';
    lines.push(`最大吉象：${luStar[0]}化禄落${luPal}`);
  }

  // 4. 飞宫四化要点（仅列severity>=2的）
  const severeFeigong = feigong.filter(f => f.severity >= 2);
  if (severeFeigong.length > 0) {
    lines.push(`飞宫四化警示：${severeFeigong.map(f => f.text).join('；')}`);
  }

  // 5. 身宫
  const shenBr = ctx.shenBr;
  if (shenBr !== undefined) {
    const shenPal = ctx.palaceMap[shenBr];
    if (shenPal) {
      const shenDesc = {'命宫':'性格鲜明','夫妻':'重感情','财帛':'重财','迁移':'喜外出','官禄':'事业心重','福德':'重享受'}[shenPal] || '';
      lines.push(`身宫在${shenPal}：${shenDesc}`);
    }
  }

  // 6. 大限亮点
  const sevDx = [];
  for (const dx of daxian) {
    for (const item of dx.items) {
      if (item.severity >= 3) sevDx.push(`${dx.ageStart}-${dx.ageEnd}岁${item.text}`);
      if (item.severity <= -1) sevDx.push(`${dx.ageStart}-${dx.ageEnd}岁${item.text}`);
    }
  }
  if (sevDx.length > 0) lines.push(`大限要点：${sevDx.join('；')}`);

  // 7. 六合要点
  const sevLH = liuhe.filter(l => l.severity >= 1);
  if (sevLH.length > 0) lines.push(`六合融合：${sevLH.map(l=>l.text).join('；')}`);

  return lines.join('\n');
}

/* ========== 渲染函数 ========== */

function renderEngineResult(palaceResult, globalResults) {
  if (!palaceResult || !palaceResult.items || palaceResult.items.length === 0) return '';
  let html = '<div class="engine-result">';

  // Sort by severity (high first)
  const sorted = [...palaceResult.items].sort((a, b) => (b.severity || 0) - (a.severity || 0));

  for (const item of sorted) {
    const sev = item.severity || 0;
    let cls = 'eng-neutral';
    if (sev >= 3) cls = 'eng-severe';
    else if (sev >= 2) cls = 'eng-warn';
    else if (sev >= 1) cls = 'eng-normal';
    else if (sev < 0) cls = 'eng-good';

    const srcTag = item.src ? `<span class="eng-src">[${item.src}]</span>` : '';
    html += `<div class="eng-item ${cls}">${item.text} ${srcTag}</div>`;
  }

  // Add格局 if this is命宫
  if (palaceResult.palace === '命宫' && globalResults) {
    if (globalResults._geju && globalResults._geju.length > 0) {
      html += '<div class="eng-section-title">★ 格局</div>';
      for (const g of globalResults._geju) {
        html += `<div class="eng-item eng-geju">【${g.name}】${g.text} <span class="eng-src">[${g.src}]</span></div>`;
      }
    }
    if (globalResults._benduigong && globalResults._benduigong.length > 0) {
      html += '<div class="eng-section-title">本对宫强弱</div>';
      for (const b of globalResults._benduigong) {
        html += `<div class="eng-item eng-neutral">${b.text}</div>`;
      }
    }
    if (globalResults._female && globalResults._female.length > 0) {
      html += '<div class="eng-section-title">女命专论</div>';
      for (const f of globalResults._female) {
        html += `<div class="eng-item ${f.severity >= 2 ? 'eng-warn' : 'eng-neutral'}">${f.text} <span class="eng-src">[${f.src}]</span></div>`;
      }
    }
    if (globalResults._feigong && globalResults._feigong.length > 0) {
      html += '<div class="eng-section-title">飞宫四化</div>';
      for (const f of globalResults._feigong) {
        const cls = f.severity >= 2 ? 'eng-warn' : f.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${f.text} <span class="eng-src">[${f.src}]</span></div>`;
      }
    }
    if (globalResults._liuhe && globalResults._liuhe.length > 0) {
      html += '<div class="eng-section-title">六合融合</div>';
      for (const l of globalResults._liuhe) {
        const cls = l.severity >= 1 ? 'eng-warn' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${l.text} <span class="eng-src">[${l.src}]</span></div>`;
      }
    }
    if (globalResults._daxian && globalResults._daxian.length > 0) {
      html += '<div class="eng-section-title">大限走势</div>';
      for (const dx of globalResults._daxian) {
        for (const item of dx.items) {
          const cls = item.severity >= 3 ? 'eng-severe' : item.severity < 0 ? 'eng-good' : 'eng-neutral';
          const srcTag = item.src ? `<span class="eng-src">[${item.src}]</span>` : '';
          html += `<div class="eng-item ${cls}">${item.text} ${srcTag}</div>`;
        }
      }
    }
    if (globalResults._summary) {
      html += '<div class="eng-section-title">综合摘要</div>';
      html += `<div class="eng-item eng-neutral" style="white-space:pre-line">${globalResults._summary}</div>`;
    }
  }

  html += '</div>';
  return html;
}

/* ========== CSS 样式 ========== */

function injectEngineStyles() {
  if (document.getElementById('engine-styles')) return;
  const style = document.createElement('style');
  style.id = 'engine-styles';
  style.textContent = `
    .engine-result { margin-top: 12px; }
    .eng-section-title { font-weight: bold; margin: 12px 0 4px; padding: 4px 8px; background: #f0e6d0; border-radius: 4px; }
    .eng-item { padding: 4px 8px; margin: 2px 0; border-radius: 3px; font-size: 13px; line-height: 1.5; border-left: 3px solid transparent; }
    .eng-severe { background: #fee; border-left-color: #c33; color: #900; }
    .eng-warn { background: #ffd; border-left-color: #c90; }
    .eng-normal { background: #fff; border-left-color: #999; }
    .eng-good { background: #efe; border-left-color: #393; color: #060; }
    .eng-neutral { background: #f8f8f8; border-left-color: #ccc; }
    .eng-geju { background: #fff8e0; border-left-color: #c90; font-weight: 500; }
    .eng-src { font-size: 11px; color: #999; margin-left: 4px; }
  `;
  document.head.appendChild(style);
}
