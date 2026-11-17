// 各宫断语去重（网页版）：由测试脚本 gen_u.js / run_u.js 移植，规则同 /mnt/project-files/ziwei-synonyms/四宫测试/本串已定规则_1111.md 及各宫已定规则
// 数据：rules/dedup/data/<组>.json（node build_u.js 生成：规则表已按各归类台改写、主题改正，另附真同义、包含、合并、拆分表）
(function (root) {
  const GROUPS = ['fd', 'jk', 'gl', 'fq', 'cb', 'gj', 'zn', 'xd', 'fm', 'jy', 'qy', 'mq'];
  const ORD = ['命', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '奴仆', '交友', '官禄', '田宅', '福德', '父母'];
  const TO = ['格局', '性格', '才能', '福寿', '健康', '事业', '财富', '田宅', '婚姻', '配偶', '子女', '生育', '兄弟', '父母', '六亲', '交友', '迁移', '容貌', '僧道', '本人'];
  const SR = { '紫微': 'ziwei_minggong.txt', '天机': 'tianji_minggong.txt', '天梁': 'tianliang_minggong.txt', '太阳': 'taiyang_minggong.txt', '武曲': 'wuqu_minggong.txt', '天同': 'tiantong_minggong.txt', '廉贞': 'lianzhen_minggong.txt', '天府': 'tianfu_minggong.txt', '太阴': 'taiyin_minggong.txt', '贪狼': 'tanlang_minggong.txt', '巨门': 'jumen_minggong.txt', '天相': 'tianxiang_minggong.txt', '七杀': 'qisha_minggong.txt', '破军': 'pojun_minggong.txt' };
  const BR = '子丑寅卯辰巳午未申酉戌亥';
  const NEU = /^(亦主|每主|多主|又主|仍主|常主|亦|也|又|只|就|即|则|且|为|主)(?=..)/;
  function norm(t) { let s = t.replace(/[“”"]/g, ''); if (/[，,；（(]/.test(s)) return null;
    let p; do { p = s; s = s.replace(NEU, ''); } while (s !== p);
    let tag = ''; let m;
    if ((m = s.match(/^(容易|易于|易)(有|患|得|生|发生|出|招)?(?=..)/))) { tag = '易'; s = s.slice(m[0].length); }
    else if ((m = s.match(/^(必然|必定|必|定|一定)(有|遭|主)?(?=..)/))) { tag = '必'; s = s.slice(m[0].length); }
    if ((m = s.match(/^(有|患|主)(?=..)/))) s = s.slice(1);
    s = s.replace(/(之灾|之厄|之事|事发生)$/, '');
    if (s.length >= 3 && !/[无少多灾]/.test(s.slice(-2, -1))) s = s.replace(/(症|疾|病|毛病)$/, '');
    return tag + '|' + s; }
  function palBr(d, pn) { const pm = d.palaceMap; if (pm) { for (const k in pm) if (pm[k] === pn || pm[k] === pn + '宫') return +k; }
    const O = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '奴仆', '官禄', '田宅', '福德', '父母']; const i = O.indexOf(pn); return ((d.mingGongBrIdx - i) % 12 + 12) % 12; }

  // 一组：排盘 → 匹配 → 合成 → 去重（同 gen_u.js）
  function runGroup(RC, X, d) {
    const TP = X.tps; let T0 = TP[0] + '|';
    const strictMap = X.strictMap, boxOf = X.boxOf, PARTS_OF = X.PARTS_OF;
    const syn = { map: strictMap, opposed: [] };
    const rulesOf = f => X.rules[f] || [];
    const findBox = (t, orig) => boxOf[t] || (orig || []).map(x => boxOf[x]).find(Boolean) || (PARTS_OF[t] || []).map(x => boxOf[x]).find(Boolean) || '';
    const cn = t => t.replace(/[“”"\s。]/g, '').replace(/^(亦主|又主|主|亦|也|又|有)(?=..)/, '').replace(/(之事|之灾|之厄|事发生)$/, '').replace(/(?<=..)(?<![无少])事$/, '');
    const OKI = new Set(X.OKI);
    const REPOF = p => (strictMap[T0 + p] || p).replace(/^(亦主|又主|主|亦)(?=..)/, '');
    function keyN(t) { let cl = (PARTS_OF[t] || t.replace(/。$/, '').split(/[，、]/)).map(REPOF); const m = cl[0] && cl[0].match(/^(容易|易)(有|患|得|生)?/);
      if (m) cl = cl.map((c, i) => i === 0 || /^(易|容易|必|定|不|无|多|少|或)/.test(c) ? c : m[0] + c);
      return cl.map(c => norm(c) || c); }
    function contains(A, B) { if (/^或/.test(A)) return false; A = A.replace(/([，、；])或(?=.)/g, '$1'); { const ka = keyN(A), kb = keyN(B); if (!kb.some(x => /或/.test(x)) && kb.every(x => ka.includes(x)) && (ka.length > kb.length || A !== B)) return true; } const b = cn(B); if (b.length < 2 || cn(A) === b) return false;
      for (const cl of A.split(/[，、；]/)) if (OKI.has(cl + '\t' + B) || OKI.has(cl + '\t' + B.replace(/^或/, ''))) return true;
      return false; }
    const SUP = X.SUP, INC = {}; for (const [a, b] of X.INC) (INC[a] = INC[a] || []).push(b);
    const ALIAS = {}; for (const [a, b] of X.ALIAS) ALIAS[a] = b;
    const SPLIT = {}; for (const [a, b] of X.SPLIT) SPLIT[a] = b.split('／').map(x => x.trim()).filter(Boolean);
    const lit = c => c.replace(/定/g, '必').replace(/寿夭/g, '夭寿');
    function dedupAll(ts) { const all = []; for (const t of ts) { t.L.forEach(pa => pa.segs.forEach(sg => sg.forEach(e => all.push(e)))); t.G.forEach(p => p.forEach(b => b.forEach(e => all.push(e)))); }
      const RK = new Map(); { let r = 0; for (const t of ts) t.L.forEach(pa => pa.segs.forEach(sg => sg.forEach(e => RK.set(e, r++)))); for (const t of ts) t.G.forEach(p => p.forEach(b => b.forEach(e => RK.set(e, r++)))); } const rk = e => RK.has(e) ? RK.get(e) : 1e9;
      const swapE = (P, Q) => { for (const k of ['t', 'tip', 'x']) { const v = P[k]; P[k] = Q[k]; Q[k] = v; } };
      const TW = /^(中晚年以后|中晚年后|中年以后|中年后|晚年以后|晚年后|[二三四五六]十岁(?:以)?后|中晚年|早年|幼年|少年|童年|晚年|中年|老年|年少时|幼时|成年)/;
      for (const A of all) { if (A.drop || /[，、；]/.test(A.t)) continue; const ca = cn(A.t), m = ca.match(TW); if (!m) continue; const rest = ca.slice(m[0].length);
        const B = all.find(B => B !== A && !B.drop && !/[，、；]/.test(B.t) && (cn(B.t) === rest || (norm(B.t) && norm(B.t) === norm(rest))));
        if (B) { const o = A.t; A.t = B.t + '，尤其' + m[0]; A.tip = '原话：' + o + '；' + B.t + '\n' + A.tip + '\n' + B.tip; B.drop = 1; A.x = (A.x || 1) + (B.x || 1); } }
      { const eq = (t, x) => cn(t) === cn(x); const sp = t => t.split(/([，、；])/); const hasC = (t, x) => sp(t).some((s, i) => i % 2 === 0 && eq(s, x));
        const repC = (t, x, y) => { const s = sp(t); for (let i = 0; i < s.length; i += 2) if (eq(s[i], x)) { s[i] = y; break; } return s.join(''); };
        const delC = (t, x) => { const s = sp(t); for (let i = 0; i < s.length; i += 2) if (eq(s[i], x)) { s.splice(i > 0 ? i - 1 : i, 2); break; } return s.join('').replace(/^[，、；]+|[，、；]+$/g, ''); };
        for (const [a, b, m] of X.MG) { const A = all.find(e => !e.drop && hasC(e.t, a)); if (!A) continue; const B = all.find(e => !e.drop && hasC(e === A ? delC(e.t, a) : e.t, b)); if (!B) continue;
          if (B === A) { A.t = delC(repC(A.t, a, m), b); } else { const [F, S, fc, sc] = rk(B) < rk(A) ? [B, A, b, a] : [A, B, a, b]; F.t = repC(F.t, fc, m); const r = delC(S.t, sc); if (!r || eq(S.t, sc)) { S.drop = 1; } else { S.t = r; S.tip += '\n已并入：' + sc + '（见：' + m + '）'; } F.x = (F.x || 1) + (S.x || 1); if (F !== A) { F.tip = '合并：' + a + ' ＋ ' + b + ' → ' + m + '\n' + F.tip; continue; } }
          A.tip = '合并：' + a + ' ＋ ' + b + ' → ' + m + '\n' + A.tip; } }
      for (const B0 of all) for (const A0 of all) { let A = A0, B = B0; if (A === B || A.drop || B.drop) continue; if (contains(A.t, B.t)) { if (rk(B) < rk(A)) { swapE(A, B); const T = A; A = B; B = T; A.tip += '\n（已提到前面）'; } B.drop = 1; A.x = (A.x || 1) + (B.x || 1); A.tip += '\n已含：' + B.t + '（' + B.tip.split('出处：').pop() + '）'; break; } }
      { const K = c0 => { const c = ALIAS[c0] || c0; return '~' + (norm(lit(strictMap[T0 + c] || c)) || lit(c)); };
        const ord = []; for (const t of ts) t.L.forEach(pa => pa.segs.forEach(sg => sg.forEach(e => ord.push(e)))); for (const t of ts) t.G.forEach(p => p.forEach(b => b.forEach(e => ord.push(e))));
        { const L = ord.filter(e => !e.drop && !/^或/.test(e.t)); const spl = t => t.split(/([，、；])/);
          for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const x = L[i], y = L[j]; const sx = spl(x.t), sy = spl(y.t); let done = false;
            for (let p = 0; p < sx.length && !done; p += 2) for (let q = 0; q < sy.length && !done; q += 2) { const c = sx[p], d = sy[q]; if (!c || !d || K(c) === K(d)) continue;
              if (contains(d, c) || (INC[d] || []).includes(c)) { sx[p] = d; sy[q] = c; x.t = sx.join(''); y.t = sy.join(''); x.tip += '\n（“' + d + '”从后面提到这里）'; done = true; } } } }
        const info = ord.filter(e => !e.drop).map((e, i) => { const cl = (PARTS_OF[e.t] || e.t.replace(/。$/, '').split(/[，、]/));
          return { e, i, orLed: /^或/.test(e.t), cl: cl.map(c => ({ c, k: K(c), ps: (SPLIT[c] || [c]).map(p => ({ p, k: K(p) })) })) }; });
        const coverers = info.filter(x => !x.orLed);
        const pc = (y, x, d, q, c) => d.k === c.k ? y.i < x.i : (d.k === q.k && y.i < x.i) || (INC[d.c] || []).includes(q.p) || d.ps.some(dp => dp.k === q.k && d.ps.length > 1) || d.ps.some(dp => dp.k !== q.k && contains(dp.p, q.p)) || (d.k !== q.k && contains(d.c, q.p));
        for (const x of info) { const keep = [], gone = [];
          for (const c of x.cl) { const by = c.ps.length > 1 ? (c.ps.every(q => coverers.some(y => y !== x && y.cl.some(d => !d.gone && pc(y, x, d, q, c)))) ? coverers.find(y => y !== x && y.cl.some(d => !d.gone && c.ps.some(q => pc(y, x, d, q, c)))) : null)
            : coverers.find(y => y !== x && y.cl.some(d => !d.gone && pc(y, x, d, c.ps[0], c)));
            if (by) { const d = by.cl.find(d => !d.gone && (c.ps.length > 1 ? c.ps.some(q => pc(by, x, d, q, c)) : pc(by, x, d, c.ps[0], c))) || { c: by.e.t }; c.gone = 1; c.by = by; gone.push(c.c + '（见：' + d.c + '）'); by.e.tip += '\n已含：' + c.c + '（' + x.e.tip.split('出处：').pop().split('\n')[0] + '）'; } else keep.push(c.c); }
          if (gone.length) { { const bys = [...new Set(x.cl.filter(c => c.by).map(c => c.by))]; bys.forEach(b => b.e.x = (b.e.x || 1) + 1); if (!keep.length && (x.e.x || 1) > 1) bys[0].e.x += x.e.x - 1; } if (!keep.length) { x.e.drop = 1; } else { x.e.t = keep.join('，'); } x.e.tip += '\n已省：' + gone.join('；'); } } }
      for (const t of ts) { t.L.forEach(pa => pa.segs = pa.segs.map(sg => sg.filter(e => !e.drop)).filter(sg => sg.length)); t.L = t.L.filter(pa => pa.segs.length); t.G = t.G.map(p => p.map(b => b.filter(e => !e.drop)).filter(b => b.length)).filter(p => p.length); } }
    const dlOf = {}; X.DL.forEach(([n, bs], i) => bs.forEach(b => dlOf[b] = i));
    // 排盘匹配（同 run_u.run）
    const secs = []; const ming = d.mingGongBrIdx; const main = (d.stars[ming].main || []).filter(Boolean);
    { let hits = []; const F0 = RC.extractFacts(d);
      for (const s of main) if (SR[s]) { const Fs = RC.extractFacts(d); hits = hits.concat(RC.match(rulesOf(SR[s]), Fs, s)); }
      F0.star = main.join('、');
      secs.push({ pal: '命宫', tag: (main.join('') || '无主星') + '坐命', comp: hits.length ? RC.compose(hits, F0, syn) : [] }); }
    for (const pn of Object.keys(X.PAL)) { const br = palBr(d, pn); let tgt = br, mm = (d.stars[br].main || []).filter(Boolean), bor = false;
      if (!mm.length) { tgt = (br + 6) % 12; mm = (d.stars[tgt].main || []).filter(Boolean); bor = true; }
      const F = RC.extractFacts(d, tgt, pn); const hs = RC.matchPalace(rulesOf(X.PAL[pn]), F).map(r => Object.assign({}, r, { cond: r.cond.filter(a => !/^星=/.test(a)) })); F.star = mm.join('、');
      secs.push({ pal: pn + '宫', tag: mm.join('') + (bor ? '（借对宫）' : '') + '在' + pn + '宫', comp: hs.length ? RC.compose(hs, F, syn) : [] }); }
    const tip = (e, src) => (e.orig && e.orig.length ? '同义原话：' + e.orig.join('；') + '\n' : '') + '出处：' + src;
    const out = secs.map(s => ({ pal: s.pal, tag: s.tag, topics: s.comp.filter(t => TP.includes(t.topic) && t.paras && t.paras.length).map(t => {
      const L = t.paras.filter(pa => !pa.general).map(pa => ({ c: pa.cond, segs: pa.segs.map(sg => sg.items.map(e => ({ t: e.text, x: 1, tip: tip(e, sg.src) }))) }));
      const flat = []; t.paras.filter(pa => pa.general).forEach(pa => pa.segs.forEach(sg => sg.items.forEach(e => flat.push({ t: e.text, x: 1, tip: tip(e, sg.src), box: findBox(e.text, e.orig) }))));
      const paras = []; for (const e of flat) { const k = e.box in dlOf ? dlOf[e.box] : 99; (paras[k] = paras[k] || []).push(e); }
      const G = paras.filter(Boolean).map(ps => { const order = []; const by = {}; for (const e of ps) { if (!(e.box in by)) { by[e.box] = []; order.push(e.box); } by[e.box].push(e); } return order.map(b => by[b].map(e => ({ t: e.t, x: e.x, tip: e.tip }))); });
      return { topic: t.topic, L, G }; }) }));
    if (X.iso) { for (const tp of TP) { T0 = tp + '|'; dedupAll(out.map(s => s.topics.find(t => t.topic === tp)).filter(Boolean)); } T0 = TP[0] + '|'; }
    else dedupAll(out.flatMap(s => TP.map(tp => s.topics.find(t => t.topic === tp)).filter(Boolean)));
    const mergeTip = tip => { const ls = tip.split('\n'), m = new Map(), o = []; for (const l of ls) { const k = l.match(/^已含：(.+?)（(.*)）$/); if (!k) { o.push(l); continue; } if (!m.has(k[1])) { m.set(k[1], new Set()); o.push('\u0000' + k[1]); } k[2].split('；').forEach(x => m.get(k[1]).add(x)); }
      return o.map(l => l[0] === '\u0000' ? '已含：' + l.slice(1) + '（' + [...m.get(l.slice(1))].join('；') + '）' : l).join('\n'); };
    for (const s of out) for (const t of s.topics) { t.L.forEach(pa => pa.segs.forEach(sg => sg.forEach(e => e.tip = mergeTip(e.tip)))); t.G.forEach(q => q.forEach(b => b.forEach(e => e.tip = mergeTip(e.tip)))); }
    return out;
  }
  // 全部组合成一份：按宫排，同宫各主题按 TO 顺序
  function computeAll(RC, DATA, d) {
    const secs = [];
    for (const g of GROUPS) { const X = DATA[g]; if (!X) continue;
      for (const s of runGroup(RC, X, d)) { let t = secs.find(x => x.pal === s.pal); if (!t) { t = { pal: s.pal, tag: s.tag, topics: [] }; secs.push(t); }
        for (const tp of s.topics) if ((tp.L.length || tp.G.length) && !t.topics.find(x => x.topic === tp.topic)) t.topics.push(tp); } }
    const k = p => { const i = ORD.indexOf(p.replace(/宫.*$/, '')); return i < 0 ? 99 : i; };
    secs.sort((a, b) => k(a.pal) - k(b.pal)); secs.forEach(s => s.topics.sort((a, b) => TO.indexOf(a.topic) - TO.indexOf(b.topic)));
    return secs.filter(s => s.topics.length);
  }
  const api = { GROUPS, computeAll, runGroup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Dedup = api;
})(typeof window !== 'undefined' ? window : this);
