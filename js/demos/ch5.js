/**
 * demos/ch5.js —— 第 5 章「Campus Pulse 综合重构」的四个演示。
 *
 * 本章的演示原型：**实测审计 + 复测**。
 *
 * 这是全课主线的收口。前四章不是"讲过就算"，它们的产出都存在
 * state.js 里，本章直接拿来用：
 *   5-2 的实验室载入的是**你自己**调出来的栅格与布局；
 *   5-4 复测用的是**你自己**在第 1-1 节留下的基线。
 */

import d3 from '../d3.js';
import * as data from '../../data/campus.js';
import { MODULES, renderBoard, gridBand } from '../charts.js';
import { constraintViolations, labelCollisions, alignmentError,
         measureCPL, snap, gridError } from '../metrics.js';
import { S } from '../strings.js';
import { pick, t } from '../i18n.js';
import { scaffold, range, toggle, button, actions, readout, readoutList,
         renderHealth, pageFrame } from './kit.js';
import { readState, patchState, resetState } from '../state.js';
import { createProbe, fmtMs, renderCompare } from '../task-probe.js';

const CANVAS = { w: 880, h: 540 };
const PAGE = { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };

const ctxFor = (lang, reduced, extra = {}) =>
  ({ lang, data, reduced, rankSorted: true, highlightWorst: true, ...extra });

/** 混乱初稿（与第 1 章同一份，主线才连得上）。 */
const DRAFT = [
  { id: 'completion', x: 38,  y: 40,  w: 244, h: 158 },
  { id: 'trend',      x: 300, y: 26,  w: 322, h: 176 },
  { id: 'devices',    x: 638, y: 52,  w: 204, h: 140 },
  { id: 'ranking',    x: 52,  y: 216, w: 296, h: 188 },
  { id: 'heat',       x: 368, y: 230, w: 272, h: 174 },
  { id: 'blurb',      x: 658, y: 208, w: 198, h: 212 }
];

/** 按学习者在第 2 章存下的栅格参数生成目标版面。 */
function targetLayout(grid = readState().grid) {
  const band = gridBand(grid.columns, CANVAS.w, { margin: grid.margin, gutter: grid.gutter });
  const cols = grid.columns;
  const f = (i, n) => {
    const c = Math.min(Math.round(i * cols / 12), cols - 1);
    const s = Math.max(1, Math.min(cols - c, Math.round(n * cols / 12)));
    return { x: band(c), w: band.spanWidth(s) };
  };
  const top = grid.margin, r1 = 236, gap = grid.gutter;
  const r2 = CANVAS.h - top - r1 - gap - grid.margin;
  return [
    { id: 'trend', main: true, ...f(0, 7), y: top, h: r1 },
    { id: 'completion', ...f(7, 2), y: top, h: r1 },
    { id: 'devices', ...f(9, 3), y: top, h: r1 },
    { id: 'ranking', ...f(0, 5), y: top + r1 + gap, h: r2 },
    { id: 'heat', ...f(5, 4), y: top + r1 + gap, h: r2 },
    { id: 'blurb', ...f(9, 3), y: top + r1 + gap, h: r2 }
  ];
}

/** 统一的实测汇总。 */
function measure(boxes, band, ctx) {
  const { violations } = constraintViolations(MODULES, boxes, ctx);
  const trend = boxes.find(b => b.id === 'trend');
  const blurb = boxes.find(b => b.id === 'blurb');
  const collisions = trend?.node?.__ticks ? labelCollisions(trend.node.__ticks, 'x').count : 0;
  const align = alignmentError(boxes.map(b => ({ id: b.id, x: b.x, w: b.w })), band.lines);
  const cpl = blurb?.node?.__cpl
    ? measureCPL(blurb.node.__cpl.ref, blurb.node.__cpl.sample, blurb.node.__cpl.width).cpl : 0;
  const overflow = boxes.filter(b =>
    b.x < -0.5 || b.y < -0.5 || b.x + b.w > CANVAS.w + 0.5 || b.y + b.h > CANVAS.h + 0.5).length;
  return { collisions, alignment: align.mean, cpl, overflow, violations, align };
}

