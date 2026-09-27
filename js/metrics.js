/**
 * metrics.js —— 布局指标的**实测**实现。
 *
 * 本模块刻意不含任何手调常数式的"评分公式"。每个函数都读取浏览器真实
 * 布局结果（getBBox / getComputedTextLength / getBoundingClientRect），
 * 因此它报告的是"标签真的重叠了"，而不是"按经验大概会重叠"。
 *
 * 唯一的例外是各模块声明的硬约束阈值（最小单元格 8px、行高 22px 等），
 * 那些是可读性下限，写在 charts.js 的 MODULES 里，并在讲解中给出依据。
 */

/** 把 v 吸附到以 offset 为起点、step 为间距的最近一条网格线。 */
// #region snippet:snap
export const snap = (v, step, offset = 0) => offset + Math.round((v - offset) / step) * step;

/** v 到最近一条网格线的有符号偏差（正=偏右/偏下）。 ←→ Signed distance from v to the nearest grid line (positive = right/down). */
export const gridError = (v, step, offset = 0) => v - snap(v, step, offset);
// #endregion

/** 两个 DOMRect 风格的矩形是否相交。 */
export const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width &&
  a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * 实测轴标签碰撞数。
 *
 * 不做"按字符数估算"这类近似：直接取每个 <text> 的真实 getBBox()，
 * 按主轴排序后比较相邻两个。pad 是可接受的最小视觉间隙。
 *
 * @param {Array<SVGTextElement|{node:SVGTextElement,x:number,y:number}>} items
 *        元素数组，或带最终坐标的 {node,x,y}；有过渡时务必用后者
 * @param {'x'|'y'} axis 沿哪个轴排布
 * @returns {{count:number, pairs:Array, worst:number}} worst 为最大重叠像素数
 */
export function labelCollisions(items, axis = 'x', pad = 2) {
  // items 可以是元素数组，也可以是 {node, x, y} —— 后者用于**带过渡的场景**。
  //
  // 这一点很重要：元素正在 transition 时，属性里还是旧坐标（首次渲染时甚至是 0），
  // 此时读 getBBox().x 量到的是动画中途的位置，会报出一堆根本不存在的碰撞。
  // 所以位置由调用方按最终布局给出（那是 JS 算好的、确定的），
  // 只有**宽高**才来自实测——宽高不随过渡改变。
  const boxes = items
    .map(it => (it && it.nodeType ? { el: it, at: null } : { el: it.node, at: it }))
    .filter(o => o.el && o.el.getBBox && (o.el.textContent || '').trim() !== '')
    .map(o => {
      const b = o.el.getBBox();
      const x = o.at && o.at.x != null ? o.at.x : b.x;
      const y = o.at && o.at.y != null ? o.at.y : b.y;
      // text-anchor:middle 时，给定的 x 是中心，需换算成左边界
      const anchor = o.el.getAttribute('text-anchor');
      const left = anchor === 'middle' ? x - b.width / 2 : anchor === 'end' ? x - b.width : x;
      return { el: o.el, box: { x: left, y: y - b.height, width: b.width, height: b.height } };
    })
    .sort((a, b) => (axis === 'x' ? a.box.x - b.box.x : a.box.y - b.box.y));

  const pairs = [];
  let worst = 0;
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1].box, cur = boxes[i].box;
    const gap = axis === 'x'
      ? cur.x - (prev.x + prev.width)
      : cur.y - (prev.y + prev.height);
    if (gap < pad) {
      pairs.push({ a: boxes[i - 1].el, b: boxes[i].el, gap });
      worst = Math.max(worst, pad - gap);
    }
  }
  return { count: pairs.length, pairs, worst: Math.round(worst) };
}

/**
 * 实测每行字符数（characters per line）。
 *
 * 排版学的 45–75 字符区间是针对西文的；中文按全角字符折算，1 汉字 ≈ 2 西文字符宽，
 * 因此中文目标区间取 ~22–38 字。这里不估算字宽，而是用一个离屏 <text> 量出
 * 该字体下真实的平均字符宽度，再除以可用栏宽。
 *
 * @param {SVGTextElement} refEl 一个已挂载的同类 <text>，仅用于取样式与父节点；不会被改动
 * @param {string} sample 用于测量的样本文本
 * @param {number} columnWidth 栏宽（px）
 */
export function measureCPL(refEl, sample, columnWidth) {
  if (!refEl || !refEl.parentNode || !refEl.ownerDocument) return { cpl: 0, avgCharWidth: 0 };

  // 关键：**不要**改动传进来的元素。
  // 早期版本直接改 refEl.textContent 再改回去，结果把已排好的 <tspan> 结构
  // 抹成一个扁平文本节点，页面上会多出一行没换行的文字压在卡片外面。
  // 这里改为另起一个同类名的隐藏探针，量完即弃。
  const probe = refEl.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'text');
  const cls = refEl.getAttribute('class');
  if (cls) probe.setAttribute('class', cls);
  probe.style.visibility = 'hidden';
  refEl.parentNode.appendChild(probe);
  probe.textContent = sample;
  const total = probe.getComputedTextLength ? probe.getComputedTextLength() : 0;
  probe.remove();

  if (!total) return { cpl: 0, avgCharWidth: 0 };
  const avgCharWidth = total / Math.max(1, sample.length);
  return { cpl: Math.round(columnWidth / avgCharWidth), avgCharWidth };
}

