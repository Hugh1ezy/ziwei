/**
 * 紫微斗数规则推理引擎 v2.0
 * 纯客户端JS，无需API Key
 * 数据源：rules_data.json（编码自rules_jiedu.md）
 * v2.0: P0庙旺亮度 + P1链式飞宫 + P2自化叠化 + P3夹格 + P4大限详析 + P5增补格局
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
// BRANCHES / STEMS 由 ziwei.html 主脚本声明，此处仅在独立运行(Node.js测试)时兜底
var _RE_BRANCHES = (typeof BRANCHES !== 'undefined') ? BRANCHES : '子丑寅卯辰巳午未申酉戌亥'.split('');
var _RE_STEMS    = (typeof STEMS !== 'undefined')    ? STEMS    : '甲乙丙丁戊己庚辛壬癸'.split('');
const PALACE_NAMES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','奴仆','官禄','田宅','福德','父母'];
const LIUQIN = ['命宫','兄弟','夫妻','子女','奴仆','父母'];
const LIUWAI = ['迁移','奴仆','官禄','田宅','福德','父母'];
const LIUNEI = ['命宫','兄弟','夫妻','子女','财帛','疾厄'];
const CAI_GUAN = ['财帛','官禄'];
const CHANGSHENG = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
const CS_START = { 2: 8, 3: 11, 4: 5, 5: 8, 6: 2 };

const SIHUA_TABLE = {
  '甲':['廉贞','破军','武曲','太阳'], '乙':['天机','天梁','紫微','太阴'],
  '丙':['天同','天机','文昌','廉贞'], '丁':['太阴','天同','天机','巨门'],
  '戊':['贪狼','太阴','右弼','天机'], '己':['武曲','贪狼','天梁','文曲'],
  '庚':['太阳','武曲','太阴','天同'], '辛':['巨门','太阳','文曲','文昌'],
  '壬':['天梁','紫微','左辅','武曲'], '癸':['破军','巨门','太阴','贪狼']
};

const SANHE = [[2,6,10],[5,9,1],[8,0,4],[11,3,7]];

/* ========== 工具函数 ========== */

function getBranch(brIdx) { return _RE_BRANCHES[brIdx]; }
function getStem(stemIdx) { return _RE_STEMS[stemIdx]; }