/* ══ 5-1 回放完整重构 ════════════════════════════════════════════════════ */
// #region snippet:ch5-replay
/**
 * 五个阶段，**每一阶段只改一个变量**——这是这段回放的全部设计。 ←→ Five stages, and each changes exactly ONE variable. That is the whole design of this replay.
 *
 * 只改一个变量，才能把"改善"归因到具体某一条决定上； ←→ Only by changing one thing can an improvement be attributed to a specific decision;
 * 一次改五样再说"你看好多了"，等于什么都没证明。 ←→ changing five at once and saying "see, much better" proves nothing.
 *
 * 数据键始终是模块 id，配合 transition，模块是**移动过去**的， ←→ The key stays the module id, so with transitions the modules MOVE
 * 不是销毁重建。对象连续性让人能跟住"同一块东西去了哪"。 ←→ instead of being destroyed and rebuilt. Object constancy lets the eye follow where each one went.
 */
function stageLayout(stage, grid) {
  const target = targetLayout(grid);
  const byId = Object.fromEntries(target.map(b => [b.id, b]));
  const draft = DRAFT.map(d => ({ ...d }));

  if (stage === 0) return draft;                        // 混乱初稿 ←→ the messy draft
  if (stage === 1) return draft;                        // 只修编码：排序并标出最低项，几何不动 ←→ encoding only: sort and flag the lowest; geometry untouched
  if (stage === 2) {                                    // 只修层级：主图拿到应有面积 ←→ hierarchy only: the main chart gets its proper area
    return draft.map(d => d.id === 'trend'
      ? { ...d, w: byId.trend.w, h: byId.trend.h, main: true } : d);
  }
  if (stage === 3) {                                    // 只修对齐：边缘吸附共享列线 ←→ alignment only: edges snap to the shared columns
    return draft.map(d => ({ ...d, x: byId[d.id].x, w: byId[d.id].w,
      main: d.id === 'trend' }));
  }
  if (stage === 4) {                                    // 只修分组：相关模块并排 ←→ grouping only: related modules become neighbours
    return draft.map(d => ({ ...d, ...byId[d.id], main: d.id === 'trend' }));
  }
  return target.map(d => ({ ...d, main: d.id === 'trend' }));   // 多屏验证后的最终版 ←→ final version, after the multi-screen checks
}

/**
 * 排序与高亮属于**编码**决策，从第 1 阶段起生效；几何决策从第 2 阶段起。 ←→ Sorting and highlighting are ENCODING decisions, applied from stage 1; geometry changes start at stage 2.
 * 这样五个阶段正好对应第 1 章诊断出的四类问题 + 多屏验证，一一对得上。 ←→ The stages then map one-to-one onto the four faults diagnosed in chapter 1, plus the multi-screen check.
 */
const stageEncoded = (stage) => stage >= 1;

// #endregion

