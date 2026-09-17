/**
 * charts.js —— Campus Pulse 看板的六个真实模块。
 *
 * 设计要点（这决定了整门课能不能成立）：
 *
 * 1. 每个模块都是真实的 D3 图表，读真实数据。把栏宽调窄，后果不是"扣分"，
 *    而是坐标轴标签**真的**重叠、热力图单元格**真的**糊掉。布局理论因此有了
 *    可观测的后果。
 *
 * 2. 每个模块自己声明**硬约束**（min.w / min.h / aspect），并实现 check()。
 *    布局冲突由内容自己提出，不由老师规定——这正是布局课要教的东西。
 *
 * 3. 全部使用带 key 的 data-join + transition，**没有任何 selectAll('*').remove()**。
 *    课程第 5-1 节要教"对象连续性"，实现就必须自己做到。
 *
 * 4. 贯穿全课的主线：**页面布局和图表布局是同一套数学。**
 *    下面每个图表都用 Bostock 的 margin convention 划出绘图区，
 *    那就是页面的 container/padding；heat 与 ranking 用 scaleBand 排布，
 *    它的 paddingInner 就是栅格的 gutter。见 gridBand()。
 */

import d3 from './d3.js';
import { labelCollisions, measureCPL, cplVerdict } from './metrics.js';

/* ── 可视化配色 ───────────────────────────────────────────────────────────
 * 经 dataviz 校验器在本站白色卡片表面（#ffffff）上验证通过：
 *   亮度带 PASS · 彩度下限 PASS · 色觉障碍分离 dE 9.2 PASS · 常视分离 dE 24.0 PASS
 *   aqua 对比度 2.82 < 3:1 → 触发"直接标注"补偿规则，故 devices 各段必须带标签。
 * 这一套是**数据色**，与各章的 UI 主题色（--accent）是两套东西，不可混用：
 * 数据色跟随实体，不跟随章节。
 */
export const VIZ = {
  series: ['#2a78d6', '#eb6834', '#1baf7a'],
  ramp: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
         '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'],
  ink: '#0b0b0b', inkSoft: '#52514e', muted: '#898781',
  grid: '#e1e0d9', axis: '#c3c2b7', surface: '#ffffff',
  good: '#0ca30c', critical: '#d03b3b'
};

const T = (ctx) => ctx.reduced ? null : d3.transition().duration(ctx.t ?? 420).ease(d3.easeCubicInOut);
/** 在 selection 上应用过渡；reduced-motion 下直接返回原 selection。 */
const tr = (sel, ctx) => { const t = T(ctx); return t ? sel.transition(t) : sel; };
const L = (o, ctx) => (o == null ? '' : typeof o === 'string' ? o : o[ctx.lang] ?? o.zh);

/* ── margin convention ──────────────────────────────────────────────────── */
// #region snippet:margin
/**
 * Bostock 的 margin convention：先从外框里减掉四边留白，得到绘图区，
 * 之后所有比例尺只在绘图区内工作，坐标轴画在留白里。
 *
 * 这和页面布局的 container + padding 是**同一件事**——
 * 这也是本课的主线：图表布局与页面布局共用一套数学。
 */
export function plotArea(box, margin) {
  const m = { top: 0, right: 0, bottom: 0, left: 0, ...margin };
  return {
    ...m,
    width:  Math.max(0, box.w - m.left - m.right),
    height: Math.max(0, box.h - m.top - m.bottom)
  };
}
// #endregion

// #region snippet:band
/**
 * 栅格 = scaleBand。 ←→ A page grid IS a band scale.
 *
 * scaleBand 的 paddingInner **就是**栅格系统里的 gutter（列间距）， ←→ scaleBand's paddingInner IS the gutter of a grid system;
 * step() 就是列距，bandwidth() 就是列宽。页面栅格不需要另一套数学， ←→ step() is the column pitch and bandwidth() the column width. A page grid needs no separate maths —
 * 它本来就是一维 band scale。 ←→ it already is a one-dimensional band scale.
 */
