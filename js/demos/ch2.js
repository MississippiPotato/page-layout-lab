/**
 * demos/ch2.js —— 第 2 章「网格、对齐与比例」的四个演示。
 *
 * 本章的演示原型：**scaleBand 栅格 + 吸附 + 实测标尺**。
 *
 * 这一章要立住全课的主线：栅格不是另一套东西，它就是一维 band scale。
 * 因此四个演示全部直接操作 d3.scaleBand()，滑杆调的就是它的参数，
 * 画面上标出的 bandwidth / step / paddingInner 就是栅格的列宽 / 列距 / gutter。
 */

import d3 from '../d3.js';
import * as data from '../../data/campus.js';
import { MODULES, renderBoard, gridBand } from '../charts.js';
import { constraintViolations, labelCollisions, alignmentError,
         measureCPL, cplVerdict, snap, gridError } from '../metrics.js';
import { S } from '../strings.js';
import { pick, t } from '../i18n.js';
import { scaffold, range, toggle, button, actions, readout, readoutList,
         renderHealth, pageFrame } from './kit.js';
import { readState, patchState } from '../state.js';

const CANVAS = { w: 860, h: 520 };
const PAGE = { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };

/** 看板的版面计划：谁占第几列、跨几列、在第几行。行高按比例分配。 */
const PLAN = [
  { id: 'trend',      col: 0, span: 7, row: 0, main: true },
  { id: 'completion', col: 7, span: 2, row: 0 },
  { id: 'devices',    col: 9, span: 3, row: 0 },
  { id: 'ranking',    col: 0, span: 5, row: 1 },
  { id: 'heat',       col: 5, span: 4, row: 1 },
  { id: 'blurb',      col: 9, span: 3, row: 1 }
];

// #region snippet:ch2-layout
/**
 * 由栅格参数算出每个模块的矩形。 ←→ Derive each module's rectangle from the grid parameters.
 *
 * 注意这里没有任何"布局引擎"：位置就是 band(col)，宽度就是 band.spanWidth(span)。 ←→ There is no layout engine here: position is band(col) and width is band.spanWidth(span).
 * 页面栅格的全部数学，`d3.scaleBand()` 已经提供了。 ←→ d3.scaleBand() already supplies all the maths a page grid needs.
 */
function layoutFromGrid({ columns, margin, gutter }, plan = PLAN, canvas = CANVAS) {
  const band = gridBand(columns, canvas.w, { margin, gutter });
  const rowGap = gutter;
  const usable = canvas.h - margin * 2 - rowGap;
  const rowH = [usable * 0.52, usable * 0.48];

  const boxes = plan.map(p => ({
    id: p.id,
    main: !!p.main,
    x: band(Math.min(p.col, columns - 1)),
    w: band.spanWidth(Math.min(p.span, columns - p.col)),
    y: margin + (p.row === 0 ? 0 : rowH[0] + rowGap),
    h: rowH[p.row]
  }));
  return { boxes, band };
}
// #endregion

/** 统一的实测汇总：五项全部来自浏览器真实测量。 */
function measure(boxes, band, ctx) {
  const { violations } = constraintViolations(MODULES, boxes, ctx);
  const trend = boxes.find(b => b.id === 'trend');
  const blurb = boxes.find(b => b.id === 'blurb');

  const collisions = trend?.node?.__ticks
    ? labelCollisions(trend.node.__ticks, 'x').count : 0;
  const align = alignmentError(boxes.map(b => ({ id: b.id, x: b.x, w: b.w })), band.lines);
  const cpl = blurb?.node?.__cpl
    ? measureCPL(blurb.node.__cpl.ref, blurb.node.__cpl.sample, blurb.node.__cpl.width).cpl : 0;

  // 越界同样按**最终**几何判断，而不是 getBBox()：
  // 过渡进行中时 DOM 上还是旧位置，用它会把正在移动的模块误报为越界。
  const overflow = boxes.filter(b =>
    b.x < PAGE.x - 0.5 || b.y < PAGE.y - 0.5 ||
    b.x + b.w > PAGE.x + PAGE.w + 0.5 ||
    b.y + b.h > PAGE.y + PAGE.h + 0.5).length;

  return { collisions, alignment: align.mean, cpl, overflow, violations, align };
}

