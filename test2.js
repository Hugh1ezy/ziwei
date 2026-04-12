const fs = require('fs');
const {Solar} = require('lunar-javascript');

// === Test Subject #2: 女命 1985-03-20 卯时 ===
const solar = Solar.fromYmd(1985, 3, 20);
const lunar = solar.getLunar();
const year = lunar.getYear(), month = Math.abs(lunar.getMonth()), day = lunar.getDay();
const yearStemIdx = (year - 4) % 10;
const yearBranchIdx = (year - 4) % 12;
const STEMS='甲乙丙丁戊己庚辛壬癸'.split('');
const BRANCHES='子丑寅卯辰巳午未申酉戌亥'.split('');
const PNAMES=['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','奴仆','官禄','田宅','福德','父母'];
const MAIN14=['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
const hour = 3; // 卯时

const mingIdx = (2 + month - 1 - hour + 36) % 12;
const shenIdx = (2 + month - 1 + hour) % 12;
const yinYang = yearStemIdx % 2;
const direction = (false && yinYang===0) || (true && yinYang===1) ? 1 : -1;

const wuhu = [2,4,6,8,0];
const palaces = [];
for(let i=0;i<12;i++){
  const brIdx = (mingIdx - i + 12) % 12;
  const stemIdx = (wuhu[yearStemIdx%5] + brIdx) % 10;
  palaces.push({name:PNAMES[i], branchIdx:brIdx, branch:BRANCHES[brIdx], stem:STEMS[stemIdx], stemIdx, stars:[], sihua:[]});
}

const WUXING=[[2,6,3,5,4,2,6,3,5,4,2,6],[4,2,6,3,5,4,2,6,3,5,4,2],[3,5,4,2,6,3,5,4,2,6,3,5],[6,3,5,4,2,6,3,5,4,2,6,3],[5,4,2,6,3,5,4,2,6,3,5,4]];
const wuxingJu = WUXING[yearStemIdx%5][mingIdx];

function findZW(d, ju) {
  for(let pos=0;pos<12;pos++){for(let off=0;off<ju;off++){if(pos*ju+off+1===d){if(off===0)return(pos+2)%12;let r=pos,rem=off;while(rem>0){rem--;r+=(rem%2===0)?1:-1;}return(r+2)%12;}}}return 2;
}
const zwPos = findZW(day, wuxingJu);

const ZW_OFF={'紫微':0,'天机':-1,'太阳':-2,'武曲':-3,'天同':-4,'廉贞':-6};
const TF_OFF={'天府':0,'太阴':1,'贪狼':2,'巨门':3,'天相':4,'天梁':5,'七杀':6,'破军':10};
for(const[star,off] of Object.entries(ZW_OFF)){const pos=(zwPos+off+12)%12;const p=palaces.find(pp=>pp.branchIdx===pos);if(p)p.stars.push(star);}
const tfPos=(12-zwPos)%12;
for(const[star,off] of Object.entries(TF_OFF)){const pos=(tfPos+off)%12;const p=palaces.find(pp=>pp.branchIdx===pos);if(p)p.stars.push(star);}

const SIHUA={'甲':['廉贞','破军','武曲','太阳'],'乙':['天机','天梁','紫微','太阴']};
const ys = STEMS[yearStemIdx];
const sihuaStars = SIHUA[ys];
const huaNames=['化禄','化权','化科','化忌'];
sihuaStars.forEach((star,i)=>{const p=palaces.find(pp=>pp.stars.includes(star));if(p)p.sihua.push(huaNames[i]);});

const zuofuIdx=(4+month-1)%12;const youbiIdx=(10-month+1+12)%12;
palaces.find(p=>p.branchIdx===zuofuIdx)?.stars.push('左辅');
palaces.find(p=>p.branchIdx===youbiIdx)?.stars.push('右弼');
const wcIdx=(10-hour+12)%12;const wqIdx=(4+hour)%12;
palaces.find(p=>p.branchIdx===wcIdx)?.stars.push('文昌');
palaces.find(p=>p.branchIdx===wqIdx)?.stars.push('文曲');
const lucunMap=[2,3,5,6,5,6,8,9,11,0];const lucunIdx=lucunMap[yearStemIdx];
palaces.find(p=>p.branchIdx===lucunIdx)?.stars.push('禄存');
palaces.find(p=>p.branchIdx===(lucunIdx+1)%12)?.stars.push('擎羊');
palaces.find(p=>p.branchIdx===(lucunIdx-1+12)%12)?.stars.push('陀罗');
const kuiMap=[1,0,11,11,1,0,1,2,3,3];const yueMap=[7,8,9,9,7,8,7,6,5,5];
palaces.find(p=>p.branchIdx===kuiMap[yearStemIdx])?.stars.push('天魁');
palaces.find(p=>p.branchIdx===yueMap[yearStemIdx])?.stars.push('天钺');
const huoBase=[2,3,1,9];const grpIdx=[3,2,0,1,2,3,0,1,2,3,0,1][yearBranchIdx];
palaces.find(p=>p.branchIdx===(huoBase[grpIdx]+hour)%12)?.stars.push('火星');
palaces.find(p=>p.branchIdx===(10+hour)%12)?.stars.push('铃星');
const tianmaMap=[2,11,8,5,2,11,8,5,2,11,8,5];
palaces.find(p=>p.branchIdx===tianmaMap[yearBranchIdx])?.stars.push('天马');

const CS=['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
const CS_START={2:8,3:11,4:5,5:8,6:2};const csStart=CS_START[wuxingJu];
palaces.forEach(p=>{const dist=(p.branchIdx-csStart+12)%12;p.changsheng=CS[direction>0?dist:(12-dist)%12];});

console.log('========================================');
console.log('命主#2：女命 1985-03-20 卯时');
console.log(`农历：${year}年${month}月${day}日 年干支：${ys}${BRANCHES[yearBranchIdx]}`);
console.log(`命宫：${BRANCHES[mingIdx]} 身宫：${BRANCHES[shenIdx]} ${wuxingJu}局 ${direction>0?'顺':'逆'}行`);
console.log(`四化：${sihuaStars.map((s,i)=>s+huaNames[i]).join('、')}`);
console.log('========================================');
for(const p of palaces){
  const ms=p.stars.filter(s=>MAIN14.includes(s));const ax=p.stars.filter(s=>!MAIN14.includes(s));
  const mk=[];if(p.branchIdx===mingIdx)mk.push('命');if(p.branchIdx===shenIdx)mk.push('身');
  const si=p.sihua.length?` (${p.sihua.join(',')})`:'';
  console.log(`${p.stem}${p.branch} ${p.name}${mk.length?'['+mk.join('')+']':''}${si} [${p.changsheng}]`);
  if(ms.length) console.log(`  主星：${ms.join(' ')}`);
  if(ax.length) console.log(`  辅星：${ax.join(' ')}`);
}

// Run engine
let engineCode = fs.readFileSync('rules/rules_engine.js','utf-8').replace('let RULES_DATA = null;','//patched');
eval('var RULES_DATA = '+fs.readFileSync('rules/rules_data.json','utf-8'));
eval(fs.readFileSync('rules/rule2_data.js','utf-8'));
eval(engineCode);

const starsArr=new Array(12).fill(null);const pm={};
for(const p of palaces){
  pm[p.branchIdx]=p.name;
  const ms=p.stars.filter(s=>MAIN14.includes(s));const ax=p.stars.filter(s=>!MAIN14.includes(s));
  const mw={};for(const s of ms)mw[s]=2;
  starsArr[p.branchIdx]={main:ms,aux:ax,sihua:p.sihua,mw};
}
const r2s={stars:starsArr,palaceMap:pm,mingGongBrIdx:mingIdx};
const cs={ju:wuxingJu,gender:'female',yearBrIdx:yearBranchIdx,yearStemIdx,direction};
const result=interpretChart(cs,r2s);
if(!result){console.log('Engine returned null!');process.exit(1);}

console.log('\n=== ENGINE OUTPUT (断语3) ===');
for(const pn of PNAMES){
  const p=result[pn];if(p?.items?.length){
    console.log('\n'+pn+' ['+p.qi+']:');
    p.items.slice(0,4).forEach(it=>{const sv=it.severity>=2?'!!':it.severity>=1?'!':it.severity<0?'+':' ';console.log('  '+sv+' '+it.text.substring(0,90));});
    if(p.items.length>4)console.log('  ...+'+(p.items.length-4)+' more');
  }
}
console.log('\n格局:',result._geju?.map(g=>g.name).join(', ')||'(none)');
let s3=0;
PNAMES.forEach(pn=>{(result[pn]?.items||[]).forEach(it=>{if(it.severity>=3){console.log('Sev3 !!'+pn+':'+it.text.substring(0,60));s3++;}});});
console.log('Severity3 count:',s3,s3===0?'(all clear)':'');
console.log('\n摘要:',result._summary?.substring(0,400));