function demoBeforeAfter(mount, { lang, section, reduced }) {
  const grid = readState().grid;
  let stage = 0;

  // 五个修复阶段，正好对应第 1 章诊断出的四类问题 + 多屏验证
  const LABELS = [
    { zh: '混乱初稿', en: 'The messy draft' },
    { zh: '只修编码', en: 'Encoding only' },
    { zh: '只修层级', en: 'Hierarchy only' },
    { zh: '只修对齐', en: 'Alignment only' },
    { zh: '只修分组', en: 'Grouping only' },
    { zh: '准备多屏检查', en: 'Ready for multi-screen checks' }
  ];
  const CHANGES = [
    { zh: '基线：第 1 章诊断出的四类问题同时存在。', en: 'Baseline: all four faults from chapter 1 at once.' },
    { zh: '排行榜按完成率排序并标出最低项，卡片位置不变。这一步让最低项更容易被找到。', en: 'Sort the ranking and flag the lowest row without moving the cards. The lowest value becomes easier to locate.' },
    { zh: '只让主图拿到应有的面积，建立明确的第一落点。', en: 'Only the main chart gets its proper area, establishing a first fixation.' },
    { zh: '只把卡片边缘吸附到共享列线，统一边缘与栏宽。', en: 'Only snap card edges to the shared column lines.' },
    { zh: '只把相关模块放到一起，让组内/组间关系可见。', en: 'Only regroup related modules so the relationships read.' },
    { zh: '桌面版面与上一档相同。到第 5-4 节再查看三种屏宽并复测任务。', en: 'The desktop layout is unchanged. Section 5-4 checks three widths and repeats the task.' }
  ];

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      range('stage', { zh: '重构阶段', en: 'Rebuild stage' }, 0, 5, 0) +
      `<p class="stage-label" id="stageLabel"></p>
       <p class="stage-change" id="stageChange"></p>` +
      readoutList(
        readout('rColl', S.metrics.collisions),
        readout('rAlign', S.metrics.alignment),
        readout('rViol', S.metrics.violations)
      ),
    extra: '<div class="health-host"></div>'
  });

  const healthHost = mount.querySelector('.health-host');
  const band = gridBand(grid.columns, CANVAS.w, { margin: grid.margin, gutter: grid.gutter });

  function update() {
    // 编码决策（排序 / 标红）从第 1 阶段起生效，与几何决策分开计入
    const ctx = ctxFor(lang, reduced, {
      rankSorted: stageEncoded(stage), highlightWorst: stageEncoded(stage)
    });
    const boxes = renderBoard(ui.svg, stageLayout(stage, grid), ctx);
    pageFrame(ui.svg, PAGE);
    ui.svg.selectAll('rect.page-frame').lower();

    const m = measure(boxes, band, ctx);
    const crit = m.violations.filter(v => v.severity === 'critical').length;
    ui.setReadout('rColl', String(m.collisions), m.collisions === 0);
    ui.setReadout('rAlign', `${m.alignment} px`, m.alignment <= 2);
    ui.setReadout('rViol', String(crit), crit === 0);
    renderHealth(healthHost, m, lang);

    mount.querySelector('#stageLabel').textContent = `${stage} / 5 · ${t(LABELS[stage])}`;
    mount.querySelector('#stageChange').textContent = t(CHANGES[stage]);

    ui.setStatus(
      `${t(LABELS[stage])}：${t(CHANGES[stage])}此时轴标签碰撞 ${m.collisions} 处、对齐误差 ${m.alignment}px。`,
      `${t(LABELS[stage])}: ${t(CHANGES[stage])} Right now: ${m.collisions} label collisions, ${m.alignment}px alignment error.`
    );
  }

  ui.onRange('stage', v => { stage = v; update(); });
  update();
}

/* ══ 5-2 拖拽布局实验室 ══════════════════════════════════════════════════ */
/**
 * 载入**你自己**的布局：第 2 章存下的栅格参数在这里生效，
 * 你在这里拖出来的结果又会被 5-3 审计、被 5-4 复测。
 */
