/**
 * Headless test harness for 紫微斗数 chart + interpretation
 * Extracts core logic from ziwei.html and runs it in Node.js
 */
const fs = require('fs');
const { Solar, Lunar } = require('lunar-javascript');

// ===== Load rules =====
const RULES_DATA = JSON.parse(fs.readFileSync('rules/rules_data.json', 'utf-8'));

// ===== Load rule2 data =====
// rule2_data.js defines RULE2_MINGONG and RULE2_OTHER_PALACES as globals
eval(fs.readFileSync('rules/rule2_data.js', 'utf-8'));

// ===== Extract core constants from inline script =====
const html = fs.readFileSync('ziwei.html', 'utf-8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const inlineScript = scriptMatch[1];

// Extract the SIHUA table and other constants
const SIHUA = {
  '甲':['廉贞','破军','武曲','太阳'], '乙':['天机','天梁','紫微','太阴'],
  '丙':['天同','天机','文昌','廉贞'], '丁':['太阴','天同','天机','巨门'],
  '戊':['贪狼','太阴','右弼','天机'], '己':['武曲','贪狼','天梁','文曲'],
  '庚':['太阳','武曲','太阴','天同'], '辛':['巨门','太阳','文曲','文昌'],
  '壬':['天梁','紫微','左辅','武曲'], '癸':['破军','巨门','太阴','贪狼']
};

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
const PALACE_NAMES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','奴仆','官禄','田宅','福德','父母'];

// 14 main stars
const MAIN_STARS = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];

// 紫微星系 positions relative to 紫微
const ZW_OFFSETS = {'紫微':0,'天机':-1,'太阳':-2,'武曲':-3,'天同':-4,'廉贞':-6};
// 天府星系: 天府 is at (12 - ziwei_pos) % 12
const TF_OFFSETS = {'天府':0,'太阴':1,'贪狼':2,'巨门':3,'天相':4,'天梁':5,'七杀':6,'破军':10};

// 五行局 lookup
const WUXING_TABLE = [
  [2,6,3,5,4,2,6,3,5,4,2,6], // 甲/己
  [4,2,6,3,5,4,2,6,3,5,4,2], // 乙/庚
  [3,5,4,2,6,3,5,4,2,6,3,5], // 丙/辛
  [6,3,5,4,2,6,3,5,4,2,6,3], // 丁/壬
  [5,4,2,6,3,5,4,2,6,3,5,4], // 戊/癸
];

// 长生十二神
const CHANGSHENG = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
const CS_START = { 2: 8, 3: 11, 4: 5, 5: 8, 6: 2 }; // 五行局 -> 长生起始地支

// ===== Core calculation functions =====

