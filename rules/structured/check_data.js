// 自检：rule2_data.js 中的原文段落是否被截断（结尾不是句读、或长度停在同一上限附近）
// 用法：node rules/structured/check_data.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'rule2_data.js'), 'utf8');
const { M, O } = new Function(src + ';return {M:RULE2_MINGONG,O:RULE2_OTHER}')();
const END = /[。；！？”」）)】]\s*$/;
const bad = [];
const check = (where, t) => {
  if (!t) return;
  const s = t.replace(/[\s\x7f\d]+$/g, '');
  if (!END.test(s)) bad.push(where + '：结尾"' + s.slice(-12) + '"（' + t.length + '字）');
};
for (const [k, v] of Object.entries(M)) {
  check('命宫·' + k + '·通论', v.general);
  for (const [b, t] of Object.entries(v.branches || {})) check('命宫·' + k + '·' + b, t);
}
for (const [p, stars] of Object.entries(O)) for (const [k, t] of Object.entries(stars)) check(p + '·' + k, typeof t === 'string' ? t : '');
console.log(bad.length ? '可能截断 ' + bad.length + ' 处：\n' + bad.join('\n') : '未发现截断');