function demoLab(mount, { lang, section, reduced }) {
  const grid = readState().grid;
  const band = gridBand(grid.columns, CANVAS.w, { margin: grid.margin, gutter: grid.gutter });
  const saved = readState().layout;
  let boxes = saved
    ? targetLayout(grid).map(b => ({ ...b, ...(saved[b.id] || {}) }))
    : targetLayout(grid);

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    hint: S.dragHint,
    controls:
      toggle('labGrid', S.showGrid, true) +
      toggle('labSnap', { zh: '松手时吸附到列线', en: 'Snap to columns on release' }, true) +
      actions(button('labMess', S.breakGrid), button('labReset', S.reset, true)) +
      readoutList(
        readout('lAlign', S.metrics.alignment),
        readout('lColl', S.metrics.collisions),
        readout('lViol', S.metrics.violations)
      ),
    extra: '<div class="health-host"></div>'
  });

  const ctx = ctxFor(lang, reduced);
  const healthHost = mount.querySelector('.health-host');

  function persist() {
    patchState({ layout: Object.fromEntries(boxes.map(b => [b.id, { x: b.x, y: b.y, w: b.w, h: b.h }])) });
  }

  function update(save = true) {
    const rendered = renderBoard(ui.svg, boxes, { ...ctx, t: 180 });
    pageFrame(ui.svg, PAGE);
    ui.svg.selectAll('rect.page-frame').lower();
    drawGuides();
    attachDrag(rendered);

    const m = measure(rendered, band, ctx);
    const crit = m.violations.filter(v => v.severity === 'critical').length;
    ui.setReadout('lAlign', `${m.alignment} px`, m.alignment <= 2);
    ui.setReadout('lColl', String(m.collisions), m.collisions === 0);
    ui.setReadout('lViol', String(crit), crit === 0);
    renderHealth(healthHost, m, lang);
    if (save) persist();

    ui.setStatus(
      crit === 0 && m.alignment <= 2
        ? `对齐误差 ${m.alignment}px、无硬约束违反。这份布局会被下一节审计、被 5-4 复测。`
        : `对齐误差 ${m.alignment}px、硬约束违反 ${crit} 条。${m.alignment > 2 ? '先把边缘吸回列线，' : ''}再看模块尺寸。`,
      crit === 0 && m.alignment <= 2
        ? `${m.alignment}px alignment error and no hard violations. This layout is what the next section audits and 5-4 re-tests.`
        : `${m.alignment}px alignment error, ${crit} hard violation(s). ${m.alignment > 2 ? 'Snap the edges back to the columns first, ' : ''}then check the module sizes.`
    );
  }

  function drawGuides() {
    const show = mount.querySelector('#labGrid').checked;
    const layer = ui.svg.selectAll('g.lab-grid').data([0])
      .join(en => en.insert('g', ':first-child').attr('class', 'lab-grid'));
    layer.style('display', show ? null : 'none');
    layer.selectAll('line.guide').data(band.lines, d => d)
      .join(en => en.append('line').attr('class', 'guide'))
      .attr('x1', d => d).attr('x2', d => d).attr('y1', 0).attr('y2', CANVAS.h);
  }

  // #region snippet:ch5-snap
  /**
   * 拖拽 + 吸附。 ←→ Drag and snap.
   *
   * 吸附目标不是"每 8px 一格"这种任意步长，而是**第 2 章那套列线**： ←→ The snap target is not an arbitrary 8px step but the very column lines from chapter 2:
   * band.lines 里存的就是每一列的左右边。于是"对齐"在这里有了确切含义—— ←→ band.lines holds each column's edges, which gives 'aligned' an exact meaning here —
   * 不是看起来整齐，而是边缘落在同一批坐标上。 ←→ not merely looking tidy, but edges landing on the same set of coordinates.
   */
  function attachDrag(rendered) {
    const nearestLine = v => band.lines.reduce((a, b) =>
      Math.abs(b - v) < Math.abs(a - v) ? b : a, band.lines[0]);

    d3.select(ui.svg.node()).selectAll('g.mod')
      .attr('tabindex', 0).attr('role', 'application')
      .attr('aria-label', d => `${t(MODULES[d.id].title)} ${Math.round(d.x)},${Math.round(d.y)}`)
      .call(d3.drag()
        .on('start', function () { d3.select(this).classed('is-dragging', true); })
        .on('drag', function (event, d) {
          d.x = Math.max(0, Math.min(CANVAS.w - d.w, d.x + event.dx));
          d.y = Math.max(0, Math.min(CANVAS.h - d.h, d.y + event.dy));
          d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
        })
        .on('end', function (event, d) {
          d3.select(this).classed('is-dragging', false);
          if (mount.querySelector('#labSnap').checked) {
            d.x = Math.max(0, Math.min(CANVAS.w - d.w, nearestLine(d.x)));
            d.y = snap(d.y, 8);
          }
          update();
        }))
      // 键盘等效：方向键移动，Shift 加速。拖拽能做的，键盘都要能做。 ←→ Keyboard equivalent: arrows move, Shift accelerates. Anything the mouse can do, the keyboard must do too.
      .on('keydown', function (event, d) {
        const step = event.shiftKey ? 16 : 2;
        const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0],
                      ArrowUp: [0, -step], ArrowDown: [0, step] };
        const mv = map[event.key];
        if (!mv) return;
        event.preventDefault();
        d.x = Math.max(0, Math.min(CANVAS.w - d.w, d.x + mv[0]));
        d.y = Math.max(0, Math.min(CANVAS.h - d.h, d.y + mv[1]));
        update();
      });
  }
  // #endregion

  ui.on('labGrid', 'change', () => update(false));
  ui.on('labSnap', 'change', () => update(false));
  ui.on('labMess', 'click', () => {
    boxes = boxes.map((b, i) => ({ ...b,
      x: Math.max(0, b.x + (i % 2 ? 1 : -1) * (11 + (i * 7) % 23)),
      y: Math.max(0, b.y + ((i % 3) - 1) * 9) }));
    update();
  });
  ui.on('labReset', 'click', () => { boxes = targetLayout(grid); update(); });
  update();
}

/* ══ 5-3 Layout X-Ray ════════════════════════════════════════════════════ */
/**
 * 把布局的"看不见的部分"显式画出来：列线、每条边到列线的误差向量、
 * 被违反的约束、模块尺寸标注。
 *
 * 顶栏那颗「审视本站」按钮用的是同一套思路，只是对象换成了
 * 这个教学网站自己——见 js/xray-site.js。
 */