function getSanfangBrs(brIdx) {
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

/* P0: 庙旺亮度查询 */
function getStarBrightness(ctx, starName, brIdx) {
  if (!ctx.miaoWang || !ctx.miaoWang[starName]) return -1;
  return ctx.miaoWang[starName][brIdx]; // 0=陷 1=得 2=旺 3=庙
}

/* P3: 获取某宫所有星+四化标签 */
function getStarsAndHuaAtBr(ctx, brIdx) {
  const s = ctx.stars[brIdx] || { main: [], aux: [], hua: {} };
  const result = [...(s.main || []), ...(s.aux || [])];
  if (s.hua) {
    for (const [star, h] of Object.entries(s.hua)) {
      result.push(`${star}化${h}`);
      result.push(`化${h}`);
    }
  }
  // Also check natal hua for stars at this position
  for (const st of [...(s.main || []), ...(s.aux || [])]) {
    if (ctx.natalHua[st]) {
      result.push(`${st}化${ctx.natalHua[st]}`);
    }
  }
  return result;
}

function getAllStarsAtBr(ctx, brIdx) {
  const s = ctx.stars[brIdx] || { main: [], aux: [] };
  return [...(s.main || []), ...(s.aux || [])];
}

/* ========== 宫气计算 ========== */

function calcGongQi(ju, gender, yearBrIdx, mingBrIdx) {
  const start = CS_START[ju];
  if (start === undefined) return {};
  const dir = (gender === 'male') ? 1 : -1;
  const map = {};
  for (let i = 0; i < 12; i++) {
    const pos = ((start + i * dir) % 12 + 12) % 12;
    map[pos] = CHANGSHENG[i];
  }
  return map;
}

/* ========== 飞宫映射构建 ========== */

function buildFlyMap(ctx) {
  const flyMap = {};
  for (let br = 0; br < 12; br++) {
    const stem = ctx.palaceStemMap[br];
    if (!stem) continue;
    const sh = SIHUA_TABLE[stem];
    if (!sh) continue;
    const labels = ['禄','权','科','忌'];
    flyMap[br] = {};
    for (let k = 0; k < 4; k++) {
      const star = sh[k];
      const targetBr = ctx.starPos[star];
      if (targetBr === undefined) continue;
      flyMap[br][labels[k]] = { star, targetBr, targetPal: ctx.palaceMap[targetBr] };
    }
  }
  return flyMap;
}

/* ========== 核心推理 ========== */

function interpretChart(chartState, rule2State) {
  if (!RULES_DATA || !rule2State || !chartState) return null;
  const R = RULES_DATA;

  const ctx = buildContext(chartState, rule2State);
  const results = {};

  // Per-palace analysis (P0: brightness active)
  for (const pName of PALACE_NAMES) {
    results[pName] = interpretPalace(ctx, pName, R);
  }

  // Global analysis
  results._geju = matchGeju(ctx, R);              // P3+P5 enhanced
  results._jiaGe = analyzeJiaGe(ctx, R);           // P3 new
  results._daxian = analyzeDaxian(ctx, R);          // existing
  results._daxianDetail = analyzeDaxianDetailed(ctx, R); // P4 new
  results._female = (ctx.gender === 'female') ? checkFemale(ctx, R) : [];
  results._benduigong = analyzeBenDui(ctx, R);
  results._feigong = analyzeFeigong(ctx, R);        // existing single-layer
  results._feigongChain = analyzeFeigongChain(ctx, R); // P1 new
  results._diehua = analyzeZihuaDiehua(ctx, R);     // P2 new
  results._liuhe = analyzeLiuhe(ctx, R);
  results._summary = generateSummary(ctx, results, R);

  return results;
}

function buildContext(chartState, rule2State) {
  const stars = rule2State.stars;
  const palaceMap = rule2State.palaceMap;
  const mingBr = rule2State.mingGongBrIdx;
  const ju = chartState.ju || 3;
  const gender = chartState.gender || 'male';
  const yearBrIdx = chartState.yearBrIdx || 0;
  const yearStemIdx = chartState.yearStemIdx || 0;
  const yearStem = getStem(yearStemIdx);

  const palaceToBr = {};
  for (const [br, pName] of Object.entries(palaceMap)) {
    palaceToBr[pName] = parseInt(br);
  }

  const starPos = {};
  const starHua = {};
  for (let br = 0; br < 12; br++) {
    const s = stars[br];
    if (!s) continue;
    for (const st of (s.main || [])) { starPos[st] = br; }
    for (const st of (s.aux || [])) { starPos[st] = br; }
    if (s.hua) {
      for (const [st, h] of Object.entries(s.hua)) { starHua[st] = h; }
    }
  }

  const sihua = SIHUA_TABLE[yearStem] || [];
  const natalHua = {};
  if (sihua[0]) natalHua[sihua[0]] = '禄';
  if (sihua[1]) natalHua[sihua[1]] = '权';
  if (sihua[2]) natalHua[sihua[2]] = '科';
  if (sihua[3]) natalHua[sihua[3]] = '忌';

  const gongqi = calcGongQi(ju, gender, yearBrIdx, mingBr);
  const palaceStemMap = rule2State.palaceStemMap || chartState.palaceStemMap || {};
  const shenBr = chartState.shenGongBrIdx !== undefined ? chartState.shenGongBrIdx : undefined;
  const miaoWang = chartState.miaoWang || null; // P0

  return {
    stars, palaceMap, palaceToBr, starPos, starHua, natalHua,
    mingBr, shenBr, ju, gender, yearStem, yearBrIdx, yearStemIdx,
    gongqi, sihua, palaceStemMap, miaoWang,
    daXianData: chartState.daXianData || []
  };
}

/* ---- Per-palace interpretation (P0 brightness activated) ---- */

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
    const bg = getBranchGroup(brIdx);
    if (sb.bg && sb.bg[bg]) desc += `。${bg}：${sb.bg[bg]}`;
    if (palaceName === '命宫' && sb.相) desc += `。【相】${sb.相}`;
    if (palaceName === '疾厄' && sb.疾) desc += `。【疾】${sb.疾}`;
    if (ctx.gender === 'female' && sb.female) desc += `。${sb.female}`;
    if (sb.note) desc += `。${sb.note}`;
    items.push({ type: 'star_base', text: desc, severity: 0, src: `5章${st}` });
  }

  // 2b. Double-star lookup (双星组合速查)
  if (R.double_star && (sData.main || []).length >= 2) {
    const STAR_ABBR = {'紫微':'紫','天机':'机','太阳':'阳','武曲':'武','天同':'同','廉贞':'廉',
      '天府':'府','太阴':'阴','贪狼':'贪','巨门':'巨','天相':'相','天梁':'梁','七杀':'杀','破军':'破'};
    const mainList = sData.main.filter(s => STAR_ABBR[s]);
    if (mainList.length === 2) {
      const abbrs = mainList.map(s => STAR_ABBR[s]);
      // Try both orderings
      const keys = [abbrs.join(''), abbrs.reverse().join('')];
      for (const key of keys) {
        const ds = R.double_star[key];
        if (ds) {
          items.push({ type: 'double_star', text: `【${key}】${ds.trait}（${ds.tag}）`, severity: 0, src: '§7双星速查' });
          break;
        }
      }
    }
  }

  // 2c. 天魁天钺40后减力提示
  if (R.star_base) {
    const hasKui = allStars.includes('天魁');
    const hasYue = allStars.includes('天钺');
    if ((hasKui || hasYue) && (branch === '丑' || branch === '未')) {
      const starName = hasKui ? '天魁' : '天钺';
      items.push({ type: 'aux_note', text: `${starName}在${branch}（墓库宫）：四十岁后贵人运减力，不见得有贵人反招小人`, severity: 1, src: '§5辅星/南北派' });
    }
  }

  // 3. Sihua analysis (P0: brightness checks active)
  for (const st of allStars) {
    const hua = ctx.natalHua[st];
    if (!hua) continue;
    for (const rule of R.sihua_rules) {
      if (rule.star && rule.star !== st) continue;
      if (rule.hua && rule.hua !== hua) continue;
      if (rule.palace && rule.palace !== palaceName) continue;
      if (rule.palace_type) {
        const pt = palaceType(palaceName);
        if (!pt.includes(rule.palace_type)) continue;
      }
      // P0: Brightness checks
      if (rule.brightness_min !== undefined) {
        const bright = getStarBrightness(ctx, st, brIdx);
        if (bright < 0 || bright < rule.brightness_min) continue;
      }
      if (rule.brightness_max !== undefined) {
        const bright = getStarBrightness(ctx, st, brIdx);
        if (bright < 0 || bright > rule.brightness_max) continue;
      }
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
    if (rule.extra) {
      if (rule.extra.includes('太阴化忌') && ctx.natalHua['太阴'] !== '忌') continue;
      if (rule.extra.includes('四煞')) {
        const sha = ['擎羊','陀罗','火星','铃星'];
        if (!sha.some(s => allStars.includes(s))) continue;
      }
    }
    // P0: brightness check for combo rules (e.g. 廉贞火星须陷地方论)
    if (rule.brightness_max !== undefined || rule.brightness_min !== undefined) {
      let brightnessOk = true;
      let checked = false;
      for (const st of ruleStars) {
        const bright = getStarBrightness(ctx, st, brIdx);
        if (bright < 0) {
          // Also check per-star mw from rule2State
          const sData = ctx.stars[brIdx];
          const mwLocal = sData?.mw?.[st];
          if (mwLocal === undefined) continue; // truly unknown, skip
          if (rule.brightness_max !== undefined && mwLocal > rule.brightness_max) { brightnessOk = false; break; }
          if (rule.brightness_min !== undefined && mwLocal < rule.brightness_min) { brightnessOk = false; break; }
          checked = true;
        } else {
          if (rule.brightness_max !== undefined && bright > rule.brightness_max) { brightnessOk = false; break; }
          if (rule.brightness_min !== undefined && bright < rule.brightness_min) { brightnessOk = false; break; }
          checked = true;
        }
      }
      if (!brightnessOk || !checked) continue;
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

/* ---- 格局识别 (P3+P5 enhanced) ---- */

function matchGeju(ctx, R) {
  const matched = [];
  for (const g of R.geju) {
    const c = g.cond;
    let hit = false;

    if (c.palace && c.star) {
      const pBr = ctx.palaceToBr[c.palace];
      const stBr = ctx.starPos[c.star];
      if (pBr !== undefined && stBr === pBr) {
        if (!c.branch || c.branch.includes(getBranch(pBr))) {
          hit = true;
        }
      }
    }

    if (c.sanfang) {
      const sfBrs = getSanfangBrs(ctx.mingBr);
      const sfStars = [];
      for (const br of sfBrs) {
        const s = ctx.stars[br];
        if (s) sfStars.push(...(s.main || []), ...(s.aux || []));
      }
      if (c.sanfang.every(st => sfStars.includes(st))) {
        hit = true;
        if (g.branchLimit && !g.branchLimit.includes(getBranch(ctx.mingBr))) {
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
      // 确定搜索范围：in_sanfang=true时仅搜索命宫三方四正
      let searchBrs = Array.from({length:12}, (_,i) => i);
      if (c.in_sanfang) {
        const mb = ctx.mingBr;
        searchBrs = [mb, (mb+4)%12, (mb+6)%12, (mb+8)%12];
      }
      for (const br of searchBrs) {
        const s = ctx.stars[br];
        if (!s) continue;
        const all = [...(s.main || []), ...(s.aux || [])];
        if (c.same_palace.every(st => all.includes(st))) {
          if (!c.branch || c.branch.includes(getBranch(br))) {
            // P5: has_aux check
            if (c.has_aux && !(s.aux || []).includes(c.has_aux)) continue;
            if (c.has_any_aux && !c.has_any_aux.some(a => (s.aux || []).includes(a))) continue;
            hit = true;
            break;
          }
        }
      }
    }

    // P5: same_palace_or_duizhao
    if (c.same_palace_or_duizhao) {
      const [s1, s2] = c.same_palace_or_duizhao;
      const br1 = ctx.starPos[s1], br2 = ctx.starPos[s2];
      if (br1 !== undefined && br2 !== undefined) {
        if (br1 === br2 || br1 === (br2 + 6) % 12) hit = true;
      }
    }

    // P5: sanfang_has_both_lu
    if (c.sanfang_has_both_lu) {
      const sfBrs = getSanfangBrs(ctx.mingBr);
      const hasLuCun = sfBrs.some(br => getAllStarsAtBr(ctx, br).includes('禄存'));
      const luStar = Object.entries(ctx.natalHua).find(([s,h]) => h === '禄');
      const hasHuaLu = luStar && sfBrs.includes(ctx.starPos[luStar[0]]);
      if (hasLuCun && hasHuaLu) hit = true;
    }

    if (c.sanfang_has_hua) {
      const sfBrs = getSanfangBrs(ctx.mingBr);
      const huaTypes = new Set();
      for (const br of sfBrs) {
        const s = ctx.stars[br];
        if (s && s.hua) {
          for (const h of Object.values(s.hua)) huaTypes.add(h);
        }
      }
      // Also check natal hua
      for (const [star, h] of Object.entries(ctx.natalHua)) {
        if (sfBrs.includes(ctx.starPos[star])) huaTypes.add(h);
      }
      if (c.sanfang_has_hua.every(h => huaTypes.has(h))) hit = true;
    }

    if (c.no_main_star) {
      const pBr = ctx.palaceToBr[c.palace];
      const s = ctx.stars[pBr];
      if (!s || !s.main || s.main.length === 0) hit = true;
    }

    // P3: neighbors / neighbors_bad / neighbors_stars
    if (c.neighbors && hit) {
      const pBr = ctx.palaceToBr[c.palace];
      const leftBr = (pBr - 1 + 12) % 12;
      const rightBr = (pBr + 1) % 12;
      const leftS = getStarsAndHuaAtBr(ctx, leftBr);
      const rightS = getStarsAndHuaAtBr(ctx, rightBr);
      if (!c.neighbors.every(n => leftS.includes(n) || rightS.includes(n))) hit = false;
    }
    if (c.neighbors_bad && hit) {
      const pBr = ctx.palaceToBr[c.palace];
      const leftBr = (pBr - 1 + 12) % 12;
      const rightBr = (pBr + 1) % 12;
      const leftS = getStarsAndHuaAtBr(ctx, leftBr);
      const rightS = getStarsAndHuaAtBr(ctx, rightBr);
      if (!c.neighbors_bad.every(n => leftS.includes(n) || rightS.includes(n))) hit = false;
    }
    if (c.neighbors_stars) {
      const pBr = ctx.palaceToBr[c.palace];
      const leftBr = (pBr - 1 + 12) % 12;
      const rightBr = (pBr + 1) % 12;
      const leftM = (ctx.stars[leftBr]?.main || []);
      const rightM = (ctx.stars[rightBr]?.main || []);
      const combined = [...leftM, ...rightM];
      if (c.neighbors_stars.every(s => combined.includes(s))) hit = true;
    }

    // P3: aux_count_min
    if (c.aux_count_min && hit) {
      const sfBrs = getSanfangBrs(ctx.mingBr);
      let count = 0;
      for (const br of sfBrs) {
        const s = ctx.stars[br];
        if (s?.aux) count += s.aux.length;
      }
      if (count < c.aux_count_min) hit = false;
    }

    // P5: same_palace_has_hua
    if (c.same_palace_has_hua && hit) {
      const luStar = Object.entries(ctx.natalHua).find(([s,h]) => h === c.same_palace_has_hua);
      if (!luStar) { hit = false; }
      else {
        const target = c.same_palace ? c.same_palace[0] : null;
        if (target && ctx.starPos[luStar[0]] !== ctx.starPos[target]) hit = false;
      }
    }

    if (hit) {
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

/* ---- P3: 夹格通用分析 ---- */

function analyzeJiaGe(ctx, R) {
  const items = [];
  const targetPalaces = ['命宫'];
  const txBr = ctx.starPos['天相'];
  if (txBr !== undefined) {
    const txPal = ctx.palaceMap[txBr];
    if (txPal && txPal !== '命宫') targetPalaces.push(txPal);
  }

  for (const palName of targetPalaces) {
    const br = ctx.palaceToBr[palName];
    if (br === undefined) continue;
    const leftBr = (br - 1 + 12) % 12;
    const rightBr = (br + 1) % 12;
    const leftAll = getAllStarsAtBr(ctx, leftBr);
    const rightAll = getAllStarsAtBr(ctx, rightBr);
    const combined = [...leftAll, ...rightAll];

    const JIA_PAIRS = [
      [['太阳','太阴'], `日月夹${palName}=有钱有地位`, -1, '南北派'],
      [['紫微','天府'], `紫府夹${palName}=贵格`, -1, '南北派'],
      [['左辅','右弼'], `左右夹${palName}=吉`, -1, '4.2'],
      [['文昌','文曲'], `昌曲夹${palName}=聪明`, -1, '4.2'],
      [['天魁','天钺'], `魁钺夹${palName}=贵人`, -1, '4.2'],
      [['擎羊','陀罗'], `羊陀夹${palName}=凶`, 2, '4.2'],
      [['火星','铃星'], `火铃夹${palName}=凶`, 2, '4.2'],
      [['地空','地劫'], `空劫夹${palName}=凶`, 2, '4.2'],
    ];

    for (const [pair, text, severity, src] of JIA_PAIRS) {
      if (combined.includes(pair[0]) && combined.includes(pair[1])) {
        items.push({ type: 'jia', palace: palName, text, severity, src });
      }
    }
  }
  return items;
}

/* ---- 大限分析 (existing) ---- */

function analyzeDaxian(ctx, R) {
  if (!ctx.daXianData || ctx.daXianData.length === 0) return [];
  const results = [];

  for (let i = 0; i < Math.min(ctx.daXianData.length, 8); i++) {
    const dx = ctx.daXianData[i];
    const brIdx = dx.brIdx;
    const palaceName = ctx.palaceMap[brIdx] || '';
    const branch = getBranch(brIdx);
    const dxStem = ctx.palaceStemMap ? ctx.palaceStemMap[brIdx] : null;
    const dxSihua = dxStem ? SIHUA_TABLE[dxStem] : null;

    const items = [];
    const sData = ctx.stars[brIdx] || { main: [], aux: [] };
    const starList = [...(sData.main || []), ...(sData.aux || [])].join('、') || '空宫';
    items.push({ text: `${dx.ageStart}-${dx.ageEnd}岁（${palaceName}·${branch}）：${starList}`, severity: 0 });

    const qi = ctx.gongqi[brIdx];
    if (qi) items.push({ text: `宫气${qi}`, severity: 0 });

    if (i === 2) {
      items.push({ text: '★第三大限为命运转折之限（进入迁移三方范围）', severity: 0, src: '4.3c' });
    }

    if (dxSihua) {
      const dxJi = dxSihua[3];
      const natalLu = ctx.sihua[0];
      if (dxJi === natalLu) {
        items.push({ text: `★大凶：${dxJi}原局化禄逢大限化忌=由好变坏`, severity: 3, src: '4.3' });
      }
      const natalJi = ctx.sihua[3];
      if (dxJi === natalJi) {
        items.push({ text: `★大凶：${dxJi}叠忌=大凶`, severity: 3, src: '4.3' });
      }
      const dxLu = dxSihua[0];
      if (dxLu === natalLu) {
        items.push({ text: `叠禄：${dxLu}双禄力量大增`, severity: -1, src: '4.3' });
      }
    }

    results.push({ limit: i, ...dx, palaceName, items });
  }
  return results;
}

/* ---- P4: 大限四化落宫详析 ---- */

function analyzeDaxianDetailed(ctx, R) {
  if (!ctx.daXianData || ctx.daXianData.length === 0) return [];
  const results = [];

  for (let i = 0; i < Math.min(ctx.daXianData.length, 8); i++) {
    const dx = ctx.daXianData[i];
    const dxBr = dx.brIdx;

    // Build大限宫位 map (rotated)
    const dxBrToPal = {};
    for (let p = 0; p < 12; p++) {
      const br = ((dxBr - p) % 12 + 12) % 12;
      dxBrToPal[br] = PALACE_NAMES[p];
    }

    const dxStem = ctx.palaceStemMap[dxBr];
    if (!dxStem) continue;
    const dxSihua = SIHUA_TABLE[dxStem];
    if (!dxSihua) continue;

    const labels = ['禄','权','科','忌'];
    const dxItems = [];

    for (let k = 0; k < 4; k++) {
      const star = dxSihua[k];
      const hua = labels[k];
      const landBr = ctx.starPos[star];
      if (landBr === undefined) continue;

      const natalPal = ctx.palaceMap[landBr];
      const dxPal = dxBrToPal[landBr] || '?';

      let overlay = '';
      const natalHuaOfStar = ctx.natalHua[star];
      if (natalHuaOfStar === hua) overlay = `（叠${hua}=力量大增）`;
      if (natalHuaOfStar === '禄' && hua === '忌') overlay = '（原局化禄逢限化忌=由好变坏）';

      dxItems.push({
        star, hua, dxPal, natalPal, overlay,
        text: `大限化${hua}（${star}）→大限${dxPal}（原局${natalPal}）${overlay}`,
        severity: hua === '忌' ? 2 : hua === '禄' ? -1 : 0
      });

      // Specific断诀
      if (hua === '禄' && dxPal === '财帛') {
        dxItems.push({ text: '→大限化禄入大限财帛=赚钱能力提升', severity: -1, src: '4.3' });
      }
      if (hua === '忌' && dxPal === '夫妻') {
        dxItems.push({ text: '→大限化忌入大限夫妻=感情不顺', severity: 2, src: '4.3' });
      }
      if (hua === '忌' && dxPal === '命宫') {
        dxItems.push({ text: '→大限化忌入大限命宫=该限不顺', severity: 2, src: '4.3' });
      }
      if (hua === '忌' && landBr === ((dxBr + 6) % 12)) {
        dxItems.push({ text: '→大限化忌冲大限命宫=该限大凶', severity: 3, src: '4.3' });
      }
    }

    results.push({ limit: i, ageStart: dx.ageStart, ageEnd: dx.ageEnd, items: dxItems });
  }
  return results;
}

/* ---- 女命 ---- */

function checkFemale(ctx, R) {
  const items = [];
  if (!R.female) return items;
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
  if (!R.benduigong) return items;
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

/* ---- 飞宫四化分析 (existing single-layer) ---- */

function analyzeFeigong(ctx, R) {
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
      if (targetBr === brIdx && hua === '忌') {
        items.push({ from: pName, to: targetPal, star, hua, type: 'self_ji',
          text: `${pName}干(${stem})飞${star}化忌回本宫=自化忌（有中化无）`, severity: 1, src: '3.4' });
      } else if (targetBr === brIdx && hua === '禄') {
        items.push({ from: pName, to: targetPal, star, hua, type: 'self_lu',
          text: `${pName}干(${stem})飞${star}化禄回本宫=自化禄（有中化无）`, severity: 0, src: '3.4' });
      }
      const duiBr = (brIdx + 6) % 12;
      if (targetBr === duiBr && hua === '忌') {
        const duiPal = ctx.palaceMap[duiBr] || '';
        items.push({ from: pName, to: duiPal, star, hua, type: 'chong_ji',
          text: `${pName}干(${stem})飞${star}化忌冲${duiPal}=真正破坏`, severity: 2, src: '3.6' });
      }
      if (hua === '忌' && targetBr === ctx.mingBr && pName !== '命宫') {
        items.push({ from: pName, to: '命宫', star, hua, type: 'ji_chong_ming',
          text: `${pName}干(${stem})飞${star}化忌入命宫=不顺`, severity: 2, src: '3.3' });
      }
      if (hua === '忌' && ctx.natalHua[star] === '禄') {
        items.push({ from: pName, to: targetPal, star, hua, type: 'lu_ji_clash',
          text: `${pName}干飞${star}化忌（原局化禄）=禄转忌得中有失`, severity: 2, src: '3.6' });
      }
    }
  }
  return items;
}

/* ---- P1: 链式飞宫追踪 ---- */

function analyzeFeigongChain(ctx, R) {
  const flyMap = buildFlyMap(ctx);
  const items = [];

  for (let startBr = 0; startBr < 12; startBr++) {
    const startPal = ctx.palaceMap[startBr];
    if (!flyMap[startBr]) continue;

    // 忌链2层: A忌→B, B忌→C
    const ji1 = flyMap[startBr]?.['忌'];
    if (ji1) {
      const ji2 = flyMap[ji1.targetBr]?.['忌'];
      if (ji2 && ji2.targetBr !== ji1.targetBr) {
        items.push({
          type: 'chain_ji', chain: [startPal, ji1.targetPal, ji2.targetPal],
          text: `${startPal}忌→${ji1.targetPal}→转忌→${ji2.targetPal}（忌转忌=雪上加霜）`,
          severity: 2, src: '3.6/9.5'
        });
      }
    }

    // 禄→转忌链: A禄→B, B忌→C
    const lu1 = flyMap[startBr]?.['禄'];
    if (lu1) {
      const ji_from_lu = flyMap[lu1.targetBr]?.['忌'];
      if (ji_from_lu && ji_from_lu.targetBr !== lu1.targetBr) {
        items.push({
          type: 'chain_lu_ji', chain: [startPal, lu1.targetPal, ji_from_lu.targetPal],
          text: `${startPal}禄→${lu1.targetPal}→转忌→${ji_from_lu.targetPal}（禄转忌=得中有失）`,
          severity: 1, src: '3.6'
        });
      }
    }
  }

  // Named断诀 pattern matching
  items.push(...matchDuanJue(ctx, flyMap));
  return items;
}

function matchDuanJue(ctx, flyMap) {
  const items = [];
  const pb = ctx.palaceToBr;

  // 1. 福德忌入父母冲疾厄 + 命忌入夫妻 = death
  const fudeBr = pb['福德'], fumoBr = pb['父母'], jieBr = pb['疾厄'];
  const mingBr = pb['命宫'], fuqiBr = pb['夫妻'];
  if (fudeBr !== undefined && fumoBr !== undefined) {
    if (flyMap[fudeBr]?.['忌']?.targetBr === fumoBr && (fumoBr + 6) % 12 === jieBr) {
      if (flyMap[mingBr]?.['忌']?.targetBr === fuqiBr) {
        items.push({ type: 'duanjue_death',
          text: '★★★福德忌→父母冲疾厄 + 命忌→夫妻 = 两条件具备须防死亡',
          severity: 3, src: '9.5' });
      }
    }
  }

  // 2. 财禄入命=有钱
  const caiBr = pb['财帛'];
  if (caiBr !== undefined && flyMap[caiBr]?.['禄']?.targetBr === mingBr) {
    items.push({ type: 'duanjue', text: '财禄入命=有钱', severity: -1, src: '9.5' });
  }

  // 3. 财忌入夫冲官=只宜上班
  const guanBr = pb['官禄'];
  if (caiBr !== undefined && fuqiBr !== undefined && guanBr !== undefined) {
    if (flyMap[caiBr]?.['忌']?.targetBr === fuqiBr && (fuqiBr + 6) % 12 === guanBr) {
      items.push({ type: 'duanjue', text: '财忌入夫冲官=只宜上班', severity: 1, src: '9.5' });
    }
  }

  // 4. 夫妻忌入子女=外遇
  const ziBr = pb['子女'];
  if (fuqiBr !== undefined && ziBr !== undefined) {
    if (flyMap[fuqiBr]?.['忌']?.targetBr === ziBr) {
      items.push({ type: 'duanjue', text: '夫妻忌入子女=外遇（爬墙）', severity: 2, src: '9.5' });
    }
  }

  // 5. 命禄→转忌→夫妻→转忌→子女=外遇链
  if (mingBr !== undefined && fuqiBr !== undefined && ziBr !== undefined) {
    const luFromMing = flyMap[mingBr]?.['禄'];
    if (luFromMing) {
      const jiFromTarget = flyMap[luFromMing.targetBr]?.['忌'];
      if (jiFromTarget?.targetBr === fuqiBr) {
        const jiFromFuqi = flyMap[fuqiBr]?.['忌'];
        if (jiFromFuqi?.targetBr === ziBr) {
          items.push({ type: 'duanjue_chain', text: '命禄→转忌→夫妻→转忌→子女=外遇（链式确认）', severity: 2, src: '9.5' });
        }
      }
    }
  }

  return items;
}

/* ---- P2: 自化叠化互动 ---- */

const DIEHUA_TABLE = {
  '禄+自化禄': { text: '同类抵消=无禄', severity: 0 },
  '禄+自化权': { text: '禄权交会=名利双收', severity: -1 },
  '禄+自化科': { text: '禄科会=因名得利', severity: -1 },
  '禄+自化忌': { text: '禄忌=双忌论（大凶）', severity: 3 },
  '权+自化禄': { text: '权禄交会=权有财基', severity: -1 },
  '权+自化权': { text: '同类抵消=无权', severity: 0 },
  '权+自化科': { text: '权科会=名望权位', severity: -1 },
  '权+自化忌': { text: '权可解忌，想做又不做', severity: 1 },
  '科+自化禄': { text: '科禄会=名利双全', severity: -1 },
  '科+自化权': { text: '科权会=名望权位', severity: -1 },
  '科+自化科': { text: '同类抵消=无科', severity: 0 },
  '科+自化忌': { text: '科可解忌但不彻底', severity: 1 },
  '忌+自化禄': { text: '禄忌=双忌', severity: 3 },
  '忌+自化权': { text: '忌遇权=忌有权势，凶象加重', severity: 2 },
  '忌+自化科': { text: '科可缓忌但不彻底', severity: 1 },
  '忌+自化忌': { text: '同类抵消=不忌', severity: -1 }
};

function analyzeZihuaDiehua(ctx, R) {
  const items = [];
  const flyMap = buildFlyMap(ctx);

  for (let br = 0; br < 12; br++) {
    if (!flyMap[br]) continue;
    const palName = ctx.palaceMap[br];
    const labels = ['禄','权','科','忌'];

    for (const hua of labels) {
      const entry = flyMap[br]?.[hua];
      if (!entry || entry.targetBr !== br) continue; // Only self-化

      const star = entry.star;
      const natalH = ctx.natalHua[star];
      if (!natalH) continue; // No natal hua for this star, no overlay

      const combo = `${natalH}+自化${hua}`;
      const rule = DIEHUA_TABLE[combo];
      if (rule) {
        items.push({
          type: 'diehua', palace: palName, star, natalHua: natalH, selfHua: hua,
          text: `${palName}：${star}生年化${natalH}+自化${hua}→${rule.text}`,
          severity: rule.severity, src: '3.5'
        });
      }
    }
  }
  return items;
}

/* ---- 六合融合分析 ---- */

const LIUHE_PAIRS = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];

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
    for (const rule of R.liuhe) {
      if (rule.branches.includes(_RE_BRANCHES[br1]) && rule.branches.includes(_RE_BRANCHES[br2])) {
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

/* ---- 综合摘要生成 (updated for P1-P4) ---- */

function generateSummary(ctx, results, R) {
  const lines = [];
  const geju = results._geju || [];
  const daxian = results._daxian || [];
  const feigong = results._feigong || [];
  const feigongChain = results._feigongChain || [];
  const diehua = results._diehua || [];
  const jiaGe = results._jiaGe || [];
  const liuhe = results._liuhe || [];

  // 1. 命格总评
  const mingStars = ctx.stars[ctx.mingBr];
  const noMain = !mingStars || !mingStars.main || mingStars.main.length === 0;
  if (noMain) {
    const duiBr = (ctx.mingBr + 6) % 12;
    const duiStars = ctx.stars[duiBr]?.main?.join('、') || '无';
    lines.push(`命宫空宫（借对宫${duiStars}），根基偏虚但${ctx.gongqi[ctx.mingBr] ? '宫气'+ctx.gongqi[ctx.mingBr] : ''}有助稳定`);
  }

  // 2. 格局
  if (geju.length > 0) {
    lines.push(`命中格局：${geju.map(g => g.name).join('、')}（共${geju.length}个）`);
  }

  // 3. 夹格要点 (P3)
  const jiaWarn = jiaGe.filter(j => j.severity >= 2);
  const jiaGood = jiaGe.filter(j => j.severity < 0);
  if (jiaGood.length > 0) lines.push(`吉夹：${jiaGood.map(j => j.text).join('；')}`);
  if (jiaWarn.length > 0) lines.push(`凶夹：${jiaWarn.map(j => j.text).join('；')}`);

  // 4. 四化要点
  const jiStar = Object.entries(ctx.natalHua).find(([s,h]) => h === '忌');
  const luStar = Object.entries(ctx.natalHua).find(([s,h]) => h === '禄');
  if (jiStar) {
    const jiBr = ctx.starPos[jiStar[0]];
    const jiPal = jiBr !== undefined ? ctx.palaceMap[jiBr] : '?';
    // 检查庙旺化忌反吉（太阳太阴庙旺化忌反为福论）
    const jiName = jiStar[0];
    let jiReversed = false;
    if (jiName === '太阳' || jiName === '太阴') {
      const bright = getStarBrightness(ctx, jiName, jiBr);
      const mwLocal = jiBr !== undefined ? (ctx.stars[jiBr]?.mw?.[jiName] ?? -1) : -1;
      if (bright >= 2 || mwLocal >= 2) jiReversed = true;
    }
    if (jiReversed) {
      lines.push(`化忌特论：${jiName}化忌落${jiPal}，但${jiName}庙旺→反为福论（化忌力量被化解）`);
    } else {
      lines.push(`最大凶象：${jiName}化忌落${jiPal}（${jiName==='廉贞'?'主脓血之灾':jiName==='武曲'?'主财损':jiName==='太阴'?'主投资失败':'主不顺'}）`);
    }
  }
  if (luStar) {
    const luBr = ctx.starPos[luStar[0]];
    const luPal = luBr !== undefined ? ctx.palaceMap[luBr] : '?';
    lines.push(`最大吉象：${luStar[0]}化禄落${luPal}`);
  }

  // 5. 飞宫四化警示 (existing + P1 chain)
  const severeFeigong = feigong.filter(f => f.severity >= 2);
  const severeChain = feigongChain.filter(f => f.severity >= 2);
  const allSevere = [...severeFeigong, ...severeChain];
  if (allSevere.length > 0) {
    lines.push(`飞宫四化警示：${allSevere.map(f => f.text).join('；')}`);
  }

  // 6. 自化叠化 (P2)
  const severeDiehua = diehua.filter(d => d.severity >= 2);
  if (severeDiehua.length > 0) {
    lines.push(`自化叠化警示：${severeDiehua.map(d => d.text).join('；')}`);
  }

  // 7. 身宫
  const shenBr = ctx.shenBr;
  if (shenBr !== undefined) {
    const shenPal = ctx.palaceMap[shenBr];
    if (shenPal) {
      const shenDesc = {'命宫':'性格鲜明','夫妻':'重感情','财帛':'重财','迁移':'喜外出','官禄':'事业心重','福德':'重享受'}[shenPal] || '';
      lines.push(`身宫在${shenPal}：${shenDesc}`);
    }
  }

  // 8. 大限要点
  const sevDx = [];
  for (const dx of daxian) {
    for (const item of dx.items) {
      if (item.severity >= 3 || item.severity <= -1) sevDx.push(`${dx.ageStart}-${dx.ageEnd}岁${item.text}`);
    }
  }
  if (sevDx.length > 0) lines.push(`大限要点：${sevDx.join('；')}`);

  // 9. 六合要点
  const sevLH = liuhe.filter(l => l.severity >= 1);
  if (sevLH.length > 0) lines.push(`六合融合：${sevLH.map(l=>l.text).join('；')}`);

  return lines.join('\n');
}

/* ========== 渲染函数 (updated for P1-P4) ========== */

function renderEngineResult(palaceResult, globalResults) {
  if (!palaceResult || !palaceResult.items || palaceResult.items.length === 0) return '';
  let html = '<div class="engine-result">';

  const sorted = [...palaceResult.items].sort((a, b) => (b.severity || 0) - (a.severity || 0));
  for (const item of sorted) {
    const sev = item.severity || 0;
    let cls = 'eng-neutral';
    if (sev >= 3) cls = 'eng-severe';
    else if (sev >= 2) cls = 'eng-warn';
    else if (sev >= 1) cls = 'eng-normal';
    else if (sev < 0) cls = 'eng-good';
    html += `<div class="eng-item ${cls}">${item.text}</div>`;
  }

  if (palaceResult.palace === '命宫' && globalResults) {
    // 格局
    if (globalResults._geju?.length > 0) {
      html += '<div class="eng-section-title">★ 格局</div>';
      for (const g of globalResults._geju) {
        html += `<div class="eng-item eng-geju">${g.name}：${g.text}</div>`;
      }
    }
    // P3: 夹格
    if (globalResults._jiaGe?.length > 0) {
      html += '<div class="eng-section-title">夹格分析</div>';
      for (const j of globalResults._jiaGe) {
        const cls = j.severity >= 2 ? 'eng-warn' : j.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${j.text}</div>`;
      }
    }
    // 本对宫
    if (globalResults._benduigong?.length > 0) {
      html += '<div class="eng-section-title">本对宫强弱</div>';
      for (const b of globalResults._benduigong) {
        html += `<div class="eng-item eng-neutral">${b.text}</div>`;
      }
    }
    // 女命
    if (globalResults._female?.length > 0) {
      html += '<div class="eng-section-title">女命专论</div>';
      for (const f of globalResults._female) {
        html += `<div class="eng-item ${f.severity >= 2 ? 'eng-warn' : 'eng-neutral'}">${f.text}</div>`;
      }
    }
    // 飞宫单层
    if (globalResults._feigong?.length > 0) {
      html += '<div class="eng-section-title">飞宫四化</div>';
      for (const f of globalResults._feigong) {
        const cls = f.severity >= 2 ? 'eng-warn' : f.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${f.text}</div>`;
      }
    }
    // P1: 链式飞宫
    if (globalResults._feigongChain?.length > 0) {
      html += '<div class="eng-section-title">链式飞宫追踪</div>';
      for (const f of globalResults._feigongChain) {
        const cls = f.severity >= 3 ? 'eng-severe' : f.severity >= 2 ? 'eng-warn' : f.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${f.text}</div>`;
      }
    }
    // P2: 自化叠化
    if (globalResults._diehua?.length > 0) {
      html += '<div class="eng-section-title">自化叠化</div>';
      for (const d of globalResults._diehua) {
        const cls = d.severity >= 3 ? 'eng-severe' : d.severity >= 2 ? 'eng-warn' : d.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${d.text}</div>`;
      }
    }
    // 六合
    if (globalResults._liuhe?.length > 0) {
      html += '<div class="eng-section-title">六合融合</div>';
      for (const l of globalResults._liuhe) {
        const cls = l.severity >= 1 ? 'eng-warn' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${l.text}</div>`;
      }
    }
    // 大限走势
    if (globalResults._daxian?.length > 0) {
      html += '<div class="eng-section-title">大限走势</div>';
      for (const dx of globalResults._daxian) {
        for (const item of dx.items) {
          const cls = item.severity >= 3 ? 'eng-severe' : item.severity < 0 ? 'eng-good' : 'eng-neutral';
          html += `<div class="eng-item ${cls}">${item.text}</div>`;
        }
      }
    }
    // P4: 大限详析（按年龄段折叠）
    if (globalResults._daxianDetail?.length > 0) {
      html += '<div class="eng-section-title">大限四化详析</div>';
      for (let di = 0; di < globalResults._daxianDetail.length; di++) {
        const dx = globalResults._daxianDetail[di];
        const dxId = `dxd_${di}`;
        const hasSevere = dx.items.some(it => it.severity >= 2);
        const badge = hasSevere ? ' <span style="color:#cc0000;font-size:0.8em">⚠</span>' : '';
        html += `<div class="eng-item eng-neutral" style="font-weight:500;cursor:pointer;user-select:none" onclick="var el=document.getElementById('${dxId}');el.style.display=el.style.display==='none'?'block':'none'">${dx.ageStart}-${dx.ageEnd}岁${badge} <span style="font-size:0.75em;color:#888">▶ 点击展开</span></div>`;
        html += `<div id="${dxId}" style="display:none">`;
        for (const item of dx.items) {
          const cls = item.severity >= 3 ? 'eng-severe' : item.severity >= 2 ? 'eng-warn' : item.severity < 0 ? 'eng-good' : 'eng-neutral';
          html += `<div class="eng-item ${cls}">${item.text}</div>`;
        }
        html += `</div>`;
      }
    }
    // 综合摘要（无内容时不显示）
    if (globalResults._summary && globalResults._summary.trim()) {
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