/** 画出列线与 gutter 带，把抽象的栅格变成看得见的东西。 */
function drawGuides(svg, band, { columns, margin, gutter }, show) {
  const layer = svg.selectAll('g.grid-layer').data([0])
    .join(en => en.insert('g', ':first-child').attr('class', 'grid-layer'));
  layer.style('display', show ? null : 'none');
  if (!show) return;

  // 列（bandwidth）
  layer.selectAll('rect.col-band').data(d3.range(columns), d => d)
    .join(en => en.append('rect').attr('class', 'col-band'))
    .attr('x', i => band(i)).attr('y', 0)
    .attr('width', band.bandwidth()).attr('height', CANVAS.h);

  // gutter（paddingInner 换算出来的那一段）
  layer.selectAll('rect.col-gutter').data(d3.range(columns - 1), d => d)
    .join(en => en.append('rect').attr('class', 'col-gutter'))
    .attr('x', i => band(i) + band.bandwidth()).attr('y', 0)
    .attr('width', Math.max(0, band.step() - band.bandwidth())).attr('height', CANVAS.h);
}

const ctxFor = (lang, reduced) => ({ lang, data, reduced, t: 420 });

/* ══ 2-1 网格是一套空间坐标 ══════════════════════════════════════════════ */
function demoGrid(mount, { lang, section, reduced }) {
  const saved = readState().grid;
  let g = { ...saved };

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      range('cols', S.columns, 4, 12, g.columns) +
      range('gutter', S.gutter, 4, 40, g.gutter, 1, 'px') +
      range('margin', S.margin, 8, 64, g.margin, 1, 'px') +
      toggle('showGrid', S.showGrid, true) +
      readoutList(
        readout('mBand', S.metrics.bandwidth),
        readout('mStep', S.metrics.step),
        readout('mGutter', S.gutter),
        readout('mColl', S.metrics.collisions)
      ),
    extra: '<div class="health-host"></div>'
  });

  const ctx = ctxFor(lang, reduced);
  const healthHost = mount.querySelector('.health-host');

  function update() {
    const { boxes, band } = layoutFromGrid(g);
    pageFrame(ui.svg, PAGE);
    drawGuides(ui.svg, band, g, mount.querySelector('#showGrid').checked);
    renderBoard(ui.svg, boxes, ctx);

    const m = measure(boxes, band, ctx);
    ui.setReadout('mBand', `${band.bandwidth().toFixed(1)} px`);
    ui.setReadout('mStep', `${band.step().toFixed(1)} px`);
    ui.setReadout('mGutter', `${(band.step() - band.bandwidth()).toFixed(1)} px`, true);
    ui.setReadout('mColl', String(m.collisions), m.collisions === 0);
    renderHealth(healthHost, m, lang);

    patchState({ grid: { ...g } });
    ui.setStatus(
      `${g.columns} 列 · 列宽 ${band.bandwidth().toFixed(1)}px · gutter ${(band.step() - band.bandwidth()).toFixed(1)}px。` +
      (m.collisions ? `主图周标签有 ${m.collisions} 处重叠——列数或跨列数需要调整。` : '主图周标签互不重叠。'),
      `${g.columns} columns · ${band.bandwidth().toFixed(1)}px wide · ${(band.step() - band.bandwidth()).toFixed(1)}px gutter. ` +
      (m.collisions ? `${m.collisions} week labels overlap — adjust the column count or span.` : 'No week-label overlap.')
    );
  }

  ui.onRange('cols', v => { g.columns = v; update(); });
  ui.onRange('gutter', v => { g.gutter = v; update(); }, v => `${v}px`);
  ui.onRange('margin', v => { g.margin = v; update(); }, v => `${v}px`);
  ui.on('showGrid', 'change', update);
  update();
}