function calculateChart(year, month, day, hour, gender) {
  // Convert solar to lunar
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();

  const lunarYear = lunar.getYear();
  const lunarMonth = lunar.getMonth();
  const lunarDay = lunar.getDay();
  const isLeapMonth = lunar.getMonth() < 0;

  // Year stem/branch
  const yearStemIdx = (lunarYear - 4) % 10;
  const yearBranchIdx = (lunarYear - 4) % 12;
  const yearStem = STEMS[yearStemIdx];
  const yearBranch = BRANCHES[yearBranchIdx];

  // Gender: male=1, female=0
  const isMale = gender === 'male' || gender === '男';
  const yinYang = yearStemIdx % 2; // 0=阳, 1=阴
  const direction = (isMale && yinYang === 0) || (!isMale && yinYang === 1) ? 1 : -1; // 1=顺, -1=逆

  // === 安命宫 ===
  const absMonth = Math.abs(lunarMonth);
  let mingIdx = (2 + absMonth - 1 - hour + 12 * 3) % 12; // 寅=2 + month - 1 - hour

  // === 安身宫 ===
  let shenIdx = (2 + absMonth - 1 + hour) % 12;

  // === 十二宫排列 (逆时针) ===
  const palaces = [];
  for (let i = 0; i < 12; i++) {
    palaces.push({
      name: PALACE_NAMES[i],
      branchIdx: (mingIdx - i + 12) % 12,
      branch: BRANCHES[(mingIdx - i + 12) % 12],
      stars: [],
      sihua: []
    });
  }

  // === 宫干 (五虎遁) ===
  const wuhuStart = [0, 2, 4, 6, 8]; // 甲己起丙寅, 乙庚起戊寅...
  const startStem = wuhuStart[yearStemIdx % 5] + 2; // +2 for 寅
  palaces.forEach(p => {
    p.stemIdx = (startStem + p.branchIdx - 2 + 10) % 10;
    p.stem = STEMS[p.stemIdx];
  });

  // Correct 五虎遁
  const wuhu = [2, 4, 6, 8, 0];
  palaces.forEach(p => {
    p.stemIdx = (wuhu[yearStemIdx % 5] + p.branchIdx) % 10;
    p.stem = STEMS[p.stemIdx];
  });

  // === 五行局 ===
  const wuxingRow = yearStemIdx % 5;
  const wuxingJu = WUXING_TABLE[wuxingRow][mingIdx];

  // === 紫微星位置 ===
  const zwPos = findZiwei(lunarDay, wuxingJu);

  // === 安主星 ===
  // 紫微星系
  for (const [star, offset] of Object.entries(ZW_OFFSETS)) {
    const pos = (zwPos + offset + 12) % 12;
    const palace = palaces.find(p => p.branchIdx === pos);
    if (palace) palace.stars.push(star);
  }

  // 天府星系
  const tfPos = (12 - zwPos) % 12;
  for (const [star, offset] of Object.entries(TF_OFFSETS)) {
    let pos;
    if (star === '破军') {
      pos = (tfPos + 10) % 12; // 破军特殊
    } else {
      pos = (tfPos + offset) % 12;
    }
    const palace = palaces.find(p => p.branchIdx === pos);
    if (palace) palace.stars.push(star);
  }

  // === 四化 ===
  const sihuaStars = SIHUA[yearStem]; // [禄,权,科,忌]
  const sihuaNames = ['化禄','化权','化科','化忌'];
  const sihuaResult = {};
  sihuaStars.forEach((star, i) => {
    sihuaResult[star] = sihuaNames[i];
    // Find which palace this star is in
    const palace = palaces.find(p => p.stars.includes(star));
    if (palace) {
      palace.sihua.push(sihuaNames[i]);
    }
  });

  // === 辅星简化 (左辅右弼文昌文曲) ===
  // 左辅: 辰+月-1; 右弼: 戌-月+1
  const zuofuIdx = (4 + absMonth - 1) % 12;
  const youbiIdx = (10 - absMonth + 1 + 12) % 12;
  palaces.find(p => p.branchIdx === zuofuIdx)?.stars.push('左辅');
  palaces.find(p => p.branchIdx === youbiIdx)?.stars.push('右弼');

  // 文昌: 戌-hour; 文曲: 辰+hour
  const wcIdx = (10 - hour + 12) % 12;
  const wqIdx = (4 + hour) % 12;
  palaces.find(p => p.branchIdx === wcIdx)?.stars.push('文昌');
  palaces.find(p => p.branchIdx === wqIdx)?.stars.push('文曲');

  // === 禄存/擎羊/陀罗 ===
  const lucunMap = [2,3,5,6,5,6,8,9,11,0]; // 甲禄在寅...
  const lucunIdx = lucunMap[yearStemIdx];
  palaces.find(p => p.branchIdx === lucunIdx)?.stars.push('禄存');
  palaces.find(p => p.branchIdx === (lucunIdx + 1) % 12)?.stars.push('擎羊');
  palaces.find(p => p.branchIdx === (lucunIdx - 1 + 12) % 12)?.stars.push('陀罗');

  // === 天魁天钺 ===
  const kuiMap = [1,0,11,11,1,0,1,2,3,3]; // 年干->天魁地支
  const yueMap = [7,8,9,9,7,8,7,6,5,5]; // 年干->天钺地支
  palaces.find(p => p.branchIdx === kuiMap[yearStemIdx])?.stars.push('天魁');
  palaces.find(p => p.branchIdx === yueMap[yearStemIdx])?.stars.push('天钺');

  // === 火星铃星 ===
  const huoBase = [2, 3, 1, 9]; // 寅午戌=寅, 申子辰=卯, 巳酉丑=丑, 亥卯未=酉
  const grpIdx = [3,2,0,1,2,3,0,1,2,3,0,1][yearBranchIdx]; // year branch -> group
  const huoIdx = (huoBase[grpIdx] + hour) % 12;
  const lingBase = [10, 10, 10, 10]; // 铃星四组都从戌起
  const lingIdx = (lingBase[grpIdx] + hour) % 12;
  palaces.find(p => p.branchIdx === huoIdx)?.stars.push('火星');
  palaces.find(p => p.branchIdx === lingIdx)?.stars.push('铃星');

  // === 天马 ===
  const tianmaMap = [2,11,8,5,2,11,8,5,2,11,8,5]; // 年支->天马地支
  const tianmaIdx = tianmaMap[yearBranchIdx];
  palaces.find(p => p.branchIdx === tianmaIdx)?.stars.push('天马');

  // === 长生十二神 ===
  const csStart = CS_START[wuxingJu];
  palaces.forEach(p => {
    const dist = (p.branchIdx - csStart + 12) % 12;
    const csIdx = direction > 0 ? dist : (12 - dist) % 12;
    p.changsheng = CHANGSHENG[csIdx];
  });

  // === 大限 ===
  const daxianStart = wuxingJu; // 大限起始年龄 = 五行局数+1? No, = 五行局数+1
  // 大限from命宫, direction same as changsheng
  palaces.forEach((p, i) => {
    const step = direction > 0 ? i : (12 - i) % 12;
    const daxianPalaceIdx = (mingIdx + (direction > 0 ? -step : step) + 12) % 12;
    // Actually 大限 goes from 命宫 opposite to宫名排列
    p.daxianStart = wuxingJu + i * 10;
    p.daxianEnd = wuxingJu + (i + 1) * 10 - 1;
  });

  return {
    // Input
    solar: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    lunar: `${lunarYear}年${absMonth}月${lunarDay}日`,
    yearStem, yearBranch,
    hour, hourBranch: BRANCHES[hour],
    gender: isMale ? '男' : '女',
    direction: direction > 0 ? '顺行' : '逆行',

    // Chart
    mingIdx, shenIdx,
    mingBranch: BRANCHES[mingIdx],
    shenBranch: BRANCHES[shenIdx],
    wuxingJu,
    zwPos,
    palaces,
    sihua: sihuaResult,
    sihuaStars
  };
}