export function gridBand(columns, width, { margin = 24, gutter = 24 } = {}) {
  const inner = Math.max(0, width - margin * 2);
  const band = d3.scaleBand()
    .domain(d3.range(columns))
    .range([margin, margin + inner])
    // paddingInner 以"占 step 的比例"表达 gutter，故由像素反算 ←→ paddingInner expresses the gutter as a fraction of step, so derive it from pixels
    .paddingInner(columns > 1 ? (gutter * columns) / (inner + gutter) : 0);
  /** 全部列线（含容器左右边），供对齐误差实测使用 ←→ every column edge (including the container's), used to measure alignment error */
  band.lines = d3.range(columns).flatMap(i => [band(i), band(i) + band.bandwidth()]);
  /** 跨 n 列的宽度：n 个列宽 + (n-1) 个 gutter ←→ width of an n-column span: n column widths + (n-1) gutters */
  band.spanWidth = (n) => band.bandwidth() * n + (band.step() - band.bandwidth()) * (n - 1);
  return band;
}
// #endregion

/* ── 卡片外壳 ───────────────────────────────────────────────────────────── */
/** 画卡片底板与标题，返回内容区的 <g>（已按内边距平移）。全程 keyed join。 */
function shell(g, box, ctx, { pad = 12, titleH = 26 } = {}) {
  const title = L(MODULES[box.id].title, ctx);

  tr(g.selectAll('rect.mod-bg').data([box.id], d => d)
      .join(en => en.insert('rect', ':first-child').attr('class', 'mod-bg').attr('rx', 8)
                    .attr('x', 0).attr('y', 0)
                    // 同理：底板进入时就用最终尺寸，不从 0x0 长出来
                    .attr('width', box.w).attr('height', box.h)), ctx)
    .attr('width', box.w).attr('height', box.h);
  g.select('rect.mod-bg').classed('is-main', !!box.main);

  g.selectAll('text.mod-title').data([title], d => d)
    .join(en => en.append('text').attr('class', 'mod-title').attr('x', pad).attr('y', 18))
    .text(d => d);

  const inner = g.selectAll('g.mod-body').data([box.id], d => d)
    .join(en => en.append('g').attr('class', 'mod-body'))
    .attr('transform', `translate(${pad},${titleH})`);

  return { inner, w: Math.max(0, box.w - pad * 2), h: Math.max(0, box.h - titleH - pad) };
}

/* ── 1. 每周活跃趋势 ────────────────────────────────────────────────────── */
// #region snippet:trend
function renderTrend(g, box, ctx) {
  const { inner, w, h } = shell(g, box, ctx);
  const weeks = ctx.data.weeks;
  const totals = weeks.map((wk, i) => ({
    week: wk, value: d3.sum(ctx.data.courses, c => c.active[i])
  }));

  // #region snippet:trend-scale
  // margin convention 划出绘图区，比例尺只在绘图区内工作。 ←→ The margin convention carves out the plot area; the scales work only inside it.
  // 这四行与页面布局里的 container + padding 是同一件事。 ←→ These four lines are the same thing as a page's container + padding.
  const p = plotArea({ w, h }, { top: 6, right: 8, bottom: 20, left: 34 });
  const x = d3.scaleLinear().domain(d3.extent(weeks)).range([p.left, p.left + p.width]);
  const y = d3.scaleLinear().domain([0, d3.max(totals, d => d.value)]).nice()
              .range([p.top + p.height, p.top]);
  // #endregion

  const area = d3.area().x(d => x(d.week)).y0(y(0)).y1(d => y(d.value)).curve(d3.curveMonotoneX);
  const line = d3.line().x(d => x(d.week)).y(d => y(d.value)).curve(d3.curveMonotoneX);

  tr(inner.selectAll('path.trend-area').data([totals])
       .join(en => en.append('path').attr('class', 'trend-area').attr('fill', VIZ.series[0])
                     .attr('fill-opacity', 0.12)), ctx)
    .attr('d', area);
  tr(inner.selectAll('path.trend-line').data([totals])
       .join(en => en.append('path').attr('class', 'trend-line').attr('fill', 'none')
                     .attr('stroke', VIZ.series[0]).attr('stroke-width', 2)
                     .attr('stroke-linejoin', 'round')), ctx)
    .attr('d', line);

  const yTicks = y.ticks(3);
  tr(inner.selectAll('line.gridline').data(yTicks, d => d)
       .join(en => en.append('line').attr('class', 'gridline').attr('stroke', VIZ.grid)), ctx)
    .attr('x1', p.left).attr('x2', p.left + p.width).attr('y1', d => y(d)).attr('y2', d => y(d));

  // #region snippet:trend-join
  // 12 个周标签全部保留——正因为不抽稀，栏宽变窄时才会真的发生碰撞， ←→ Keep all 12 week labels: precisely because none are thinned out, a narrow column really does cause collisions,
  // check() 随后用 getBBox() 把碰撞量出来。这是"实测"而非"估算"的关键。 ←→ which check() then measures with getBBox(). That is what makes this measurement rather than estimation.
  //
  // 数据键用 d.week：同一周永远是同一个 <text> 节点， ←→ The key is d.week, so a given week is always the same <text> node;
  // 于是尺寸变化时标签是平移过去的，不是被销毁重建的。 ←→ on resize the label slides across instead of being destroyed and rebuilt.
  const ticks = inner.selectAll('text.tick-x').data(totals, d => d.week)
    .join(en => en.append('text').attr('class', 'tick-x').attr('text-anchor', 'middle'));
  ticks.text(d => (ctx.lang === 'zh' ? `${d.week}周` : `W${d.week}`));
  tr(ticks, ctx).attr('x', d => x(d.week)).attr('y', p.top + p.height + 14);
  // #endregion

  const yl = inner.selectAll('text.tick-y').data(yTicks, d => d)
    .join(en => en.append('text').attr('class', 'tick-y').attr('text-anchor', 'end'));
  yl.text(d => d3.format('.2~s')(d));
  tr(yl, ctx).attr('x', p.left - 6).attr('y', d => y(d) + 4);

  const peak = totals.reduce((a, b) => (b.value > a.value ? b : a));
  tr(inner.selectAll('circle.peak').data([peak], d => d.week)
       .join(en => en.append('circle').attr('class', 'peak').attr('r', 4)
                     .attr('fill', VIZ.series[0]).attr('stroke', VIZ.surface).attr('stroke-width', 2)), ctx)
    .attr('cx', x(peak.week)).attr('cy', y(peak.value));

  // 供 check() 做真实碰撞检测。
  // 连同**最终** x 一起存：过渡期间元素属性上还是旧值，只能靠这里给定位置。
  g.node().__ticks = ticks.nodes().map((node, i) => ({
    node, x: x(totals[i].week), y: p.top + p.height + 14
  }));
}
// #endregion