/* ══ 2-2 对齐创造关系 ════════════════════════════════════════════════════ */
function demoAlignment(mount, { lang, section, reduced }) {
  const g = readState().grid;
  // 故意从"错开"的状态起步：学习者要做的是把它吸附回列线
  const offsets = new Map(PLAN.map((p, i) => [p.id, (i % 2 ? 1 : -1) * (9 + (i * 5) % 17)]));

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    hint: S.dragHint,
    controls:
      toggle('showGrid2', S.showGrid, true) +
      toggle('showErr', { zh: '显示误差向量', en: 'Show error vectors' }, true) +
      actions(button('scatter', S.breakGrid), button('snap', S.snapToGrid, true)) +
      readoutList(
        readout('mAlign', S.metrics.alignment),
        readout('mWorst', { zh: '最差的一个', en: 'Worst offender' })
      ),
    extra: '<div class="health-host"></div>'
  });

  const ctx = ctxFor(lang, reduced);
  const healthHost = mount.querySelector('.health-host');

  function update() {
    const { boxes, band } = layoutFromGrid(g);
    boxes.forEach(b => { b.x += offsets.get(b.id) || 0; });

    pageFrame(ui.svg, PAGE);
    drawGuides(ui.svg, band, g, mount.querySelector('#showGrid2').checked);
    renderBoard(ui.svg, boxes, ctx);

    const m = measure(boxes, band, ctx);
    drawErrors(boxes, band, mount.querySelector('#showErr').checked);

    ui.setReadout('mAlign', `${m.alignment} px`, m.alignment <= 2);
    const worst = m.align.worst;
    ui.setReadout('mWorst', worst && Math.abs(worst.worst) > 0.5
      ? `${t(MODULES[worst.id].title)} ${worst.worst > 0 ? '+' : ''}${worst.worst.toFixed(1)}px`
      : '—', !worst || Math.abs(worst.worst) <= 2);
    renderHealth(healthHost, m, lang);

    ui.setStatus(
      m.alignment <= 2
        ? '所有卡片边缘都落在共享列线上，页面读起来是一个整体。'
        : `平均对齐误差 ${m.alignment}px。边缘没有共线时，视觉上会读成互不相关的碎片。`,
      m.alignment <= 2
        ? 'Every card edge sits on a shared column line, so the page reads as one object.'
        : `Mean alignment error is ${m.alignment}px. Without shared edges the page reads as unrelated fragments.`
    );
  }

  /** 从每张卡的左边画一条线到最近的列线——误差不是算出来的分数，是画得出来的距离。 */
  function drawErrors(boxes, band, show) {
    const layer = ui.svg.selectAll('g.err-layer').data([0])
      .join(en => en.append('g').attr('class', 'err-layer'));
    layer.style('display', show ? null : 'none');
    const nearest = v => band.lines.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, band.lines[0]);
    const errs = boxes.map(b => ({ id: b.id, x1: b.x, x2: nearest(b.x), y: b.y + 14 }))
                      .filter(e => Math.abs(e.x1 - e.x2) > 1);
    layer.selectAll('line.error-vector').data(errs, d => d.id)
      .join(en => en.append('line').attr('class', 'error-vector'))
      .attr('x1', d => d.x1).attr('x2', d => d.x2).attr('y1', d => d.y).attr('y2', d => d.y);
    layer.selectAll('text.error-label').data(errs, d => d.id)
      .join(en => en.append('text').attr('class', 'error-label'))
      .attr('x', d => (d.x1 + d.x2) / 2).attr('y', d => d.y - 5)
      .attr('text-anchor', 'middle')
      .text(d => `${(d.x1 - d.x2) > 0 ? '+' : ''}${(d.x1 - d.x2).toFixed(0)}`);
  }

  ui.on('scatter', 'click', () => {
    PLAN.forEach((p, i) => offsets.set(p.id, (i % 2 ? 1 : -1) * (7 + (i * 11) % 21)));
    update();
  });
  // #region snippet:ch2-snap
  // 吸附不需要自己写取整逻辑：band.step() 就是列距， ←→ Snapping needs no bespoke rounding: band.step() is the column pitch,
  // snap() 把坐标落到最近一条列线上。栅格与 band scale 在这里完全重合。 ←→ and snap() drops the coordinate onto the nearest column line. Grid and band scale coincide exactly.
  ui.on('snap', 'click', () => {
    PLAN.forEach(p => offsets.set(p.id, 0));
    update();
  });
  // #endregion
  ui.on('showGrid2', 'change', update);
  ui.on('showErr', 'change', update);
  update();
}