function demoXray(mount, { lang, section, reduced }) {
  const grid = readState().grid;
  const band = gridBand(grid.columns, CANVAS.w, { margin: grid.margin, gutter: grid.gutter });
  const saved = readState().layout;
  // 审计的是**你自己**在 5-2 拖出来的布局；没有就用略微打乱的目标版面
  const boxes = saved
    ? targetLayout(grid).map(b => ({ ...b, ...(saved[b.id] || {}) }))
    : targetLayout(grid).map((b, i) => ({ ...b, x: b.x + (i % 2 ? 9 : -7) }));

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      toggle('xLines', { zh: '列线', en: 'Column lines' }, true) +
      toggle('xErr', { zh: '对齐误差向量', en: 'Alignment error vectors' }, true) +
      toggle('xSize', { zh: '尺寸标注', en: 'Size labels' }, false) +
      toggle('xViol', { zh: '标出违反约束的模块', en: 'Flag violating modules' }, true) +
      readoutList(
        readout('xAlign', S.metrics.alignment),
        readout('xWorst', { zh: '偏得最远的一条边', en: 'Worst edge' }),
        readout('xViolN', S.metrics.violations)
      ),
    extra: `<p class="control-note">${pick(
      '顶栏的「审视本站」按钮用的是同一套办法，对象换成这个教学网站自己——课程讲的东西，得敢用在自己身上。',
      'The “X-ray this site” button in the top bar does the same thing to this teaching site itself. A course should be willing to turn its own tools on itself.')}</p>`
  });

  const ctx = ctxFor(lang, reduced);
  const rendered = renderBoard(ui.svg, boxes, ctx);
  pageFrame(ui.svg, PAGE);
  ui.svg.selectAll('rect.page-frame').lower();

  function update() {
    const nearestLine = v => band.lines.reduce((a, b) =>
      Math.abs(b - v) < Math.abs(a - v) ? b : a, band.lines[0]);
    const layer = ui.svg.selectAll('g.xray').data([0])
      .join(en => en.append('g').attr('class', 'xray'));

    // 列线
    const lines = mount.querySelector('#xLines').checked ? band.lines : [];
    layer.selectAll('line.guide').data(lines, d => d)
      .join(en => en.append('line').attr('class', 'guide'))
      .attr('x1', d => d).attr('x2', d => d).attr('y1', 0).attr('y2', CANVAS.h);

    // 误差向量：每张卡的左右边到最近列线
    const showErr = mount.querySelector('#xErr').checked;
    const errs = showErr ? boxes.flatMap(b => [
      { id: b.id + '-l', x1: b.x, x2: nearestLine(b.x), y: b.y + 16 },
      { id: b.id + '-r', x1: b.x + b.w, x2: nearestLine(b.x + b.w), y: b.y + 30 }
    ]).filter(e => Math.abs(e.x1 - e.x2) > 1) : [];
    layer.selectAll('line.error-vector').data(errs, d => d.id)
      .join(en => en.append('line').attr('class', 'error-vector'))
      .attr('x1', d => d.x1).attr('x2', d => d.x2).attr('y1', d => d.y).attr('y2', d => d.y);
    layer.selectAll('text.error-label').data(errs, d => d.id)
      .join(en => en.append('text').attr('class', 'error-label').attr('text-anchor', 'middle'))
      .attr('x', d => (d.x1 + d.x2) / 2).attr('y', d => d.y - 4)
      .text(d => `${d.x1 - d.x2 > 0 ? '+' : ''}${(d.x1 - d.x2).toFixed(0)}`);

    // 尺寸标注
    const sizes = mount.querySelector('#xSize').checked ? boxes : [];
    layer.selectAll('text.size-label').data(sizes, d => d.id)
      .join(en => en.append('text').attr('class', 'size-label'))
      .attr('x', d => d.x + 6).attr('y', d => d.y + d.h - 6)
      .text(d => `${Math.round(d.x)},${Math.round(d.y)} · ${Math.round(d.w)}×${Math.round(d.h)}`);

    // 违反约束的模块加红框
    const { violations } = constraintViolations(MODULES, rendered, ctx);
    const flag = mount.querySelector('#xViol').checked;
    const bad = new Set(flag ? violations.filter(v => v.severity === 'critical').map(v => v.module) : []);
    ui.svg.selectAll('g.mod').classed('is-violating', d => bad.has(d.id));

    const al = alignmentError(boxes.map(b => ({ id: b.id, x: b.x, w: b.w })), band.lines);
    ui.setReadout('xAlign', `${al.mean} px`, al.mean <= 2);
    ui.setReadout('xWorst', al.worst && Math.abs(al.worst.worst) > 0.5
      ? `${t(MODULES[al.worst.id].title)} ${al.worst.worst > 0 ? '+' : ''}${al.worst.worst.toFixed(0)}px`
      : '—', !al.worst || Math.abs(al.worst.worst) <= 2);
    ui.setReadout('xViolN', String(violations.filter(v => v.severity === 'critical').length),
      violations.filter(v => v.severity === 'critical').length === 0);

    ui.setStatus(
      al.mean <= 2
        ? `对齐误差均值 ${al.mean}px——边缘确实落在同一批列线上。X-Ray 的价值在于：它让"整齐"从感觉变成可核对的数字。`
        : `对齐误差均值 ${al.mean}px，最远的一条边偏了 ${Math.abs(al.worst.worst).toFixed(0)}px。红色向量指向它应该去的那条列线。`,
      al.mean <= 2
        ? `Mean alignment error ${al.mean}px — the edges really do sit on the same column lines. That is what the X-ray buys: "tidy" becomes a number you can check.`
        : `Mean alignment error ${al.mean}px; the worst edge is off by ${Math.abs(al.worst.worst).toFixed(0)}px. Each red vector points to the column line it belongs on.`
    );
  }

  ['xLines', 'xErr', 'xSize', 'xViol'].forEach(id => ui.on(id, 'change', update));
  update();
}