/* ── 2. 学习时段热力图 ──────────────────────────────────────────────────── */
// #region snippet:heat
function renderHeat(g, box, ctx) {
  const { inner, w, h } = shell(g, box, ctx);
  const { days, slots, heat } = ctx.data;

  // #region snippet:heat-band
  const p = plotArea({ w, h }, { top: 4, right: 4, bottom: 14, left: 30 });
  // 两个方向都用 scaleBand：热力图就是二维栅格，和页面栅格同源。
  // bandwidth() 就是单元格边长——模块的硬约束（>= 8px）直接读它。
  const x = d3.scaleBand().domain(d3.range(slots.length)).range([p.left, p.left + p.width]).padding(0.06);
  const y = d3.scaleBand().domain(d3.range(days.length)).range([p.top, p.top + p.height]).padding(0.06);
  // #endregion
  const color = d3.scaleSequential(d3.interpolateRgbBasis(VIZ.ramp))
                  .domain([0, d3.max(heat.flat())]);

  const cells = heat.flatMap((row, di) => row.map((v, si) => ({ id: `${di}-${si}`, di, si, v })));
  tr(inner.selectAll('rect.cell').data(cells, d => d.id)
       .join(en => en.append('rect').attr('class', 'cell').attr('rx', 1)), ctx)
    .attr('x', d => x(d.si)).attr('y', d => y(d.di))
    .attr('width', x.bandwidth()).attr('height', y.bandwidth())
    .attr('fill', d => color(d.v));

  const dayLabels = inner.selectAll('text.heat-day').data(days, d => d.id)
    .join(en => en.append('text').attr('class', 'heat-day tick-y').attr('text-anchor', 'end'));
  dayLabels.text(d => L(d, ctx));
  tr(dayLabels, ctx).attr('x', p.left - 5).attr('y', (d, i) => y(i) + y.bandwidth() / 2 + 3);

  // 时段标签按可用宽度抽稀——间隔由 bandwidth 决定，不是写死的
  const every = Math.max(1, Math.ceil(34 / Math.max(1, x.step())));
  const slotLabels = inner.selectAll('text.heat-slot')
    .data(slots.filter((_, i) => i % every === 0), d => d)
    .join(en => en.append('text').attr('class', 'heat-slot tick-x').attr('text-anchor', 'middle'));
  slotLabels.text(d => d.slice(0, 2));
  tr(slotLabels, ctx)
    .attr('x', d => x(slots.indexOf(d)) + x.bandwidth() / 2)
    .attr('y', p.top + p.height + 11);

  g.node().__cell = { w: x.bandwidth(), h: y.bandwidth() };
}
// #endregion