/* ══ 2-3 比例决定主次与可读性 ════════════════════════════════════════════ */
function demoRatio(mount, { lang, section, reduced }) {
  const g = readState().grid;
  let mainSpan = 7;

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      range('mainSpan', S.mainSpan, 3, 10, mainSpan, 1, pick(' 列', ' col')) +
      readoutList(
        readout('mColl2', S.metrics.collisions),
        readout('mCpl', S.metrics.cpl),
        readout('mVerdict', { zh: '行长判定', en: 'Line-length verdict' })
      ),
    extra: '<div class="health-host"></div>'
  });

  const ctx = ctxFor(lang, reduced);
  const healthHost = mount.querySelector('.health-host');

  function update() {
    // 主图跨列数变了，右侧两块跟着让位——这就是"比例"的实质：列的再分配
    const rest = 12 - mainSpan;
    const plan = [
      { id: 'trend', col: 0, span: mainSpan, row: 0, main: true },
      { id: 'completion', col: mainSpan, span: Math.max(2, Math.round(rest * 0.4)), row: 0 },
      { id: 'devices', col: mainSpan + Math.max(2, Math.round(rest * 0.4)),
        span: Math.max(2, rest - Math.max(2, Math.round(rest * 0.4))), row: 0 },
      { id: 'ranking', col: 0, span: 5, row: 1 },
      { id: 'heat', col: 5, span: 4, row: 1 },
      { id: 'blurb', col: 9, span: 3, row: 1 }
    ];
    const { boxes, band } = layoutFromGrid(g, plan);
    pageFrame(ui.svg, PAGE);
    drawGuides(ui.svg, band, g, false);
    renderBoard(ui.svg, boxes, ctx);

    const m = measure(boxes, band, ctx);
    const verdict = cplVerdict(m.cpl, lang);
    ui.setReadout('mColl2', String(m.collisions), m.collisions === 0);
    ui.setReadout('mCpl', String(m.cpl), verdict === 'ok');
    ui.setReadout('mVerdict',
      t(verdict === 'ok' ? S.verdict.ok : verdict === 'wide' ? S.verdict.tooWide : S.verdict.tooNarrow),
      verdict === 'ok');
    renderHealth(healthHost, m, lang);

    ui.setStatus(
      `主图跨 ${mainSpan} 列。${m.collisions ? `周标签重叠 ${m.collisions} 处——主图被压得太窄。` : '周标签不重叠。'}` +
      `说明文字每行 ${m.cpl} 字（舒适区 22–38）。`,
      `Main chart spans ${mainSpan} columns. ${m.collisions ? `${m.collisions} label overlaps — too narrow.` : 'No label overlap.'}` +
      ` Body text runs ${m.cpl} characters per line (comfortable: 45–75).`
    );
  }

  ui.onRange('mainSpan', v => { mainSpan = v; update(); }, v => `${v}${pick(' 列', ' col')}`);
  update();
}

/* ══ 2-4 间距系统与垂直节奏 ══════════════════════════════════════════════ */
function demoRhythm(mount, { lang, section, reduced }) {
  const g = readState().grid;
  let base = 8;

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      range('baseUnit', { zh: '基础单位', en: 'Base unit' }, 4, 16, base, 1, 'px') +
      toggle('showBase', S.showBaseline, true) +
      readoutList(
        readout('mOff', { zh: '偏离基线均值', en: 'Mean baseline offset' }),
        readout('mOn', { zh: '落在基线上', en: 'On the baseline' })
      ),
    extra: '<div class="health-host"></div>'
  });

  const ctx = ctxFor(lang, reduced);
  const healthHost = mount.querySelector('.health-host');

  function update() {
    // 纵向间距全部取基础单位的整数倍，行高也吸附到基线
    const margin = snap(g.margin, base) || base * 2;
    const { boxes, band } = layoutFromGrid({ ...g, margin }, PLAN);
    boxes.forEach(b => { b.y = snap(b.y, base); b.h = snap(b.h, base); });

    pageFrame(ui.svg, PAGE);
    renderBoard(ui.svg, boxes, ctx);
    drawBaselines(mount.querySelector('#showBase').checked);

    const offsets = boxes.map(b => Math.abs(gridError(b.y, base)));
    const meanOff = +(offsets.reduce((a, v) => a + v, 0) / offsets.length).toFixed(2);
    const onGrid = offsets.filter(v => v < 0.5).length;

    const m = measure(boxes, band, ctx);
    ui.setReadout('mOff', `${meanOff} px`, meanOff < 0.5);
    ui.setReadout('mOn', `${onGrid} / ${boxes.length}`, onGrid === boxes.length);
    renderHealth(healthHost, m, lang);

    ui.setStatus(
      `基础单位 ${base}px，纵向间距只取它的整数倍（${base * 2} / ${base * 3} / ${base * 5}px）。` +
      `${onGrid}/${boxes.length} 个模块顶边落在基线上。`,
      `An ${base}px base unit; vertical gaps are multiples of it (${base * 2} / ${base * 3} / ${base * 5}px). ` +
      `${onGrid} of ${boxes.length} modules sit on the baseline.`
    );
  }

  function drawBaselines(show) {
    const layer = ui.svg.selectAll('g.baseline-layer').data([0])
      .join(en => en.insert('g', ':first-child').attr('class', 'baseline-layer'));
    layer.style('display', show ? null : 'none');
    if (!show) return;
    layer.selectAll('line.baseline').data(d3.range(0, CANVAS.h, base), d => d)
      .join(
        en => en.append('line').attr('class', 'baseline'),
        up => up,
        ex => ex.remove()
      )
      .attr('x1', 0).attr('x2', CANVAS.w).attr('y1', d => d).attr('y2', d => d);
  }

  ui.onRange('baseUnit', v => { base = v; update(); }, v => `${v}px`);
  ui.on('showBase', 'change', update);
  update();
}

