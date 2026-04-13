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

/* P0: 庙旺亮度查询（7级：0=陷 1=不 2=平 3=利 4=得 5=旺 6=庙）*/
function getStarBrightness(ctx, starName, brIdx) {
  if (!ctx.miaoWang || !ctx.miaoWang[starName]) return -1;
  return ctx.miaoWang[starName][brIdx]; // 0=陷 1=不 2=平 3=利 4=得 5=旺 6=庙
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
  // 最大凶象/最大吉象 + 身宫（原摘要内容，现移入命宫tab）
  results._sihuaHighlight = generateSihuaHighlight(ctx);

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

  // 2a-pre. 预收集三方四正吉煞数据（供P0庙旺解读过滤用）
  // 来源：rules_jingcheng_ch1_7.md:1790-1800「五看」体系
  //   「一看本宫主星庙陷，…五看三方四正和左右邻宫，吉星多还是凶星多」
  //   「庙旺+本宫无煞有吉+三方四正无煞有吉→吉；失陷+本宫有煞无吉+三方煞多→大凶」
  //   本宫≈50%，对宫≈30%，三合宫+夹宫≈20%
  const JI_STARS_PRE = ['左辅','右弼','天魁','天钺','文昌','文曲','禄存','天马'];
  const SHA_SFS_PRE = ['擎羊','陀罗','火星','铃星','地空','地劫'];
  let preJiCount = 0, preShaCount = 0, preHasJi = false;
  // 本宫辅星吉煞
  let localJiCount = 0, localShaCount = 0, localHasJi = false;
  // 是否有天相同宫（廉贞特殊规则）
  const localHasTianXiang = (sData.main || []).includes('天相');
  // 是否有紫微同宫或三方（七杀特殊规则）
  let sfHasZiWei = (sData.main || []).includes('紫微');
  // 收集本宫吉煞
  for (const st of allStars) {
    if (JI_STARS_PRE.includes(st)) localJiCount++;
    if (SHA_SFS_PRE.includes(st)) localShaCount++;
  }
  if (sData.hua) {
    for (const h of Object.values(sData.hua)) {
      if (h === '禄' || h === '权' || h === '科') localJiCount++;
      if (h === '忌') { localShaCount++; localHasJi = true; }
    }
  }
  // 收集三方四正（含本宫）吉煞
  if ((sData.main || []).length > 0) {
    const sfBrsPre = getSanfangBrs(brIdx);
    for (const b of sfBrsPre) {
      const sd = ctx.stars[b] || { main: [], aux: [], hua: {} };
      const aS = [...(sd.main || []), ...(sd.aux || [])];
      for (const st of aS) {
        if (JI_STARS_PRE.includes(st)) preJiCount++;
        if (SHA_SFS_PRE.includes(st)) preShaCount++;
      }
      if (sd.hua) {
        for (const h of Object.values(sd.hua)) {
          if (h === '禄' || h === '权' || h === '科') preJiCount++;
          if (h === '忌') { preShaCount++; preHasJi = true; }
        }
      }
      // 检查三方四正是否有紫微
      if (b !== brIdx && (sd.main || []).includes('紫微')) sfHasZiWei = true;
    }
  }
  // 三方（不含本宫）吉煞
  const remoteJiCount = preJiCount - localJiCount;
  const remoteShaCount = preShaCount - localShaCount;

  // 2a. P0 庙旺失陷解读（来源：书第27条7级制 + rules_jiedu.md星性分类）
  // 星性分类（来源：rules_jiedu.md）：
  //   四恶曜：杀破廉贪 →「失陷遇煞大凶，入庙反具横发力」
  //   暗星：巨门（化气曰暗，口舌是非）
  //   寡宿星：武曲（化气曰财，但刚克孤寡）
  //   火性星：太阳、廉贞、七杀 →「陷地化忌凶力倍增」
  //   纯吉型：天府、天相、天同、天梁等
  // 三方四正过滤（来源：rules_jingcheng_ch1_7.md:1790-1800）：
  //   庙旺+三方吉多无煞→大吉；庙旺+三方煞混→辛劳；失陷+三方煞多→大凶
  //   rules_jingcheng_ch1_7.md:528「吉星众多煞星少且庙旺再加三方四正众吉会照仍然是吉利的」
  const SI_E_YAO = ['七杀','破军','廉贞','贪狼']; // 四恶曜
  const HUO_XING = ['太阳','廉贞','七杀'];          // 火性星（陷地化忌凶力倍增）
  const AN_XING  = ['巨门'];                         // 暗星
  const GU_XING  = ['武曲'];                         // 寡宿刚克星
  for (const st of (sData.main || [])) {
    const bright = getStarBrightness(ctx, st, brIdx);
    if (bright < 0) continue;
    const MW_LABELS = ['陷','不得地','平','利','得地','旺','庙'];
    const label = MW_LABELS[bright] || '?';
    const branch = getBranch(brIdx);
    const isSiE = SI_E_YAO.includes(st);
    const isHuo = HUO_XING.includes(st);
    const isAn  = AN_XING.includes(st);
    const isGu  = GU_XING.includes(st);
    const hasJi = ctx.natalHua[st] === '忌';
    let commentary = '';

    // 三方四正过滤后缀（根据实际吉煞构成修正「需吉星」「遇煞」等条件判断）
    // 来源：rules_jingcheng_ch1_7.md:1792-1800
    //  「庙旺+本宫无煞有吉+三方无煞有吉→吉」
    //  「失陷+本宫有煞无吉+三方煞多吉少→大凶」
    //  「其余半吉半凶，看庙旺程度及吉凶星比例酌情考虑」
    let sfSuffix = '';
    if (bright >= 5) {
      // 庙旺星——看三方四正是否有吉星扶助或煞星冲破
      if (localShaCount === 0 && preJiCount >= 3 && preShaCount === 0) {
        sfSuffix = `本宫无煞且三方四正有${preJiCount}吉星众吉拱照，星力得以充分发挥，大吉。`;
      } else if (localShaCount === 0 && preJiCount >= 2) {
        sfSuffix = `本宫无煞，三方四正有${preJiCount}吉${preShaCount > 0 ? preShaCount + '煞' : ''}扶助，吉性可发挥。`;
      } else if (preShaCount >= 3) {
        sfSuffix = `然三方四正有${preShaCount}煞凑聚${preHasJi ? '且见化忌' : ''}，庙旺虽强而外援不足，成就需经波折辛劳。`;
      } else if (localShaCount > 0) {
        sfSuffix = `本宫见${localShaCount}煞同守，庙旺可驾驭煞星${localJiCount > 0 ? '，兼有' + localJiCount + '吉星扶助' : ''}。`;
      }
    } else if (bright >= 3) {
      // 星力中等——三方吉煞决定走向
      if (preJiCount >= 3 && preShaCount <= 1) {
        sfSuffix = `三方四正有${preJiCount}吉星扶助${preShaCount === 0 ? '且无煞冲' : ''}，可得外援补强，趋向吉利。`;
      } else if (preShaCount >= 2 && preJiCount <= 1) {
        sfSuffix = `三方四正煞星${preShaCount}颗而吉星仅${preJiCount}颗，外援薄弱，恐难成就。`;
      } else if (preShaCount > 0 && preJiCount > 0) {
        sfSuffix = `三方四正吉${preJiCount}煞${preShaCount}混杂，需以努力化解阻碍方能成事。`;
      }
    } else if (bright === 2) {
      // 平地——三方四正影响权重更大
      if (preJiCount >= 2 && preShaCount === 0) {
        sfSuffix = `三方四正有${preJiCount}吉星且无煞冲，平地得吉助尚可平顺。`;
      } else if (preShaCount >= 2) {
        sfSuffix = `三方四正有${preShaCount}煞凑聚，平地逢煞则偏向不利。`;
      }
    } else {
      // 失陷——看三方有无救星
      if (preJiCount >= 3 && preShaCount <= 1) {
        sfSuffix = `然三方四正有${preJiCount}吉星扶助，虽陷而不至大凶，可减缓凶性。`;
      } else if (preShaCount >= 3) {
        sfSuffix = `三方四正又有${preShaCount}煞凑聚${preHasJi ? '且见化忌' : ''}，内外皆弱，凶上加凶。`;
      }
    }

    if (isSiE) {
      // 四恶曜：杀破廉贪
      // 廉贞特殊规则（rules_jiedu.md:364）：最喜天相同宫能化其恶
      // 七杀特殊规则（rules_jiedu.md）：遇紫微化权降福；落空亡无威力
      let starSpecial = '';
      if (st === '廉贞' && localHasTianXiang) {
        starSpecial = '天相同宫化其恶性，廉贞受制而趋正。';
      }
      if (st === '七杀') {
        if (sfHasZiWei) {
          const zwHua = ctx.natalHua['紫微'];
          if (zwHua === '权') starSpecial += '紫微化权同照，降福化杀为权，格局提升。';
          else starSpecial += '得紫微同照可制其杀气。';
        }
        // 检查落空亡
        const kongWang = (sData.aux || []);
        if (kongWang.includes('地空') || kongWang.includes('地劫')) {
          starSpecial += '七杀落空亡则无威力，虎落平阳。';
        }
      }

      if (bright >= 5) {
        commentary = `${st}在${branch}宫为【${label}】，四恶曜入庙反具横发力，开创进取之力极强。庙旺时杀气化为魄力，主大胆果断、敢冲敢拼。`;
        if (starSpecial) commentary += starSpecial;
        if (sfSuffix) commentary += sfSuffix;
        else if (preJiCount >= 2) commentary += `三方四正有${preJiCount}吉星会照，庙旺遇吉更主横发。`;
      } else if (bright >= 3) {
        commentary = `${st}在${branch}宫为【${label}】，四恶曜星力中等，开创力有余但稳定性不足。`;
        if (starSpecial) commentary += starSpecial;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preJiCount > preShaCount ? '吉多可扶助成就' : preShaCount > preJiCount ? '煞多则冲劲易变冲动' : '吉凶相当，成败在一念之间'}。`;
      } else if (bright === 2) {
        commentary = `${st}在${branch}宫为【${label}】，四恶曜平地则善恶参半，吉凶不定。`;
        if (starSpecial) commentary += starSpecial;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preJiCount >= 2 ? '有吉则尚可驾驭' : '见煞则易走偏锋'}。`;
      } else {
        commentary = `${st}在${branch}宫为【${label}】，四恶曜失陷遇煞大凶——杀气不受控制，破坏力极强，主灾祸刑伤。${isHuo && hasJi ? '此为火性星陷地化忌，凶力倍增。' : ''}`;
        if (starSpecial) commentary += starSpecial;
        if (sfSuffix) commentary += sfSuffix;
      }
    } else if (isAn) {
      // 巨门（暗星）
      if (bright >= 5) {
        commentary = `${st}在${branch}宫为【${label}】，暗星入庙则口才化为雄辩之力，善于分析表达，可成专业权威。是非之气转化为明辨是非的能力。`;
        if (sfSuffix) commentary += sfSuffix;
      } else if (bright >= 3) {
        commentary = `${st}在${branch}宫为【${label}】，暗星星力中等，口舌之能可用但易招是非。`;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preJiCount >= 2 ? '有吉星化解可趋吉' : '化禄化权则更佳'}。`;
      } else if (bright === 2) {
        commentary = `${st}在${branch}宫为【${label}】，暗星平地则是非口舌较多，人际关系需费心经营。`;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preJiCount >= 2 ? '见吉可减少是非' : '是非难免'}。`;
      } else {
        commentary = `${st}在${branch}宫为【${label}】，暗星失陷则是非缠身、口舌招灾，人际关系差，六亲缘薄多猜忌。遇煞星更主暗损、小人陷害。`;
        if (sfSuffix) commentary += sfSuffix;
      }
    } else if (isGu) {
      // 武曲（寡宿刚克）
      if (bright >= 5) {
        commentary = `${st}在${branch}宫为【${label}】，财星入庙主正财丰厚，理财有方，刚毅果决。庙旺虽仍带孤克之气，但财运亨通可补。`;
        if (sfSuffix) commentary += sfSuffix;
      } else if (bright >= 3) {
        commentary = `${st}在${branch}宫为【${label}】，财星星力中等，求财需劳心劳力，刚克之性尚可控制。`;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preJiCount >= 2 ? '宜见吉星柔化，可成' : '外援不足，需自力更生'}。`;
      } else if (bright === 2) {
        commentary = `${st}在${branch}宫为【${label}】，财星平地则进财平平，孤克之性渐显，人际偏刚硬。`;
        if (sfSuffix) commentary += sfSuffix;
      } else {
        commentary = `${st}在${branch}宫为【${label}】，财星失陷则财运受阻、破耗不断，刚克孤寡之性最重。遇煞星主破败损财，入六亲宫则刑克亲人。`;
        if (sfSuffix) commentary += sfSuffix;
      }
    } else if (isHuo && !isSiE) {
      // 太阳（火性星但非四恶曜）
      if (bright >= 5) {
        commentary = `${st}在${branch}宫为【${label}】，星力最强，光芒普照，吉性充分发挥。主贵人运旺、事业光明，男命尤佳。`;
        if (sfSuffix) commentary += sfSuffix;
      } else if (bright >= 3) {
        commentary = `${st}在${branch}宫为【${label}】，星力尚可，光芒稍减但仍有贵气。`;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正有${preJiCount}吉星${preShaCount > 0 ? '、' + preShaCount + '煞星' : ''}，${preJiCount >= 2 ? '吉星可扶助' : '需更多吉星会照'}。`;
      } else if (bright === 2) {
        commentary = `${st}在${branch}宫为【${label}】，星力平平，光芒黯淡，贵人运减弱。`;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preJiCount > preShaCount ? '逢吉则尚可' : '不利'}。`;
      } else {
        commentary = `${st}在${branch}宫为【${label}】，火性星落陷光芒全失，主有志难伸、是非缠身。${hasJi ? '太阳为火性星，陷地化忌凶力倍增。' : ''}遇煞主目疾、头痛或父亲不利。`;
        if (sfSuffix) commentary += sfSuffix;
      }
    } else {
      // 纯吉型主星（天府、天相、天同、天梁、天机、太阴）
      // 制煞特殊：紫微、天府、太阳、化科、化权可制煞（rules_jingcheng_ch1_7.md:530）
      const canZhiSha = ['天府'].includes(st);
      if (bright >= 5) {
        commentary = `${st}在${branch}宫为【${label}】，星力最强，吉性充分发挥。主星庙旺则本宫事务顺遂，正面特质明显。`;
        if (canZhiSha && localShaCount > 0) commentary += `${st}庙旺可制伏煞星，化煞为用。`;
        if (sfSuffix) commentary += sfSuffix;
        else if (preJiCount >= 2) commentary += `三方四正有${preJiCount}吉星加会，锦上添花。`;
      } else if (bright >= 3) {
        commentary = `${st}在${branch}宫为【${label}】，星力尚可，正面特质可以发挥但力度稍减。`;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preJiCount >= 2 ? '有吉星扶助则趋吉' : '遇煞星则力不从心'}。`;
      } else if (bright === 2) {
        commentary = `${st}在${branch}宫为【${label}】，星力平平，吉凶特质均不明显。`;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preJiCount > preShaCount ? '逢吉则平顺' : '逢煞则不利'}。`;
      } else {
        commentary = `${st}在${branch}宫为【${label}】，星力甚弱，正面特质难以发挥，负面特质容易显现。`;
        if (sfSuffix) commentary += sfSuffix;
        else commentary += `三方四正吉${preJiCount}煞${preShaCount}，${preShaCount >= 2 ? '遇煞凶性加重，即使有吉星亦难完全化解' : '凶性渐显'}。`;
      }
    }
    const sev = bright <= 1 ? (isSiE || isHuo ? 2 : 1) : 0;
    items.push({ type: 'brightness', text: commentary, severity: sev, src: '§27庙旺' });
  }

  // 2a-aux. 六煞星庙旺解读（擎羊陀罗火铃，来源：rules_jiedu.md四煞分类）
  const SHA_STARS = ['擎羊','陀罗','火星','铃星'];
  for (const st of (sData.aux || [])) {
    if (!SHA_STARS.includes(st)) continue;
    const bright = getStarBrightness(ctx, st, brIdx);
    if (bright < 0) continue;
    const MW_LABELS = ['陷','不得地','平','利','得地','旺','庙'];
    const label = MW_LABELS[bright] || '?';
    const branch = getBranch(brIdx);
    let commentary = '';
    if (bright >= 5) {
      commentary = `${st}在${branch}宫为【${label}】，煞星庙旺反有正用——可激发斗志与冲劲，若与吉星同宫则化煞为权，主有开创之力。`;
    } else if (bright <= 1) {
      commentary = `${st}在${branch}宫为【${label}】，煞星落陷凶性最重，破坏力强，对本宫事务形成严重冲击。若再逢忌星或其他煞星同宫，凶上加凶。`;
    }
    if (commentary) {
      items.push({ type: 'brightness', text: commentary, severity: bright <= 1 ? 2 : 0, src: '§27庙旺' });
    }
  }

  // 2a-sfsy. 三方四正综合庙旺解读（来源：rules_jiedu.md §207步骤2 + rules_jingcheng_compact.md §155大限判断法）
  // 力量分配：本宫60%、对宫40%、合宫20%、邻宫10%（来源：《初级讲义》rules_jiedu.md:20）
  if ((sData.main || []).length > 0) {
    const sfBrs = getSanfangBrs(brIdx); // [本宫, 对宫, 三合1, 三合2]
    const JI_STARS = ['左辅','右弼','天魁','天钺','文昌','文曲','禄存','天马'];
    const SHA_SFS = ['擎羊','陀罗','火星','铃星','地空','地劫'];

    // 收集三方四正所有主星庙旺
    let sfMainBrights = [];
    let sfJiCount = 0, sfShaCount = 0;
    let sfHasJi = false; // 化忌
    for (const b of sfBrs) {
      const sd = ctx.stars[b] || { main: [], aux: [], hua: {} };
      for (const st of (sd.main || [])) {
        const br = getStarBrightness(ctx, st, b);
        if (br >= 0) sfMainBrights.push({ star: st, br: b, bright: br, palace: ctx.palaceMap[b] || '' });
      }
      const allS = [...(sd.main || []), ...(sd.aux || [])];
      for (const st of allS) {
        if (JI_STARS.includes(st)) sfJiCount++;
        if (SHA_SFS.includes(st)) sfShaCount++;
      }
      if (sd.hua) {
        for (const h of Object.values(sd.hua)) {
          if (h === '禄' || h === '权' || h === '科') sfJiCount++;
          if (h === '忌') { sfShaCount++; sfHasJi = true; }
        }
      }
    }

    // 本宫主星平均亮度
    const localBrights = (sData.main || []).map(st => getStarBrightness(ctx, st, brIdx)).filter(b => b >= 0);
    const localAvg = localBrights.length > 0 ? localBrights.reduce((a, b) => a + b, 0) / localBrights.length : -1;
    // 三方（非本宫）主星平均亮度
    const remoteBrights = sfMainBrights.filter(x => x.br !== brIdx);
    const remoteAvg = remoteBrights.length > 0 ? remoteBrights.reduce((a, b) => a + b.bright, 0) / remoteBrights.length : -1;

    if (localAvg >= 0) {
      let sfComment = '';
      const palLabel = palaceName;

      // 规则1：命宫专论——命身佳但财官迁三宫欠吉（rules_jiedu.md:217-222）
      if (palaceName === '命宫' && localAvg >= 5) {
        const caiBr = ctx.palaceToBr['财帛'];
        const guanBr = ctx.palaceToBr['官禄'];
        const qianBr = ctx.palaceToBr['迁移'];
        const checkBrs = [caiBr, guanBr, qianBr].filter(b => b !== undefined);
        let weakCount = 0;
        let details = [];
        for (const b of checkBrs) {
          const sd = ctx.stars[b] || { main: [] };
          for (const st of (sd.main || [])) {
            const br = getStarBrightness(ctx, st, b);
            if (br >= 0 && br <= 2) { weakCount++; details.push(`${ctx.palaceMap[b]}${st}${['陷','不得地','平'][br]}`); }
          }
        }
        if (weakCount >= 2) {
          sfComment = `三方四正综合：${palLabel}主星庙旺，但三方有${details.join('、')}，命身虽佳而三宫欠吉——纵有才华亦难青云，秀而不实。`;
          items.push({ type: 'sanfang_bright', text: sfComment, severity: 1, src: '§三方四正综合/jiedu217' });
        } else if (sfShaCount >= 3 && sfJiCount <= 1) {
          sfComment = `三方四正综合：${palLabel}主星庙旺，但三方四正煞星${sfShaCount}颗而吉星仅${sfJiCount}颗，煞多吉少——主星虽强，一生仍多阻碍波折。`;
          items.push({ type: 'sanfang_bright', text: sfComment, severity: 1, src: '§三方四正综合/jiedu207' });
        }
      }

      // 规则2：本宫主星庙旺+三方吉多无煞→吉格（rules_jingcheng_compact.md:84,155）
      if (localAvg >= 5 && sfJiCount >= 3 && sfShaCount === 0) {
        sfComment = `三方四正综合：${palLabel}主星庙旺，三方四正有${sfJiCount}颗吉星扶助且无煞冲破——本宫事务大吉，顺遂亨通。`;
        items.push({ type: 'sanfang_bright', text: sfComment, severity: -1, src: '§三方四正综合/jingcheng84' });
      }
      // 规则3：本宫主星庙旺+煞同守+三方吉凶混杂→阻滞辛劳（rules_jingcheng_compact.md:155）
      else if (localAvg >= 5 && sfShaCount > 0 && sfJiCount > 0) {
        if (palaceName !== '命宫' || !items.some(i => i.type === 'sanfang_bright')) {
          sfComment = `三方四正综合：${palLabel}主星庙旺，但三方四正吉${sfJiCount}煞${sfShaCount}混杂——虽有能力但过程多阻碍辛劳，需努力化解。`;
          items.push({ type: 'sanfang_bright', text: sfComment, severity: 0, src: '§三方四正综合/jingcheng155' });
        }
      }
      // 规则4：本宫主星失陷+三方煞凑→大凶（rules_jingcheng_compact.md:155）
      else if (localAvg <= 2 && sfShaCount >= 3) {
        sfComment = `三方四正综合：${palLabel}主星失陷，三方四正又有${sfShaCount}颗煞星凑聚${sfHasJi ? '且见化忌' : ''}——本宫事务凶多吉少，须格外注意防范。`;
        items.push({ type: 'sanfang_bright', text: sfComment, severity: 2, src: '§三方四正综合/jingcheng155' });
      }
      // 规则5：本宫主星失陷但三方有吉扶→平常，不至大凶
      else if (localAvg <= 2 && sfJiCount >= 2 && sfShaCount <= 1) {
        sfComment = `三方四正综合：${palLabel}主星失陷，但三方四正有${sfJiCount}颗吉星扶助——虽本宫力弱，吉星可部分化解，不至大凶但仍需谨慎。`;
        items.push({ type: 'sanfang_bright', text: sfComment, severity: 0, src: '§三方四正综合/jingcheng155' });
      }

      // 规则6：杀破狼三方聚——入庙富贵失陷漂泊（rules_data.json杀破狼格）
      const sfAllMain = sfMainBrights.map(x => x.star);
      const hasSha = sfAllMain.includes('七杀');
      const hasPo = sfAllMain.includes('破军');
      const hasLang = sfAllMain.includes('贪狼');
      if (hasSha && hasPo && hasLang) {
        const splBrights = sfMainBrights.filter(x => ['七杀','破军','贪狼'].includes(x.star));
        const splAvg = splBrights.reduce((a, b) => a + b.bright, 0) / splBrights.length;
        if (splAvg >= 5) {
          sfComment = `杀破狼三方聚且入庙——主大富大贵，变革开创之格局，一生波澜壮阔但终有大成。`;
          items.push({ type: 'sanfang_bright', text: sfComment, severity: -2, src: '§杀破狼格/庙旺' });
        } else if (splAvg <= 2) {
          sfComment = `杀破狼三方聚但失陷——主漂泊不定、起伏剧烈，开创力虽有但难以持久，一生多变动。`;
          items.push({ type: 'sanfang_bright', text: sfComment, severity: 2, src: '§杀破狼格/失陷' });
        }
      }
    }
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

/* ---- 最大凶象/最大吉象 + 身宫（移入命宫tab显示）---- */

function generateSihuaHighlight(ctx) {
  const items = [];

  // 化禄含义表
  const LU_MEANING = {
    '命宫': '主人缘佳、一生有福禄',
    '兄弟': '主兄弟得力、合伙得财',
    '夫妻': '主配偶助力、婚后财禄显',
    '子女': '主子女有福、合伙得财、桃花旺',
    '财帛': '主赚钱能力强、一生忙于理财',
    '疾厄': '主身体健康、心宽体胖',
    '迁移': '主出外发迹、衣锦荣归',
    '奴仆': '主人缘广、得下属朋友之力',
    '官禄': '主工作运好、事业忙碌中得财',
    '田宅': '主有房产库存、家运兴旺',
    '福德': '主有福可享、秀外慧中',
    '父母': '主父母庇荫、得长辈提携'
  };
  // 化忌含义表
  const JI_MEANING = {
    '廉贞': '主脓血之灾',
    '武曲': '主财损、理财不顺',
    '太阴': '主投资失败、阴性财损',
    '太阳': '主名声受损、贵人不力',
    '天机': '主计划多变、心神不宁',
    '巨门': '主口舌是非、暗中小人',
    '天同': '主福薄不安、享乐受阻',
    '贪狼': '主欲望受挫、桃花纠纷',
    '文昌': '主文书失误、考运不佳',
    '文曲': '主感情困扰、是非口舌'
  };

  // 化忌
  const jiStar = Object.entries(ctx.natalHua).find(([s,h]) => h === '忌');
  if (jiStar) {
    const jiBr = ctx.starPos[jiStar[0]];
    const jiPal = jiBr !== undefined ? ctx.palaceMap[jiBr] : '?';
    const jiName = jiStar[0];
    let jiReversed = false;
    if (jiName === '太阳' || jiName === '太阴') {
      const bright = getStarBrightness(ctx, jiName, jiBr);
      const mwLocal = jiBr !== undefined ? (ctx.stars[jiBr]?.mw?.[jiName] ?? -1) : -1;
      if (bright >= 5 || mwLocal >= 5) jiReversed = true; // 旺(5)或庙(6)
    }
    const meaning = JI_MEANING[jiName] || '主不顺';
    if (jiReversed) {
      items.push({ type: 'warn', text: `化忌特论：${jiName}化忌落${jiPal}，但${jiName}庙旺→反为福论（化忌力量被化解）` });
    } else {
      items.push({ type: 'severe', text: `最大凶象：${jiName}化忌落${jiPal}（${meaning}），${jiPal}所主之事须特别注意` });
    }
  }

  // 化禄
  const luStar = Object.entries(ctx.natalHua).find(([s,h]) => h === '禄');
  if (luStar) {
    const luBr = ctx.starPos[luStar[0]];
    const luPal = luBr !== undefined ? ctx.palaceMap[luBr] : '?';
    const luMeaning = LU_MEANING[luPal] || '';
    items.push({ type: 'good', text: `最大吉象：${luStar[0]}化禄落${luPal}——${luMeaning}` });
  }

  // 身宫
  const shenBr = ctx.shenBr;
  if (shenBr !== undefined) {
    const shenPal = ctx.palaceMap[shenBr];
    if (shenPal) {
      const shenDesc = {'命宫':'性格鲜明，自我意识强','夫妻':'重感情，一生以婚姻为重','财帛':'重财，对金钱敏感','迁移':'喜外出，适合异地发展','官禄':'事业心重，以工作为中心','福德':'重享受，注重精神生活'}[shenPal] || '';
      items.push({ type: 'neutral', text: `身宫在${shenPal}：${shenDesc}` });
    }
  }

  return items;
}

/* ========== 渲染函数 (updated for P1-P4) ========== */

function _boldAfterColon(text) {
  const idx = text.indexOf('：');
  if (idx < 0) return text;
  return text.slice(0, idx + 1) + '<b>' + text.slice(idx + 1) + '</b>';
}

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
    html += `<div class="eng-item ${cls}">${_boldAfterColon(item.text)}</div>`;
  }

  if (palaceResult.palace === '命宫' && globalResults) {
    // 格局
    if (globalResults._geju?.length > 0) {
      html += '<div class="eng-section-title">★ 格局</div>';
      for (const g of globalResults._geju) {
        html += `<div class="eng-item eng-geju">${g.name}：<b>${g.text}</b></div>`;
      }
    }
    // P3: 夹格
    if (globalResults._jiaGe?.length > 0) {
      html += '<div class="eng-section-title">夹格分析</div>';
      for (const j of globalResults._jiaGe) {
        const cls = j.severity >= 2 ? 'eng-warn' : j.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${_boldAfterColon(j.text)}</div>`;
      }
    }
    // 本对宫
    if (globalResults._benduigong?.length > 0) {
      html += '<div class="eng-section-title">本对宫强弱</div>';
      for (const b of globalResults._benduigong) {
        html += `<div class="eng-item eng-neutral">${_boldAfterColon(b.text)}</div>`;
      }
    }
    // 女命
    if (globalResults._female?.length > 0) {
      html += '<div class="eng-section-title">女命专论</div>';
      for (const f of globalResults._female) {
        html += `<div class="eng-item ${f.severity >= 2 ? 'eng-warn' : 'eng-neutral'}">${_boldAfterColon(f.text)}</div>`;
      }
    }
    // 飞宫单层
    if (globalResults._feigong?.length > 0) {
      html += '<div class="eng-section-title">飞宫四化</div>';
      html += '<div class="eng-item eng-neutral" style="color:#666;font-size:0.88em;line-height:1.5;border-left:3px solid #ccc;padding-left:8px;margin-bottom:6px">'
        + '读法：「X宫干 飞Y星化Z 入W宫」= X宫通过天干让Y星产生Z变化，落到W宫——化禄是助力，化忌是压力。<br>'
        + '• 自化（回本宫）= 这个宫自身在变化&emsp;• 冲对宫 = 间接给对面宫位施压<br>'
        + '• 「原局化禄」冲突 = 出生年的好运被削弱<br>'
        + '<b>例</b>：「财帛干飞天机化忌冲福德」→ 理财压力（财帛化忌）波及内心安宁（冲福德）</div>';
      for (const f of globalResults._feigong) {
        const cls = f.severity >= 2 ? 'eng-warn' : f.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${_boldAfterColon(f.text)}</div>`;
      }
    }
    // P1: 链式飞宫
    if (globalResults._feigongChain?.length > 0) {
      html += '<div class="eng-section-title">链式飞宫追踪</div>';
      html += '<div class="eng-item eng-neutral" style="color:#666;font-size:0.88em;line-height:1.5;border-left:3px solid #ccc;padding-left:8px;margin-bottom:6px">'
        + '读法：「A宫忌→B宫→转忌→C宫」= A的压力先传到B，B再传给C，像多米诺骨牌。<br>'
        + '• 忌转忌（雪上加霜）= 压力经中转后加重&emsp;• 禄转忌（得中有失）= 助力中转后反成压力<br>'
        + '<b>例</b>：「财帛忌→福德→转忌→兄弟」→ 财务压力先影响心态（福德），再影响人际（兄弟）</div>';
      for (const f of globalResults._feigongChain) {
        const cls = f.severity >= 3 ? 'eng-severe' : f.severity >= 2 ? 'eng-warn' : f.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${_boldAfterColon(f.text)}</div>`;
      }
    }
    // P2: 自化叠化
    if (globalResults._diehua?.length > 0) {
      html += '<div class="eng-section-title">自化叠化</div>';
      for (const d of globalResults._diehua) {
        const cls = d.severity >= 3 ? 'eng-severe' : d.severity >= 2 ? 'eng-warn' : d.severity < 0 ? 'eng-good' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${_boldAfterColon(d.text)}</div>`;
      }
    }
    // 最大凶象/最大吉象/身宫（原摘要内容，移入命宫tab）
    if (globalResults._sihuaHighlight?.length > 0) {
      html += '<div class="eng-section-title">四化要点</div>';
      for (const item of globalResults._sihuaHighlight) {
        const cls = item.type === 'severe' ? 'eng-severe' : item.type === 'good' ? 'eng-good' : item.type === 'warn' ? 'eng-warn' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${_boldAfterColon(item.text)}</div>`;
      }
    }
    // 六合
    if (globalResults._liuhe?.length > 0) {
      html += '<div class="eng-section-title">六合融合</div>';
      for (const l of globalResults._liuhe) {
        const cls = l.severity >= 1 ? 'eng-warn' : 'eng-neutral';
        html += `<div class="eng-item ${cls}">${_boldAfterColon(l.text)}</div>`;
      }
    }
    // 大限走势 + 大限四化（合并，按年龄段折叠）
    const hasDaxian = globalResults._daxian?.length > 0;
    const hasDaxianDetail = globalResults._daxianDetail?.length > 0;
    if (hasDaxian || hasDaxianDetail) {
      html += '<div class="eng-section-title">大限走势</div>';
      const dxTrend = globalResults._daxian || [];
      const dxDetail = globalResults._daxianDetail || [];
      const count = Math.max(dxTrend.length, dxDetail.length);
      for (let di = 0; di < count; di++) {
        const trend = dxTrend[di];
        const detail = dxDetail[di];
        const ageStart = trend?.ageStart || detail?.ageStart || '?';
        const ageEnd = trend?.ageEnd || detail?.ageEnd || '?';
        // 判断是否有重要内容
        const hasSevere = (trend?.items?.some(it => it.severity >= 3 || it.severity <= -1)) ||
                          (detail?.items?.some(it => it.severity >= 2));
        const badge = hasSevere ? ' <span style="color:#cc0000;font-size:0.8em">⚠</span>' : '';
        const dxId = `dxm_${di}`;
        html += `<div class="eng-item eng-neutral" style="font-weight:500;cursor:pointer;user-select:none" onclick="var el=document.getElementById('${dxId}');el.style.display=el.style.display==='none'?'block':'none'">${ageStart}-${ageEnd}岁${badge} <span style="font-size:0.75em;color:#888">▶ 点击展开</span></div>`;
        html += `<div id="${dxId}" style="display:none">`;
        // 走势内容
        if (trend?.items) {
          for (const item of trend.items) {
            const cls = item.severity >= 3 ? 'eng-severe' : item.severity < 0 ? 'eng-good' : 'eng-neutral';
            html += `<div class="eng-item ${cls}">${_boldAfterColon(item.text)}</div>`;
          }
        }
        // 四化详析内容
        if (detail?.items) {
          for (const item of detail.items) {
            const cls = item.severity >= 3 ? 'eng-severe' : item.severity >= 2 ? 'eng-warn' : item.severity < 0 ? 'eng-good' : 'eng-neutral';
            html += `<div class="eng-item ${cls}">${_boldAfterColon(item.text)}</div>`;
          }
        }
        html += `</div>`;
      }
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