function findZiwei(day, ju) {
  // 紫微星位置查表法
  let q = Math.ceil(day / ju);
  let r = day - (q - 1) * ju;
  // 逢偶进一
  if (r === 0) {
    return (q - 1 + 2) % 12; // 寅=2 offset
  }
  // 奇数位
  let pos = q;
  if (r % 2 === 0) pos += 1; // 偶进
  while (r > 0) {
    r -= 1;
    if (r > 0) {
      pos += (r % 2 === 0) ? -1 : 1;
    }
  }
  return (pos - 1 + 2) % 12;
}

// Simplified findZiwei using the lookup approach
function findZiweiLookup(day, ju) {
  // Build table
  for (let pos = 0; pos < 12; pos++) {
    const base = pos * ju;
    for (let offset = 0; offset < ju; offset++) {
      const d = base + offset + 1;
      if (d === day) {
        // Even offset: forward, odd: back
        let result = pos;
        // Apply remainder rules
        if (offset > 0) {
          if (offset % 2 === 1) result = pos + 1;
          else result = pos;
          // More complex logic needed
        }
        return (result + 2) % 12; // +2 for 寅 offset
      }
    }
  }
  return 2; // default
}

// ===== Print chart =====
function printChart(chart) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  命主：${chart.gender}命  ${chart.solar}（${chart.lunar}）${BRANCHES[chart.hour]}时`);
  console.log(`  年干支：${chart.yearStem}${chart.yearBranch}  命宫：${chart.mingBranch}  身宫：${chart.shenBranch}`);
  console.log(`  五行局：${chart.wuxingJu}局  行运：${chart.direction}`);
  console.log(`  四化：${chart.sihuaStars.map((s,i) => s + ['化禄','化权','化科','化忌'][i]).join('、')}`);
  console.log(`${'='.repeat(60)}`);

  console.log('\n  十二宫星曜分布：');
  for (const p of chart.palaces) {
    const isMing = p.branchIdx === chart.mingIdx;
    const isShen = p.branchIdx === chart.shenIdx;
    const markers = [];
    if (isMing) markers.push('命');
    if (isShen) markers.push('身');
    const markerStr = markers.length ? `[${markers.join('')}]` : '';
    const sihuaStr = p.sihua.length ? ` (${p.sihua.join(',')})` : '';
    const mainStars = p.stars.filter(s => MAIN_STARS.includes(s));
    const auxStars = p.stars.filter(s => !MAIN_STARS.includes(s));
    console.log(`  ${p.stem}${p.branch} ${p.name}${markerStr}${sihuaStr} [${p.changsheng}]`);
    if (mainStars.length) console.log(`    主星：${mainStars.join(' ')}`);
    if (auxStars.length) console.log(`    辅星：${auxStars.join(' ')}`);
  }
}

// ===== Run test =====
const chart = calculateChart(1990, 8, 15, 6, 'male'); // 午时=6
printChart(chart);

// Also output as JSON for further processing
fs.writeFileSync('test_chart.json', JSON.stringify(chart, null, 2), 'utf-8');
console.log('\nChart saved to test_chart.json');