/* ── 注册 ──────────────────────────────────────────────────────────────── */
const CHARTS = '../js/charts.js';
const CH2 = '../js/demos/ch2.js';

export const DEMOS = {
  grid: {
    render: demoGrid,
    snippets: [
      { url: CHARTS, name: 'band',
        title: { zh: '关键点 1 · 栅格就是 scaleBand', en: 'Key 1 · The grid is a band scale' },
        why: { zh: 'paddingInner 表达的正是 gutter，step() 是列距，bandwidth() 是列宽。页面栅格不需要另一套数学。',
               en: 'paddingInner expresses the gutter, step() the column pitch, bandwidth() the column width. A page grid needs no separate maths.' } },
      { url: CH2, name: 'ch2-layout',
        title: { zh: '关键点 2 · 版面由 band 直接算出', en: 'Key 2 · The layout falls straight out of the band' },
        why: { zh: '位置就是 band(col)，宽度就是 spanWidth(span)；没有额外的布局引擎。',
               en: 'Position is band(col) and width is spanWidth(span) — there is no extra layout engine.' } }
    ]
  },
  alignment: {
    render: demoAlignment,
    snippets: [
      { url: CH2, name: 'ch2-snap',
        title: { zh: '关键点 1 · 吸附即回到列线', en: 'Key 1 · Snapping means returning to the line' },
        why: { zh: '列距由 band.step() 给出，吸附不必另写取整逻辑。',
               en: 'The pitch comes from band.step(), so snapping needs no bespoke rounding.' } },
      { url: '../js/metrics.js', name: 'align',
        title: { zh: '关键点 2 · 对齐误差是量出来的', en: 'Key 2 · Alignment error is measured' },
        why: { zh: '逐边取到最近列线的像素差，误差因此可以被画成一条看得见的线。',
               en: 'Each edge is compared to its nearest column line, so the error can be drawn as a visible segment.' } }
    ]
  },
  ratio: {
    render: demoRatio,
    snippets: [
      { url: CHARTS, name: 'blurb-measure',
        title: { zh: '关键点 1 · 每行字符数是实测的', en: 'Key 1 · Characters per line is measured' },
        why: { zh: '用 getComputedTextLength() 真断行，栏宽一改行长就真的改变。',
               en: 'Real line breaking via getComputedTextLength(), so changing the column really changes the measure.' } },
      { url: CHARTS, name: 'trend-join',
        title: { zh: '关键点 2 · 标签不抽稀才能暴露问题', en: 'Key 2 · Keep every label to expose the failure' },
        why: { zh: '保留全部 12 个周标签，栏宽不足时碰撞会真的发生并被量到。',
               en: 'Keeping all 12 week labels means overlap actually happens — and gets measured.' } }
    ]
  },
  rhythm: {
    render: demoRhythm,
    snippets: [
      { url: '../js/metrics.js', name: 'snap',
        title: { zh: '关键点 1 · 基线网格就是一维吸附', en: 'Key 1 · A baseline grid is 1-D snapping' },
        why: { zh: '纵向与横向用的是同一个 snap()，节奏和栅格是同一件事。',
               en: 'Vertical and horizontal share one snap() — rhythm and grid are the same thing.' } },
      { url: CH2, name: 'ch2-layout',
        title: { zh: '关键点 2 · 行高同样由栅格决定', en: 'Key 2 · Row heights come from the grid too' },
        why: { zh: '行高吸附到基础单位的整数倍，纵向间距因此不是随手填的数字。',
               en: 'Row heights snap to multiples of the base unit, so vertical gaps are never arbitrary.' } }
    ]
  }
};