/* ── 3. 课程排行 ────────────────────────────────────────────────────────── */
// #region snippet:rank-minheight
/**
 * 排行榜的几何常量，渲染与约束**共用同一份**。
 *
 * min.h 不手算：由 scaleBand.step() 的公式反推。
 *   step = 跨度 / (n - paddingInner + 2 x paddingOuter)
 * d3 的 .padding(p) 会同时设置 inner 与 outer，所以分母是 n - p + 2p = n + p，
 * 不是 n。早期按 n 手算，得到的 min.h 偏小，模块自己的两条约束互相矛盾——
 * 高度给到声明的上限，行高仍然差 0.6px 不达标。
 */
const RANK = { rows: 8, minRow: 22, padding: 0.22, padTop: 2, padBottom: 2, titleH: 26, padY: 12 };
const rankingMinHeight = () => Math.ceil(
  RANK.minRow * (RANK.rows + RANK.padding)     // scaleBand 跨度的逆运算
  + RANK.padTop + RANK.padBottom               // plotArea 上下留白
  + RANK.titleH + RANK.padY                    // shell 标题栏与下内边距
);
// #endregion

// #region snippet:ranking
function renderRanking(g, box, ctx) {
  const { inner, w, h } = shell(g, box, ctx);

  // 排序本身就是一个布局决策，而且是**能被计时量出来的**那种：
  // 按指标排好序时，"最低的一门"就在末尾，一眼可得；
  // 保持任意顺序（乱稿的常态）时，必须逐行比较 8 个数字。
  // 第 1 章的限时任务测的正是这个差别，所以它必须可切换。
  const byId = Object.fromEntries(ctx.data.courses.map(c => [c.id, c]));
  const rows = ctx.rankSorted === false
    ? ctx.data.entryOrder.map(id => byId[id])          // 教务系统的录入顺序：与完成率无关
    : [...ctx.data.courses].sort((a, b) => b.completion - a.completion);

  const p = plotArea({ w, h }, { top: RANK.padTop, right: 36, bottom: RANK.padBottom, left: 0 });
  // scaleBand 的 step() 就是行高；行高不足时课程名会被压住——这就是本模块的硬约束
  // #region snippet:rank-band
  // scaleBand 的 step() 就是行高：行高不足时课程名会被压住。
  // 硬约束因此不是拍脑袋定的数字，而是从 band scale 上直接读出来的量。
  const y = d3.scaleBand().domain(rows.map(d => d.id)).range([p.top, p.top + p.height]).padding(RANK.padding);
  // #endregion
  const labelW = Math.min(96, Math.max(48, w * 0.42));
  const x = d3.scaleLinear().domain([0, 1]).range([p.left + labelW, p.left + p.width]);

  const row = inner.selectAll('g.rank-row').data(rows, d => d.id)
    .join(en => {
      const gg = en.append('g').attr('class', 'rank-row');
      gg.append('rect').attr('class', 'rank-track').attr('rx', 3).attr('fill', VIZ.grid);
      gg.append('rect').attr('class', 'rank-bar').attr('rx', 3);
      gg.append('text').attr('class', 'rank-name').attr('text-anchor', 'end');
      gg.append('text').attr('class', 'rank-value');
      return gg;
    });
  tr(row, ctx).attr('transform', d => `translate(0,${y(d.id)})`);

  const bh = y.bandwidth();
  row.select('text.rank-name').attr('x', labelW - 8).attr('y', bh / 2 + 4).text(d => L(d, ctx));
  row.select('rect.rank-track').attr('x', x(0)).attr('y', 0).attr('height', bh).attr('width', x(1) - x(0));
  tr(row.select('rect.rank-bar'), ctx)
    .attr('x', x(0)).attr('y', 0).attr('height', bh)
    .attr('width', d => Math.max(0, x(d.completion) - x(0)))
    // 把最低者标成 status-critical 也是一个布局/编码决策：
    // 标了，答案直接跳出来；不标，就得靠读数字。乱稿默认不标。
    .attr('fill', d => (ctx.highlightWorst !== false && d.id === ctx.data.totals.worstCourse
      ? VIZ.critical : VIZ.series[0]));
  row.select('text.rank-value').attr('x', x(1) + 5).attr('y', bh / 2 + 4)
    .text(d => d3.format('.0%')(d.completion));

  row.attr('data-course', d => d.id)
     .attr('tabindex', 0).attr('role', 'button')
     .attr('aria-label', d => `${L(d, ctx)} ${d3.format('.0%')(d.completion)}`);

  g.node().__rowHeight = y.step();
}
// #endregion