/** 西文/中文各自的舒适阅读区间（字符数）。 */
export const CPL_RANGE = { en: [45, 75], zh: [22, 38] };
export const cplVerdict = (cpl, lang) => {
  const [lo, hi] = CPL_RANGE[lang] || CPL_RANGE.en;
  return cpl < lo ? 'narrow' : cpl > hi ? 'wide' : 'ok';
};

/**
 * 实测对齐误差：每张卡的左右边到最近列线的像素差。
 * @param {Array<{id:string,x:number,w:number}>} cards
 * @param {number[]} lines 列线的 x 坐标（由 scaleBand 给出）
 */
// #region snippet:align
export function alignmentError(cards, lines) {
  if (!lines.length) return { mean: 0, worst: null, perCard: [] };
  const nearestLine = v => lines.reduce((best, l) =>
    Math.abs(l - v) < Math.abs(best - v) ? l : best, lines[0]);

  const perCard = cards.map(c => {
    const dLeft  = c.x - nearestLine(c.x);
    const dRight = (c.x + c.w) - nearestLine(c.x + c.w);
    return { id: c.id, dLeft, dRight, worst: Math.abs(dLeft) > Math.abs(dRight) ? dLeft : dRight };
  });
  const mean = perCard.reduce((a, c) => a + Math.abs(c.worst), 0) / perCard.length;
  const worst = perCard.reduce((a, c) => Math.abs(c.worst) > Math.abs(a.worst) ? c : a, perCard[0]);
  return { mean: +mean.toFixed(1), worst, perCard };
}
// #endregion

/**
 * 实测溢出：用真实 getBBox() 判断有多少模块越出画布边界。
 * @param {SVGGraphicsElement[]} nodes
 * @param {{x:number,y:number,width:number,height:number}} frame
 */
export function overflowCount(nodes, frame) {
  const out = [];
  for (const n of nodes) {
    if (!n || !n.getBBox) continue;
    let b;
    try { b = n.getBBox(); } catch { continue; }
    const tf = n.transform && n.transform.baseVal.consolidate();
    const dx = tf ? tf.matrix.e : 0, dy = tf ? tf.matrix.f : 0;
    const r = { x: b.x + dx, y: b.y + dy, width: b.width, height: b.height };
    if (r.x < frame.x - 0.5 || r.y < frame.y - 0.5 ||
        r.x + r.width > frame.x + frame.width + 0.5 ||
        r.y + r.height > frame.y + frame.height + 0.5) {
      out.push({ node: n, id: n.dataset ? n.dataset.module : undefined, rect: r });
    }
  }
  return { count: out.length, items: out };
}

/**
 * 逐模块检查硬约束（模块自己在 charts.js 里声明 check()）。
 * @returns {{violations:Array, byModule:Object}}
 */
export function constraintViolations(modules, boxes, ctx) {
  const violations = [];
  const byModule = {};
  for (const box of boxes) {
    const mod = modules[box.id];
    if (!mod || !mod.check) continue;
    const found = mod.check(box, ctx) || [];
    byModule[box.id] = found;
    for (const v of found) violations.push({ module: box.id, ...v });
  }
  return { violations, byModule };
}

/**
 * 把各项实测结果汇总成一张"布局体检卡"。
 *
 * 保留旧版 labMetrics() 的结构优点——分项 + 指出下一步该修什么——
 * 但每一项都来自实测，而非手调常数。故意不合成单一总分：
 * 四个指标量纲不同，加权求和只会制造一个没有含义的数字。
 */
export function healthCard({ collisions, alignment, cpl, overflow, violations }, lang = 'zh') {
  const t = (zh, en) => (lang === 'zh' ? zh : en);
  const items = [
    { id: 'collisions', label: t('轴标签碰撞', 'Label collisions'), value: collisions,
      unit: t(' 处', ''), ok: collisions === 0,
      hint: t('主图不够宽，坐标轴标签已经互相压住。', 'The main chart is too narrow — axis labels now overlap.') },
    { id: 'alignment', label: t('对齐误差均值', 'Mean alignment error'), value: alignment, unit: 'px',
      ok: alignment <= 2,
      hint: t('卡片边缘没有落在共享列线上。', 'Card edges are not landing on the shared column lines.') },
    { id: 'cpl', label: t('每行字符数', 'Characters per line'), value: cpl, unit: '',
      ok: cplVerdict(cpl, lang) === 'ok',
      hint: cplVerdict(cpl, lang) === 'wide'
        ? t('文本栏过宽，换行时容易串行。', 'The text column is too wide; the eye loses the line on return.')
        : t('文本栏过窄，换行过于频繁。', 'The text column is too narrow; the eye returns too often.') },
    { id: 'overflow', label: t('越界模块', 'Overflowing modules'), value: overflow,
      unit: t(' 个', ''), ok: overflow === 0,
      hint: t('有模块越出了画布边界。', 'Some modules extend past the canvas edge.') },
    { id: 'violations', label: t('约束违反', 'Constraint violations'), value: violations.length,
      unit: t(' 项', ''), ok: violations.length === 0,
      hint: violations.length
        ? t(`最紧的一项：${violations[0].zh}`, `Tightest: ${violations[0].en}`)
        : t('所有模块都在各自的可读下限之上。', 'Every module is above its own legibility floor.') }
  ];
  const failing = items.filter(i => !i.ok);
  return {
    items,
    passing: failing.length === 0,
    /** 明确告诉学习者"下一步修哪一项"，而不是给一个分数。 */
    next: failing.length ? failing[0] : null
  };
}