/* ══ 5-4 多屏验证与任务复测 ══════════════════════════════════════════════ */
/**
 * 主线在这里收口：用**同一道题**、在**你自己重构过的布局**上再测一次，
 * 与第 1-1 节的基线并排。
 *
 * 结论必须带限定：n=1、非受控、第二次有练习效应。
 * 它演示的是机制，不是实验结论——这句话在界面上始终可见。
 */
function demoMultiscreen(mount, { lang, section, reduced }) {
  const W = 900, H = 560;
  const task = data.taskBank.find(x => x.id === 'worst-completion');
  const grid = readState().grid;

  const ui = scaffold(mount, {
    w: W, h: H, label: t(section.title),
    controls:
      `<div class="task-block">
         <h5>${t(S.task.title)} · ${pick('复测', 'Re-test')}</h5>
         <p class="task-prompt">${t(task)}</p>
         <p class="task-sub" id="reState">${t(S.task.prompt)}</p>
         ${actions(button('reStart', S.start, true), button('reReset', S.retry))}
       </div>
       <hr class="control-sep">` +
      toggle('showAll', { zh: '同时显示三种屏宽', en: 'Show all three widths' }, false) +
      readoutList(
        readout('msViol', S.metrics.violations),
        readout('msNarrow', { zh: '最窄屏首屏模块', en: 'Modules on the narrow screen' })
      ),
    extra: `<div class="probe-host"></div>
      ${actions(button('resetAll', S.resetAll))}`
  });

  const ctx = ctxFor(lang, reduced);
  const probeHost = mount.querySelector('.probe-host');
  const stateEl = mount.querySelector('#reState');
  const st = readState();

  // 三档屏宽，几何全部来自 targetLayout + 按比例收缩
  const SCREENS = [
    { w: 1200, label: '1200px', frame: [16, 46, 430, 300] },
    { w: 768, label: '768px', frame: [462, 46, 250, 300] },
    { w: 375, label: '375px', frame: [728, 46, 156, 300] }
  ];

  function layoutAt(width) {
    // 宽度不足时按优先级堆叠：与第 4 章同一条规则
    if (width >= 1000) return targetLayout(grid);
    const order = st.priority && st.priority.length === 6
      ? st.priority : ['trend', 'ranking', 'completion', 'heat', 'devices', 'blurb'];
    const margin = width < 520 ? 14 : 20;
    const band = gridBand(width < 520 ? 1 : 2, CANVAS.w, { margin, gutter: 14 });
    const perRow = width < 520 ? 1 : 2;
    return order.map((id, i) => ({
      id, main: id === 'trend',
      x: band(i % perRow), w: band.spanWidth(1),
      y: margin + Math.floor(i / perRow) * 130, h: 118
    }));
  }

  function drawScreens() {
    const showAll = mount.querySelector('#showAll').checked;
    const list = showAll ? SCREENS : [SCREENS[0]];
    const narrowBoxes = layoutAt(375);
    const narrowHeight = Math.max(CANVAS.h, ...narrowBoxes.map(b => b.y + b.h + 20));
    const narrowCount = narrowBoxes.filter(b => b.y + b.h <= narrowHeight * 0.6).length;
    let totalViol = 0;

    SCREENS.forEach(sc => {
      const g = ui.svg.selectAll(`g.screen-${sc.w}`).data(list.includes(sc) ? [sc] : [])
        .join(en => en.append('g').attr('class', `screen-${sc.w} screen`));
      if (!list.includes(sc)) return;
      // 单屏复测优先保证可读；三屏仅用于响应式对照，不用于计时。
      const [fx, fy, fw, fh] = showAll ? sc.frame : [16, 30, 868, 515];
      g.selectAll('rect.device-shell').data([0])
        .join(en => en.append('rect').attr('class', 'device-shell').attr('rx', 10))
        .attr('x', fx).attr('y', fy).attr('width', fw).attr('height', fh);
      g.selectAll('text.device-label').data([sc.label])
        .join(en => en.append('text').attr('class', 'device-label'))
        .attr('x', fx + 2).attr('y', fy - 7).text(d => d);

      const boxes = layoutAt(sc.w);
      const natural = Math.max(CANVAS.h, ...boxes.map(b => b.y + b.h + 20));
      const k = Math.min(fw / CANVAS.w, fh / natural);
      const inner = g.selectAll('g.screen-inner').data([0])
        .join(en => en.append('g').attr('class', 'screen-inner'))
        .attr('transform', `translate(${fx},${fy}) scale(${k})`);
      const rendered = renderBoard(inner, boxes, ctx);
      const { violations } = constraintViolations(MODULES, rendered, ctx);
      totalViol += violations.filter(v => v.severity === 'critical').length;
    });

    ui.setReadout('msViol', String(totalViol), totalViol === 0);
    ui.setReadout('msNarrow', `${narrowCount}/6`);
  }

  /* ── 复测 ── */
  const retestSvg = ui.svg;
  const probe = createProbe(retestSvg, {
    task,
    onTick: ({ misclicks }) => {
      stateEl.textContent = `${t(S.task.wrong)} · ${t(S.task.misclicks)} ${misclicks}`;
    },
    onFinish: (run) => {
      mount.querySelector('#showAll').disabled = false;
      stateEl.textContent = t(S.task.correct);
      patchState({ retest: run });
      const s2 = readState();
      renderCompare(probeHost, { baseline: s2.baseline, retest: run }, lang);
      if (s2.baseline) {
        const pct = Math.round((s2.baseline.ms - run.ms) / s2.baseline.ms * 100);
        ui.setStatus(
          pct > 0
            ? `基线 ${fmtMs(s2.baseline.ms)} → 复测 ${fmtMs(run.ms)}，快了约 ${pct}%。排序与高亮把"逐行读 8 个数字"变成了"看最后一行"。` +
              `注意：这是单次自测，第二次已熟悉数据，存在练习效应——它演示机制，不是实验结论。`
            : `基线 ${fmtMs(s2.baseline.ms)} → 复测 ${fmtMs(run.ms)}。这次没有变快；单次自测波动很大，结论要谨慎。`,
          pct > 0
            ? `Baseline ${fmtMs(s2.baseline.ms)} → re-test ${fmtMs(run.ms)}, about ${pct}% faster. Sorting and highlighting turned "read eight numbers" into "look at the last row". ` +
              `Note: a single self-test with a practice effect — it shows a mechanism, not a result.`
            : `Baseline ${fmtMs(s2.baseline.ms)} → re-test ${fmtMs(run.ms)}. Not faster this time; a single run varies a lot, so be careful with conclusions.`
        );
      }
    }
  });

  ui.on('reStart', 'click', () => {
    if (mount.querySelector('#showAll').checked) {
      mount.querySelector('#showAll').checked = false;
      drawScreens();
    }
    stateEl.textContent = t(S.task.running);
    mount.querySelector('#showAll').disabled = true;
    probe.start();
  });
  ui.on('reReset', 'click', () => {
    probe.cancel();
    mount.querySelector('#showAll').disabled = false;
    stateEl.textContent = t(S.task.prompt);
    retestSvg.selectAll('g.probe-path').remove();
  });
  ui.on('showAll', 'change', drawScreens);
  ui.on('resetAll', 'click', () => {
    probe.cancel();
    mount.querySelector('#showAll').disabled = false;
    resetState();
    stateEl.textContent = t(S.task.prompt);
    renderCompare(probeHost, { baseline: null, retest: null }, lang);
    drawScreens();
  });

  drawScreens();
  renderCompare(probeHost, { baseline: st.baseline, retest: st.retest }, lang);
  ui.setStatus(
    st.baseline
      ? '同一道题，在你重构过的布局上再做一次。两次结果会并排显示。'
      : t(S.task.noBaseline),
    st.baseline
      ? 'The same question, now on the layout you rebuilt. Both runs are shown side by side.'
      : t(S.task.noBaseline)
  );
}