/* ── 4. 完成率环形图 ────────────────────────────────────────────────────── */
// #region snippet:completion
function renderCompletion(g, box, ctx) {
  const { inner, w, h } = shell(g, box, ctx);
  const value = ctx.data.totals.avgCompletion;
  // 环形图的宽高比锁定 1:1——这是它无法协商的硬约束
  const size = Math.max(0, Math.min(w, h));
  const r = size / 2, thick = Math.max(6, size * 0.16);

  const arc = d3.arc().innerRadius(Math.max(0, r - thick)).outerRadius(r).cornerRadius(thick / 2);
  const wrap = inner.selectAll('g.donut').data([0])
    .join(en => en.append('g').attr('class', 'donut'));
  tr(wrap, ctx).attr('transform', `translate(${w / 2},${h / 2})`);

  wrap.selectAll('path.donut-track').data([1])
    .join(en => en.append('path').attr('class', 'donut-track').attr('fill', VIZ.grid))
    .attr('d', arc({ startAngle: 0, endAngle: Math.PI * 2 }));

  // 用 attrTween 让弧长真正沿圆周生长，而不是整段闪现
  const val = wrap.selectAll('path.donut-value').data([value])
    .join(en => en.append('path').attr('class', 'donut-value').attr('fill', VIZ.series[0])
                  .each(function () { this.__a = 0; }));
  const t = T(ctx);
  if (t) {
    val.transition(t).attrTween('d', function (d) {
      const i = d3.interpolate(this.__a, d * Math.PI * 2);
      return (u) => { this.__a = i(u); return arc({ startAngle: 0, endAngle: this.__a }); };
    });
  } else {
    // reduced-motion / 同步测量路径：attrTween 只存在于 transition 上
    val.attr('d', function (d) {
      this.__a = d * Math.PI * 2;
      return arc({ startAngle: 0, endAngle: this.__a });
    });
  }

  wrap.selectAll('text.donut-num').data([value])
    .join(en => en.append('text').attr('class', 'donut-num').attr('text-anchor', 'middle'))
    .attr('y', 6).attr('font-size', Math.max(11, size * 0.26))
    .text(d3.format('.0%')(value));

  g.node().__diameter = size;
}
// #endregion

