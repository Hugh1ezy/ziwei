// 条件＋结论 规则匹配与成文（试点：紫微在命宫）
// 只做三件事：①按条件匹配规则 ②同一结论（含同义说法）跨书合并、标注来源 ③按主题、按条件分组拼句。
// 不生成任何书外内容：每一个结论都取自规则表的"结论"列（原书措辞拆成的最小单位），
// 程序只加"：""；""。"和描述本盘事实的条件说明。
(function (root) {
  const BR = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const CS_NAMES = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
  const JU_NAME = {2:'水二局',3:'木三局',4:'金四局',5:'土五局',6:'火六局'};

  // ---- 条件词表中的星组（定义及出处见 conditions.md） ----
  const GROUPS = {
    // 精成："红、喜、贪、姚、咸、沐浴等桃花星"（贪狼为同宫主星，此处不计）
    '桃花': ['红鸾','天喜','天姚','咸池','沐浴'],
  };
  const LIUJI = ['左辅','右弼','文昌','文曲','天魁','天钺']; // 字全书：吉星代表左辅右弼天魁天钺文昌文曲
  const SISHA = ['擎羊','陀罗','火星','铃星'];                 // 字全书：凶徒代表擎羊陀罗火星铃星
  const LIUSHA = [...SISHA, '地空', '地劫'];
  // 精成："百官朝拱"对星：府相、左右、昌曲、魁钺、日月、禄马
  const PAIRS = {
    '府相': ['天府','天相'], '左右': ['左辅','右弼'], '昌曲': ['文昌','文曲'],
    '魁钺': ['天魁','天钺'], '日月': ['太阳','太阴'], '禄马': ['禄存','天马'],
  };
  const RUMIAO = ['午','丑','未']; // 全书卷二：午宫入庙、丑未宫入庙

  const TOPIC_ORDER = ['格局','性格','才能','事业','财富','容貌','婚姻','健康','僧道'];
  const TOPIC_RE = /^(格局|性格|才能|事业|财富|容貌|婚姻|健康|僧道):(.+)$/;

  // ---------- 解析规则表、同义表 ----------
  function parseRules(text) {
    const rules = [];
    for (const line of text.split(/\r?\n/)) {
      if (!/^Z\d+[a-z]?\|/.test(line)) continue;
      const [id, cond, topic, concl, quote, src] = line.split('|');
      const items = concl.split('／').map(c => {
        const m = c.match(TOPIC_RE);
        return m ? { topic: m[1], text: m[2] } : { topic, text: c };
      });
      rules.push({ id, cond: cond === '—' ? [] : cond.split('＆'), topic, items, quote, src });
    }
    return rules;
  }
  function parseSynonyms(text) {
    const map = {}, opposed = [];
    for (const line of (text || '').split(/\r?\n/)) {
      if (/^#/.test(line) || !line.trim()) continue;
      let m;
      if ((m = line.match(/^!相反\s+(.+?)\s*<>\s*(.+)$/))) { opposed.push([m[1].trim(), m[2].trim()]); continue; }
      if ((m = line.match(/^(.+?)\s*=\s*(.+)$/))) for (const v of m[2].split('／')) map[v.trim()] = m[1].trim();
    }
    return { map, opposed };
  }

  // ---------- 从命盘数据取事实 ----------
  // data：index.html 中 renderChart(data) 收到的对象
  function extractFacts(data) {
    const m = data.mingGongBrIdx;
    const at = i => { const p = data.stars[((i % 12) + 12) % 12]; return [...p.main, ...p.aux]; };
    const sf = [m, m + 4, m + 8, m + 6].map(i => ((i % 12) + 12) % 12); // 三方四正
    const jia = [m - 1, m + 1].map(i => ((i % 12) + 12) % 12);           // 左右邻宫
    return {
      ming: m, sf, jia, at, branch: BR[m],
      stem: STEMS[data.yearStemIdx], yearBr: BR[data.yearBrIdx],
      gender: data.gender === 'female' ? '女' : '男',
      ju: data.ju, shen: data.shenGongBrIdx,
      sihua: data.sihua || {},
    };
  }

  const expand = list => list.flatMap(s => GROUPS[s] || [s]);
  const inPalaces = (F, idxs, star) => idxs.some(i => F.at(i).includes(star));
  const countSF = (F, list) => F.sf.reduce((n, i) => n + list.filter(s => F.at(i).includes(s)).length, 0);

  // ---------- 原子条件求值 ----------
  function evalAtom(F, atom) {
    let mm;
    if ((mm = atom.match(/^支=(.+)$/)))   return mm[1].split('/').includes(F.branch);
    if ((mm = atom.match(/^干=(.+)$/)))   return mm[1].split('/').includes(F.stem);
    if ((mm = atom.match(/^支年=(.+)$/))) return mm[1].split('/').includes(F.yearBr);
    if ((mm = atom.match(/^性别=(.+)$/))) return mm[1] === F.gender;
    if ((mm = atom.match(/^局=(.+)$/)))   return mm[1].split('/').map(Number).includes(F.ju);
    if ((mm = atom.match(/^长生=(.+)$/))) return mm[1].split('/').some(s => F.at(F.ming).includes(s));
    if ((mm = atom.match(/^同宫:(.+)$/))) return expand(mm[1].split('/')).some(s => inPalaces(F, [F.ming], s));
    if ((mm = atom.match(/^会:(.+)$/)))   return expand(mm[1].split('/')).some(s => inPalaces(F, F.sf, s));
    if ((mm = atom.match(/^不会:(.+)$/))) return !expand(mm[1].split('/')).some(s => inPalaces(F, F.sf, s));
    if ((mm = atom.match(/^夹:(.+)$/)))   return expand(mm[1].split('/')).some(s => inPalaces(F, F.jia, s));
    if ((mm = atom.match(/^对:(.+)$/)))   return pairOK(F, PAIRS[mm[1]]);
    if ((mm = atom.match(/^夹对:(.+)$/))) {
      const [a, b] = PAIRS[mm[1]];
      const [l, r] = F.jia;
      return (F.at(l).includes(a) && F.at(r).includes(b)) || (F.at(l).includes(b) && F.at(r).includes(a));
    }
    if ((mm = atom.match(/^身宫有:(.+)$/))) return mm[1].split('/').some(s => F.at(F.shen).includes(s));
    if ((mm = atom.match(/^化:(.+)=(.+)$/))) return mm[2].split('/').some(h => F.sihua[h] === mm[1]);
    switch (atom) {
      case '百官':   return Object.values(PAIRS).some(p => pairOK(F, p));
      case '非百官': return !Object.values(PAIRS).some(p => pairOK(F, p));
      case '吉':     return LIUJI.some(s => inPalaces(F, F.sf, s));
      case '无吉':   return !LIUJI.some(s => inPalaces(F, F.sf, s));
      case '煞':     return SISHA.some(s => inPalaces(F, F.sf, s));
      case '无煞':   return !SISHA.some(s => inPalaces(F, F.sf, s));
      case '四煞并见':
        return ['擎羊','陀罗'].some(s => inPalaces(F, F.sf, s)) && ['火星','铃星'].some(s => inPalaces(F, F.sf, s));
      case '三奇':
        return ['禄','权','科'].every(h => F.sihua[h] && inPalaces(F, F.sf, F.sihua[h]));
      // 用户定的门槛（2026-10-22）：吉多＝六吉＋化禄权科≥4；煞多＝羊陀火铃空劫≥3，煞少＝1–2
      case '吉多':   return countSF(F, LIUJI) + ['禄','权','科'].filter(h => F.sihua[h] && inPalaces(F, F.sf, F.sihua[h])).length >= 4;
      case '煞多':   return countSF(F, LIUSHA) >= 3;
      case '煞少':   { const n = countSF(F, LIUSHA); return n >= 1 && n <= 2; }
      // 用户定：左右、昌曲、魁钺三组各见至少一颗
      case '君臣庆会':
        return [['左辅','右弼'],['文昌','文曲'],['天魁','天钺']].every(g => g.some(s => inPalaces(F, F.sf, s)));
      case '无化忌': return !(F.sihua['忌'] && inPalaces(F, F.sf, F.sihua['忌']));
      case '入庙':   return RUMIAO.includes(F.branch);
      case '禄马交驰': { // 字陆·评注：禄存天马同度本宫或对宫，或一居本宫一居对宫
        const two = [F.ming, (F.ming + 6) % 12];
        return inPalaces(F, two, '禄存') && inPalaces(F, two, '天马');
      }
    }
    throw new Error('未知条件：' + atom);
  }
  // 对星：两颗都在三方四正或左右邻宫（精成"守照会拱或在左右邻宫相夹"）
  function pairOK(F, [a, b]) {
    const idx = [...F.sf, ...F.jia];
    return inPalaces(F, idx, a) && inPalaces(F, idx, b);
  }

  function match(rules, F) {
    if (!F.at(F.ming).includes('紫微')) return [];
    return rules.filter(r => r.cond.every(a => evalAtom(F, a)));
  }

  // ---------- 条件说成人话（只描述本盘事实） ----------
  function label(F, cond) {
    const list = x => expand(x.split('/')).join('、');
    const present = arr => expand(arr).filter(s => inPalaces(F, F.sf, s)).join('、');
    const part = cond.map(a => {
      let m;
      if (/^支=/.test(a))   return '紫微在' + F.branch;
      if (/^干=/.test(a))   return F.stem + '年生';
      if (/^支年=/.test(a)) return F.yearBr + '年生';
      if ((m = a.match(/^性别=(.+)/))) return m[1] + '命';
      if (/^局=/.test(a))   return JU_NAME[F.ju];
      if (/^长生=/.test(a)) return '命宫逢' + CS_NAMES.find(s => F.at(F.ming).includes(s));
      if ((m = a.match(/^同宫:(.+)/))) return expand(m[1].split('/')).filter(s => F.at(F.ming).includes(s)).join('、') + '同宫';
      if ((m = a.match(/^会:(.+)/)))   return '三方四正见' + present(m[1].split('/'));
      if ((m = a.match(/^不会:(.+)/))) return '三方四正无' + list(m[1]);
      if ((m = a.match(/^夹:(.+)/)))   return list(m[1]) + '夹命';
      if ((m = a.match(/^对:(.+)/)))   return m[1] + '成对会照';
      if ((m = a.match(/^夹对:(.+)/))) return m[1] + '夹命';
      if ((m = a.match(/^身宫有:(.+)/))) return '身宫有' + m[1];
      if ((m = a.match(/^化:(.+)=(.+)/))) return m[1] + '化' + m[2].split('/').find(h => F.sihua[h] === m[1]);
      if (a === '吉') return '三方四正见' + present(LIUJI);
      if (a === '煞') return '三方四正见' + present(SISHA);
      return { '百官': '得百官朝拱（精成定义）', '非百官': '无百官朝拱（精成定义）', '吉': '三方四正见六吉',
        '无吉': '三方四正无六吉', '煞': '三方四正见四煞', '无煞': '三方四正无四煞', '四煞并见': '羊陀与火铃并见',
        '三奇': '科权禄三方会齐', '吉多': '吉多（本盘' + jiCount(F) + '颗，门槛4颗）',
        '煞多': '煞多（本盘' + countSF(F, LIUSHA) + '颗，门槛3颗）', '煞少': '煞少（本盘' + countSF(F, LIUSHA) + '颗）', '君臣庆会': '君臣庆会（左右、昌曲、魁钺各见一颗以上）', '入庙': '入庙', '禄马交驰': '禄马交驰', '无化忌': '三方四正无化忌' }[a] || a;
    });
    return part.length ? part.join('，') : '通论';
  }

  // ---------- 成文 ----------
  // 同一结论（含同义）跨书合并并列出全部来源；同一主题内按条件分组，通论在前
  function compose(hits, F, syn) {
    syn = syn || { map: {}, opposed: [] };
    const canon = t => syn.map[t] || t;
    const entries = new Map();
    for (const r of hits) for (const it of r.items) {
      // 不同书把同一结论归在不同主题时只列一次，主题取条件最少的那条规则
      const k = canon(it.text);
      if (!entries.has(k)) entries.set(k, { topic: it.topic, n: r.cond.length, text: k, rules: [] });
      const e = entries.get(k);
      if (r.cond.length < e.n) { e.topic = it.topic; e.n = r.cond.length; }
      e.rules.push(r);
    }
    // 相反说法：就地标注在后出现的一方，不再另列
    const all = [...entries.values()];
    for (const [a, b] of syn.opposed) {
      const ea = all.find(e => e.text === a), eb = all.find(e => e.text === b);
      if (ea && eb) eb.note = '（※与"' + a + '"说法相反）';
    }
    const out = [];
    // 精成以任一对百官为准，全书等以有无左右为准：标准宽严不同
    if (hits.some(h => h.cond.includes('百官')) && all.some(e => e.text === '孤君'))
      out.push({ topic: '提示', general: [], paras: [], lines: ['本盘按精成的标准（府相、左右、昌曲、魁钺、日月、禄马任见一对）算得百官朝拱；按全书等较严的标准（以左辅右弼为核心，无左右即为孤君）则为孤君。两者是标准宽严不同，并非矛盾，两说并列。'] });
    for (const topic of TOPIC_ORDER) {
      const es = all.filter(e => e.topic === topic);
      if (!es.length) continue;
      // 同一结论在不同条件下都出现：只列在条件最少的那一组，其余书的来源后注明条件
      const groups = new Map();
      for (const e of es) {
        const byLb = new Map();
        for (const r of e.rules) {
          const lb = label(F, r.cond);
          if (!byLb.has(lb)) byLb.set(lb, { n: r.cond.length, rules: [] });
          byLb.get(lb).rules.push(r);
        }
        const parts = [...byLb.entries()].sort((a, b) => a[1].n - b[1].n);
        const sset = rs => [...new Set(rs.map(r => r.src))].join('、');
        // 通论（无附加条件）各盘相同，单独成条；有条件的说法另合一条
        const segs = parts[0][1].n === 0 && parts.length > 1 ? [parts.slice(0, 1), parts.slice(1)] : [parts];
        for (const seg of segs) {
          const [lb, g0] = seg[0];
          const dup = segs.length > 1 && seg !== segs[0];
          const it = { text: e.text, dup, note: e.note,
            srcText: [sset(g0.rules), ...seg.slice(1).map(([l, g]) => sset(g.rules) + '（' + l + '时）')].join('；') };
          if (!groups.has(lb)) groups.set(lb, { n: g0.n, items: [] });
          groups.get(lb).items.push(it);
        }
      }
      // paras：结构化结果（网页用，来源和条件可折叠）；general/lines：同内容的纯文字版
      const paras = [];
      for (const [lb, g] of [...groups.entries()].sort((a, b) => a[1].n - b[1].n)) {
        // 同一组来源的结论连写，来源只标一次
        const bySrc = new Map();
        for (const e of g.items) { const k = e.srcText; if (!bySrc.has(k)) bySrc.set(k, []); bySrc.get(k).push(e); }
        paras.push({ cond: lb, general: g.n === 0,
          segs: [...bySrc.entries()].map(([src, list]) => ({ src, items: list })) });
      }
      const flat = e => e.text + (e.dup ? '（通论亦有）' : '') + (e.note || '');
      const general = [], lines = [];
      for (const pa of paras) {
        const body = pa.segs.map(sg => sg.items.map(flat).join('、') + '〔' + sg.src + '〕').join('；') + '。';
        (pa.general ? general : lines).push(pa.cond + '：' + body);
      }
      out.push({ topic, general, lines, paras });
    }
    return out;
  }

  // ---------- 网页显示：只露结论，来源（每段短语后）和条件（整段末）折成小角标，点开才显示 ----------
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 出处：有出处的短语下加虚线，点短语看出处；条件：每段前的"·"，点它看条件
  const tipAttr = tip => ' tabindex="0" role="button" data-tip="' + esc(tip) + '"';
  function paraHTML(pa, hint) {
    const body = pa.segs.map(sg => {
      const extra = sg.items.filter(e => e.dup).length ? '；凡紫微坐命，通论亦有此说' : '';
      const notes = sg.items.filter(e => e.note).map(e => e.text + e.note).join('；');
      return '<span class="rc-fold rc-src"' + tipAttr('出处：' + sg.src + extra + (notes ? '。' + notes : '')) + '>' +
        sg.items.map(e => esc(e.text)).join('、') + '</span>';
    }).join('；');
    const cond = '条件：' + (pa.general ? '凡紫微坐命皆是（通论）' : pa.cond) +
      (hint && /百官|左辅、右弼/.test(pa.cond) ? '。' + hint : '');
    return '<p class="rc-para"><span class="rc-fold rc-cond"' + tipAttr(cond) + '>·</span>' + body + '。</p>';
  }
  function renderHTML(comp, opts) {
    opts = opts || {};
    const hint = (comp.find(t => t.topic === '提示') || { lines: [] }).lines[0];
    return comp.filter(t => t.paras && t.paras.length).map(t => {
      const ps = t.paras.filter(pa => opts.only === 'general' ? pa.general : opts.only === 'lines' ? !pa.general : true);
      return ps.length ? '<div class="rc-topic"><h4>' + esc(t.topic) + '</h4>' + ps.map(pa => paraHTML(pa, hint)).join('') + '</div>' : '';
    }).join('');
  }

  const jiCount = F => countSF(F, LIUJI) + ['禄','权','科'].filter(h => F.sihua[h] && inPalaces(F, F.sf, F.sihua[h])).length;

  const api = { parseRules, parseSynonyms, extractFacts, match, compose, renderHTML, evalAtom, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RuleComposer = api;
})(this);