/* ── 注册 ──────────────────────────────────────────────────────────────── */
const CH5 = '../js/demos/ch5.js';
const CHARTS = '../js/charts.js';

export const DEMOS = {
  beforeafter: {
    render: demoBeforeAfter,
    snippets: [
      { url: CH5, name: 'ch5-replay',
        title: { zh: '关键点 1 · 每阶段聚焦一类修改', en: 'Key 1 · One type of change at a time' },
        why: { zh: '把排序、面积、对齐和分组分开回放，才能看清每一步改了什么。',
               en: 'Replay ordering, size, alignment, and grouping separately so each step stays visible.' } },
      { url: CHARTS, name: 'trend-join',
        title: { zh: '关键点 2 · 对象连续性让人跟得住', en: 'Key 2 · Object constancy keeps the eye with it' },
        why: { zh: '数据键始终是模块 id，模块是移动过去的而不是重建的，才看得出"同一块东西去了哪"。',
               en: 'The key stays the module id, so modules move rather than being rebuilt — you can follow where each one went.' } }
    ]
  },
  lab: {
    render: demoLab,
    snippets: [
      { url: CH5, name: 'ch5-snap',
        title: { zh: '关键点 1 · 吸附到列线，不是吸附到任意格', en: 'Key 1 · Snap to the columns, not to an arbitrary step' },
        why: { zh: 'band.lines 就是第 2 章那套列线，于是"对齐"有了确切含义，而不只是看起来整齐。',
               en: 'band.lines are the very columns from chapter 2, so "aligned" has an exact meaning rather than merely looking tidy.' } },
      { url: '../js/metrics.js', name: 'align',
        title: { zh: '关键点 2 · 反馈必须即时且可解释', en: 'Key 2 · Feedback must be immediate and explainable' },
        why: { zh: '每次松手都重算对齐误差与约束违反，并指出下一步该修哪一项。',
               en: 'Every release recomputes the alignment error and violations, and names the next thing to fix.' } }
    ]
  },
  xray: {
    render: demoXray,
    snippets: [
      { url: '../js/xray-site.js', name: 'xray-site',
        title: { zh: '关键点 1 · 同一套办法用在本站自己身上', en: 'Key 1 · The same method, turned on this site' },
        why: { zh: '用 getBoundingClientRect() 量真实 DOM，课程讲的东西得敢用在自己身上。',
               en: 'It measures the real DOM with getBoundingClientRect(): a course should be willing to turn its tools on itself.' } },
      { url: '../js/metrics.js', name: 'snap',
        title: { zh: '关键点 2 · 误差是有符号的距离', en: 'Key 2 · The error is a signed distance' },
        why: { zh: '有符号才能画成指向正确列线的向量，学习者知道该往哪边挪。',
               en: 'Only a signed value can be drawn as a vector pointing at the right column, telling you which way to move.' } }
    ]
  },
  multiscreen: {
    render: demoMultiscreen,
    snippets: [
      { url: '../js/task-probe.js', name: 'probe-path',
        title: { zh: '关键点 1 · 用同一道题做前后对照', en: 'Key 1 · Same question, before and after' },
        why: { zh: '题目、数据、判定方式完全一致，两次结果才有可比性。',
               en: 'Identical question, data and scoring — otherwise the two runs are not comparable.' } },
      { url: '../js/state.js', name: 'compare',
        title: { zh: '关键点 2 · 结论必须带着限定一起给', en: 'Key 2 · Ship the caveat with the conclusion' },
        why: { zh: 'n=1、非受控、有练习效应。这句话和数字一样重要，所以写进了返回值里。',
               en: 'n=1, uncontrolled, with a practice effect. That sentence matters as much as the number, so it travels inside the result.' } }
    ]
  }
};