/* ── 5. 设备分布 ────────────────────────────────────────────────────────── */
// #region snippet:devices
function renderDevices(g, box, ctx) {
  const { inner, w, h } = shell(g, box, ctx);
  const latest = ctx.data.devices[ctx.data.devices.length - 1];
  const keys = ['desktop', 'tablet', 'mobile'];
  const names = {
    desktop: { zh: '桌面', en: 'Desktop' },
    tablet:  { zh: '平板', en: 'Tablet'  },
    mobile:  { zh: '手机', en: 'Mobile'  }
  };

  const series = d3.stack().keys(keys)([latest]);
  const x = d3.scaleLinear().domain([0, 100]).range([0, w]);
  const barH = Math.max(6, Math.min(26, h - 30));

  const seg = inner.selectAll('g.seg').data(series, d => d.key)
    .join(en => {
      const gg = en.append('g').attr('class', 'seg');
      gg.append('rect').attr('rx', 3);
      gg.append('text').attr('class', 'seg-inline').attr('text-anchor', 'middle');
      return gg;
    });

  // 每段之间留 2px 表面缝隙（dataviz 规范），故 width 减 2
  const segW = d => Math.max(0, x(d[0][1]) - x(d[0][0]) - 2);
  tr(seg.select('rect'), ctx)
    .attr('x', d => x(d[0][0])).attr('y', 0)
    .attr('width', segW).attr('height', barH)
    .attr('fill', (d, i) => VIZ.series[i]);

  // 选择性直接标注：段内只在**量得下**时才写百分比，否则留白交给图例。
  // 不估算字宽，用 getComputedTextLength() 真量。
  const inlineSel = seg.select('text.seg-inline')
    .attr('y', barH / 2 + 3.5)
    .text(d => `${latest[d.key]}%`);
  tr(inlineSel, ctx).attr('x', d => (x(d[0][0]) + x(d[0][1])) / 2);
  inlineSel.each(function (d) {
    const fits = this.getComputedTextLength() + 8 <= segW(d);
    this.style.display = fits ? null : 'none';
    // 深色块上用白字，浅色块（aqua）上用深字，保证段内文字自身也可读
    this.setAttribute('fill', keys.indexOf(d.key) === 2 ? VIZ.ink : '#fff');
  });

  // 图例常驻：aqua 在白底对比度 2.82 < 3:1，按 dataviz 的补偿规则，
  // 身份不能只靠颜色，必须有文字。图例因此不是装饰，是可访问性要求。
  const legend = inner.selectAll('g.seg-legend').data(keys, d => d)
    .join(en => {
      const gg = en.append('g').attr('class', 'seg-legend');
      gg.append('rect').attr('class', 'legend-dot').attr('width', 8).attr('height', 8).attr('rx', 2);
      gg.append('text').attr('class', 'seg-label');
      return gg;
    });
  legend.select('rect.legend-dot').attr('fill', (d, i) => VIZ.series[i]);
  legend.select('text.seg-label')
    .attr('x', 12).attr('y', 8)
    .text(d => `${L(names[d], ctx)} ${latest[d]}%`);

  // 图例按各自实测宽度依次排布——排不下时会真的重叠，由 check() 量出来
  let cursor = 0;
  const legendY = barH + 12;
  legend.each(function (d, i) {
    const node = d3.select(this);
    node.attr('transform', `translate(${cursor},${legendY})`);
    const tw = this.querySelector('text').getComputedTextLength();
    cursor += 12 + tw + 14;
  });

  g.node().__legend = {
    texts: legend.selectAll('text.seg-label').nodes(),
    totalWidth: cursor - 14,
    available: w
  };
}
// #endregion

/* ── 6. 看板说明文本 ────────────────────────────────────────────────────── */
// #region snippet:blurb
function renderBlurb(g, box, ctx) {
  const { inner, w, h } = shell(g, box, ctx);
  const text = ctx.data.blurb[ctx.lang];
  const lineH = 15;

  const t = inner.selectAll('text.blurb').data([0])
    .join(en => en.append('text').attr('class', 'blurb').attr('x', 0).attr('y', 12));

  // 用真实的 getComputedTextLength() 断行——不估算字宽。
  // 正因为断行是实测的，栏宽一变，每行字符数就真的跟着变。
  const node = t.node();
  const units = ctx.lang === 'zh' ? [...text] : text.split(/\s+/).filter(Boolean);
  const probe = node.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'text');
  probe.setAttribute('class', 'blurb');
  probe.style.visibility = 'hidden';
  node.parentNode.appendChild(probe);

  // #region snippet:blurb-measure
  // 用真实的 getComputedTextLength() 断行，不按字符数估算字宽。 ←→ Break lines with the real getComputedTextLength(); never estimate character width.
  // 正因为断行是实测的，栏宽一改，每行字符数就真的跟着变， ←→ Because the wrapping is measured, changing the column really changes the characters per line,
  // 45–75 字符的排版规则才有了可验证的依据。 ←→ which is what gives the 45–75 character rule something to stand on.
  const lines = [];
  let cur = '';
  for (const u of units) {
    const next = ctx.lang === 'zh' ? cur + u : (cur ? cur + ' ' + u : u);
    probe.textContent = next;
    if (probe.getComputedTextLength() > w && cur) { lines.push(cur); cur = u; }
    else cur = next;
  }
  // #endregion
  if (cur) lines.push(cur);
  probe.remove();

  const maxLines = Math.max(1, Math.floor((h - 4) / lineH));
  t.selectAll('tspan').data(lines.slice(0, maxLines), (d, i) => i)
    .join(en => en.append('tspan').attr('x', 0))
    .attr('dy', (d, i) => (i === 0 ? 0 : lineH))
    .text(d => d);

  // ref 只作样式参考，measureCPL 不会改动它（早期版本改过，导致 tspan 被抹平）
  g.node().__cpl = {
    ref: node, sample: text.slice(0, 40), width: w,
    truncated: lines.length > maxLines
  };
}
// #endregion

/* ── 模块注册表：渲染 + 硬约束 ──────────────────────────────────────────── */
/**
 * min.w / min.h 是**可读性下限**，不是审美偏好，每条都能在演示里看到后果：
 * 低于它，标签就真的重叠、单元格就真的糊、文字就真的被截断。
 */
export const MODULES = {
  trend: {
    id: 'trend', render: renderTrend, main: true,
    title: { zh: '每周活跃趋势', en: 'Weekly activity' },
    // min.w 在这里只是**排版器的提示值**，不是判定标准。
    //
    // 原因值得记下来：标签宽度取决于最终真正落到哪个字体，而这在不同文档里
    // 并不一致——同一个「1周」在独立测试页里量到 21.1px，在课程页里量到 29.4px。
    // 因此任何"按字宽推出来的常数"都不可靠。
    //
    // 判定交给 check()：它用 getBBox() 就地量真实标签，量到什么算什么。
    // 这个常数只用来让 reflow 的打包有个合理起点，取观察到的最坏情况：
    //   最宽标签 29.4 + 最小间隙 2 = 31.4 ⇒ 11 个间距 345 + 留白 42 + 内边距 24 ≈ 411
    min: { w: 420, h: 130 },
    constraint: { zh: '12 个周标签不能重叠（就地实测判定）', en: '12 week labels must not overlap (judged by in-place measurement)' },
    check(box) {
      const out = [];
      const ticks = box.node && box.node.__ticks ? box.node.__ticks : [];
      const col = ticks.length ? labelCollisions(ticks, 'x') : { count: 0 };
      if (col.count > 0) out.push({
        severity: 'critical', metric: 'collisions', value: col.count,
        zh: `周标签有 ${col.count} 处重叠，主图需要更宽`,
        en: `${col.count} week labels overlap — the main chart needs more width` });
      if (box.h < this.min.h) out.push({
        severity: 'warning', metric: 'height', value: Math.round(box.h),
        zh: `趋势高度仅 ${Math.round(box.h)}px，斜率被压平`,
        en: `Only ${Math.round(box.h)}px tall — the slope reads flat` });
      return out;
    }
  },
  heat: {
    id: 'heat', render: renderHeat,
    title: { zh: '学习时段热力图', en: 'Study-time heatmap' },
    min: { w: 230, h: 120 }, minCell: 8,
    constraint: { zh: '单元格边长 ≥ 8px', en: 'Cell edge ≥ 8px' },
    check(box) {
      const c = box.node && box.node.__cell;
      if (!c) return [];
      const edge = Math.min(c.w, c.h);
      return edge < this.minCell ? [{
        severity: 'critical', metric: 'cell', value: +edge.toFixed(1),
        zh: `单元格仅 ${edge.toFixed(1)}px，低于 8px 可读下限`,
        en: `Cell is ${edge.toFixed(1)}px — below the 8px legibility floor` }] : [];
    }
  },
  ranking: {
    id: 'ranking', render: renderRanking,
    title: { zh: '课程完成率排行', en: 'Completion ranking' },
    min: { w: 210, h: rankingMinHeight() }, minRow: RANK.minRow,
    constraint: { zh: `行高 ≥ ${RANK.minRow}px（${RANK.rows} 门课 ⇒ 高度 ≥ ${rankingMinHeight()}px）`, en: `Row height ≥ ${RANK.minRow}px (${RANK.rows} courses ⇒ ≥ ${rankingMinHeight()}px tall)` },
    check(box) {
      const rh = box.node && box.node.__rowHeight;
      if (!rh) return [];
      return rh < this.minRow ? [{
        severity: 'critical', metric: 'row', value: +rh.toFixed(1),
        zh: `行高仅 ${rh.toFixed(1)}px，课程名会被压住`,
        en: `Row height is ${rh.toFixed(1)}px — course names collide` }] : [];
    }
  },
  completion: {
    id: 'completion', render: renderCompletion,
    title: { zh: '平均完成率', en: 'Avg. completion' },
    min: { w: 130, h: 130 }, aspect: 1, minDiameter: 90,
    constraint: { zh: '宽高比 1:1 且直径 ≥ 90px', en: 'Aspect 1:1, diameter ≥ 90px' },
    check(box) {
      const d = box.node && box.node.__diameter;
      if (d == null) return [];
      return d < this.minDiameter ? [{
        severity: 'warning', metric: 'diameter', value: Math.round(d),
        zh: `环形直径仅 ${Math.round(d)}px，中心数字已难读`,
        en: `Donut is ${Math.round(d)}px across — the centre figure is hard to read` }] : [];
    }
  },
  devices: {
    id: 'devices', render: renderDevices,
    title: { zh: '设备分布', en: 'Device mix' },
    min: { w: 210, h: 76 },
    constraint: { zh: '图例必须排得下（身份不可只靠颜色）', en: 'Legend must fit — identity is never colour-alone' },
    check(box) {
      const lg = box.node && box.node.__legend;
      if (!lg) return [];
      const over = lg.totalWidth - lg.available;
      return over > 0 ? [{
        severity: 'warning', metric: 'legend', value: Math.round(over),
        zh: `图例排不下，超出 ${Math.round(over)}px`,
        en: `Legend does not fit — ${Math.round(over)}px too wide` }] : [];
    }
  },
  blurb: {
    id: 'blurb', render: renderBlurb,
    title: { zh: '看板说明', en: 'About this board' },
    min: { w: 200, h: 84 },
    // #region snippet:blurb-minheight
    /**
     * 文本块与图表的根本区别：**它没有"最小高度"，只有"由宽度决定的所需高度"。**
     * 栏越窄，行数越多，需要的高度就越大——两者是此消彼长的关系。
     * 布局引擎必须问它"在这个宽度下你要多高"，而不是查一个固定常数。
     *
     * 平均字宽 8.8px 是 10.5px 字号下 getComputedTextLength() 的实测值
     * （中文全角；英文更窄，故取中文这一边作为保守估计）。
     */
    minHeightAt(width, ctx) {
      const inner = Math.max(1, width - 24);                 // 扣掉 shell 左右内边距
      const chars = Math.max(ctx.data.blurb.zh.length, ctx.data.blurb.en.length / 2);
      // +1 行是刻意留的余量：这里是**估算**（按平均字宽），而 check() 用的是
      // getComputedTextLength() 的**实测**断行。估算偏短 1 行就会被判为截断，
      // 于是同一个布局在相邻宽度上忽而合格忽而不合格——断点扫描会变成一片噪声。
      // 宁可多留一行，也不要让估算与实测互相打架。
      const lines = Math.ceil(chars * 8.8 / inner) + 1;
      return lines * 15 + 26 + 12 + 6;                       // 行高 + 标题栏 + 内边距 + 余量
    },
    // #endregion
    constraint: { zh: '每行 45–75 西文字符 / 22–38 汉字', en: '45–75 characters per line' },
    check(box, ctx) {
      const info = box.node && box.node.__cpl;
      if (!info) return [];
      const { cpl } = measureCPL(info.ref, info.sample, info.width);
      const v = cplVerdict(cpl, ctx.lang);
      const out = [];
      if (v !== 'ok') out.push({
        severity: 'warning', metric: 'cpl', value: cpl,
        zh: v === 'wide' ? `每行 ${cpl} 字，过宽易串行` : `每行 ${cpl} 字，过窄换行过频`,
        en: v === 'wide' ? `${cpl} chars per line — too wide` : `${cpl} chars per line — too narrow` });
      if (info.truncated) out.push({
        severity: 'critical', metric: 'truncated', value: 1,
        zh: '说明文字被模块高度截断',
        en: 'Body text is clipped by the module height' });
      return out;
    }
  }
};

export const MODULE_IDS = Object.keys(MODULES);

/**
 * 渲染一整块看板。
 *
 * @param {d3.Selection} root 目标 <g> 或 <svg>
 * @param {Array<{id,x,y,w,h,main?}>} boxes 布局结果
 * @param {{lang,data,t?,reduced?}} ctx
 * @returns {Array} 带 node 引用的 boxes，供 check() / 实测使用
 */
export function renderBoard(root, boxes, ctx) {
  const sel = root.selectAll('g.mod').data(boxes, d => d.id)
    .join(en => en.append('g').attr('class', 'mod').attr('data-module', d => d.id)
                  // 新进入的模块**直接到位**，不从 (0,0) 飞进来：
                  // 首帧本来就没有"上一个位置"，动画无从谈起，只会让第一眼看到的
                  // 是一堆挤在左上角的模块。过渡只属于"从旧位置到新位置"。
                  .attr('transform', d => `translate(${d.x},${d.y})`));

  tr(sel, ctx).attr('transform', d => `translate(${d.x},${d.y})`);

  sel.each(function (d) {
    d.node = this;
    MODULES[d.id].render(d3.select(this), d, ctx);
  });
  return boxes;
}
