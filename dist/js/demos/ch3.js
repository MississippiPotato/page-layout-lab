/**
 * demos/ch3.js —— 第 3 章「空间分组与页面组成」的四个演示。
 *
 * 本章的演示原型：**d3.forceSimulation**。
 *
 * 一个必须说清楚的前提：力导向在这里是**演示工具**，不是排版工具。
 * 它的作用是让"组内更近、组间更远"这条规则自己把模块推到位，
 * 好让学习者看见分组是从哪一刻开始被感知的。
 * 真实页面仍然应该落回栅格（第 2 章）——本章末尾会把结果吸附回去。
 */

import d3 from '../d3.js';
import * as data from '../../data/campus.js';
import { MODULES, renderBoard, gridBand, VIZ } from '../charts.js';
import { constraintViolations } from '../metrics.js';
import { S } from '../strings.js';
import { pick, t } from '../i18n.js';
import { scaffold, range, toggle, button, actions, readout, readoutList, pageFrame } from './kit.js';
import { readState, patchState } from '../state.js';

const CANVAS = { w: 820, h: 560 };
/** 小测画布：要足够高，"合格"才可能出现；否则三个方案全都跌破下限。 */
const QUIZ_H = 430;
/** 小测画布比本章其余演示更宽：820px 放不下一个**合格**的监控型版面
 *  （主图拿不到它推导出来的 426px），三个方案就会全都不合格，
 *  「哪个更好」退化成「哪个烂得少」。 */
const QUIZ_W = 980;

/**
 * 两个语义组：
 *   A 组「今天出了什么事」——趋势 + 完成率 + 排行（诊断链路）
 *   B 组「背景信息」——热力图 + 设备 + 说明（参考信息）
 */
const GROUPS = {
  trend: 0, completion: 0, ranking: 0,
  heat: 1, devices: 1, blurb: 1
};
const GROUP_NAMES = [
  { zh: '诊断链路', en: 'Diagnostic path' },
  { zh: '参考信息', en: 'Reference' }
];

/** 模块在本章统一使用的尺寸（力导向只改位置，不改大小）。 */
const SIZE = {
  trend:      { w: 300, h: 168 },
  completion: { w: 150, h: 150 },
  ranking:    { w: 232, h: 226 },
  heat:       { w: 246, h: 150 },
  devices:    { w: 214, h: 96  },
  blurb:      { w: 206, h: 138 }
};

const ctxFor = (lang, reduced) => ({ lang, data, reduced, rankSorted: true, highlightWorst: true });

// #region snippet:ch3-rectcollide
/**
 * 矩形碰撞力。
 *
 * d3.forceCollide 只支持圆形，用外接圆近似矩形会出大问题：
 * 300x168 的主图外接圆半径 172px，于是它和**任何**模块都至少隔开 172px，
 * 组内间隙被撑到 125px，分组强度算出来只有 0.24 —— 明明看着是分开的两组，
 * 指标却说没分组。这不是布局的问题，是度量模型不对。
 *
 * 这里按矩形真实边界判重叠，并沿**重叠较小的轴**分开（位移最小），
 * 于是组内间隙 ≈ pad，间距比才反映真实的视觉关系。
 * 模块数只有 6，O(n^2) 足够，不需要四叉树。
 */
function forceRectCollide(pad = 8) {
  let nodes = [];
  function force() {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 + pad - Math.abs(dx);   // x 向重叠量
        const oy = (a.h + b.h) / 2 + pad - Math.abs(dy);   // y 向重叠量
        if (ox <= 0 || oy <= 0) continue;                  // 没有重叠
        if (ox < oy) {                                     // 沿位移更小的轴推开
          const s = (dx < 0 ? -1 : 1) * ox / 2;
          a.x -= s; b.x += s;
        } else {
          const s = (dy < 0 ? -1 : 1) * oy / 2;
          a.y -= s; b.y += s;
        }
      }
    }
  }
  force.initialize = (n) => { nodes = n; };
  return force;
}
// #endregion

// #region snippet:ch3-force
/**
 * 用力导向让"接近原则"自己发生。 ←→ Let the proximity principle happen by itself, via a force layout.
 *
 * 三个力各司其职： ←→ Three forces, each with one job:
 *   forceX / forceY  把每个模块拉向它**所属组**的中心 —— 组内靠拢 ←→ forceX / forceY pull each module toward its own group's centre — tighten within
 *   forceCollide     不让模块重叠 —— 给出物理下限 ←→ collision keeps modules from overlapping — the physical floor
 *   组中心之间的距离  由 betweenGap 控制 —— 组间推开 ←→ the distance between group centres is betweenGap — push groups apart
 *
 * 关键在于：组内距离与组间距离的**比值**决定分组能不能被感知， ←→ What matters is the RATIO of within- to between-group distance, not any absolute value:
 * 而不是任何一个绝对数值。 ←→ that ratio is what decides whether the grouping can be perceived.
 */
function layoutByForce({ withinGap, betweenGap }, ids) {
  const cx = CANVAS.w / 2, cy = CANVAS.h / 2;
  const centres = [
    { x: cx - betweenGap / 2, y: cy },
    { x: cx + betweenGap / 2, y: cy }
  ];

  const nodes = ids.map(id => ({
    id, ...SIZE[id], g: GROUPS[id],
    x: centres[GROUPS[id]].x + (Math.random() - 0.5) * 40,
    y: centres[GROUPS[id]].y + (Math.random() - 0.5) * 40
  }));

  const sim = d3.forceSimulation(nodes)
    .force('x', d3.forceX(d => centres[d.g].x).strength(0.34))
    .force('y', d3.forceY(d => centres[d.g].y).strength(0.34))
    // 用矩形碰撞而不是 d3.forceCollide 的圆形近似——原因见 forceRectCollide ←→ Rectangular collision instead of d3.forceCollide's circular approximation — see forceRectCollide
    .force('collide', forceRectCollide(withinGap))
    .stop();

  // 同步跑完，不做逐帧动画：本演示要的是"参数→结果"，不是过程动画 ←→ Run the simulation synchronously: this demo is about parameter-to-result, not about watching it settle
  for (let i = 0; i < 220; i++) sim.tick();

  // 收束到画布内 ←→ clamp into the canvas
  for (const n of nodes) {
    n.x = Math.max(n.w / 2 + 10, Math.min(CANVAS.w - n.w / 2 - 10, n.x));
    n.y = Math.max(n.h / 2 + 10, Math.min(CANVAS.h - n.h / 2 - 10, n.y));
  }
  return nodes;
}
// #endregion

/** 力导向给的是中心点，看板要的是左上角。 */
const toBoxes = (nodes) => nodes.map(n => ({
  id: n.id, main: n.id === 'trend',
  x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h
}));

// #region snippet:ch3-ratio
/**
 * 分组强度 = 组间最近邻间隙的均值 / 组内最近邻间隙的均值。 ←→ Grouping strength = mean nearest between-group gap / mean nearest within-group gap.
 *
 * 为什么用**最近邻**而不是"组内最大间隙"： ←→ Why nearest-neighbour rather than 'largest within-group gap':
 * 接近原则是就近生效的——你感觉两块属于一组，是因为它们彼此挨着， ←→ proximity acts locally. Two modules feel related because they sit next to each other,
 * 而不是因为组内每一对都挨着。一组里有三块大模块时， ←→ not because every pair in the group is close. With three large modules in a group,
 * 最远的两块天然就隔得远，用"组内最大间隙"当分母， ←→ the outermost two are naturally far apart, so using the largest gap as the denominator
 * 会把明明看得出分组的版面判成"没分组"（实测过：0.24，与肉眼结论相反）。 ←→ judges a visibly grouped layout as ungrouped (measured: 0.24, contradicting the eye).
 *
 * 间隙取矩形之间的真实边距（不是质心距离），所以两块紧挨着时是 0。 ←→ The gap is the real edge-to-edge distance (not centroid distance), so touching modules measure 0.
 */
function groupingRatio(boxes) {
  const gap = (a, b) => Math.hypot(
    Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))),
    Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)))
  );
  const nearest = (b, sameGroup) => {
    const others = boxes.filter(o => o !== b &&
      (GROUPS[o.id] === GROUPS[b.id]) === sameGroup);
    return others.length ? Math.min(...others.map(o => gap(b, o))) : null;
  };
  const mean = (arr) => arr.length ? arr.reduce((a, v) => a + v, 0) / arr.length : 0;

  const within = mean(boxes.map(b => nearest(b, true)).filter(v => v !== null));
  const between = mean(boxes.map(b => nearest(b, false)).filter(v => v !== null));
  return { withinMax: within, betweenMin: between, ratio: within > 0 ? between / within : Infinity };
}
// #endregion

/** 共同区域：用 d3.polygonHull 把每组的外轮廓包起来。 */
function drawRegions(svg, boxes, show, accent) {
  const layer = svg.selectAll('g.region-layer').data([0])
    .join(en => en.insert('g', ':first-child').attr('class', 'region-layer'));
  layer.style('display', show ? null : 'none');
  if (!show) return;

  const groups = d3.groups(boxes, b => GROUPS[b.id]);
  const hulls = groups.map(([g, items]) => {
    // 取每张卡的四个角，外扩一点，再求凸包
    const pad = 14;
    const pts = items.flatMap(b => [
      [b.x - pad, b.y - pad], [b.x + b.w + pad, b.y - pad],
      [b.x + b.w + pad, b.y + b.h + pad], [b.x - pad, b.y + b.h + pad]
    ]);
    return { g, hull: d3.polygonHull(pts) };
  });

  layer.selectAll('path.region').data(hulls, d => d.g)
    .join(en => en.append('path').attr('class', 'region'))
    .attr('d', d => `M${d.hull.join('L')}Z`);
  layer.selectAll('text.region-label').data(hulls, d => d.g)
    .join(en => en.append('text').attr('class', 'region-label'))
    .attr('x', d => d3.min(d.hull, p => p[0]) + 10)
    .attr('y', d => d3.min(d.hull, p => p[1]) + 16)
    .text(d => t(GROUP_NAMES[d.g]));
}

/* ══ 3-1 接近原则 ════════════════════════════════════════════════════════ */
function demoProximity(mount, { lang, section, reduced }) {
  let withinGap = 10, betweenGap = 330;

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      range('within', { zh: '组内间距', en: 'Within-group gap' }, 4, 60, withinGap, 2, 'px') +
      range('between', { zh: '组中心距离', en: 'Between-group distance' }, 120, 460, betweenGap, 10, 'px') +
      readoutList(
        readout('gWithin', { zh: '组内最近邻间隙', en: 'Within-group nearest gap' }),
        readout('gBetween', { zh: '组间最近邻间隙', en: 'Between-group nearest gap' }),
        readout('gRatio', { zh: '分组强度（间距比）', en: 'Grouping strength (ratio)' })
      ),
    extra: `<p class="control-note">${pick(
      '力导向在这里是演示工具，不是排版工具——它让"组内更近、组间更远"自己把模块推到位。真实页面仍应落回栅格（第 2 章）。',
      'The force layout here is a demonstration device, not a typesetting tool: it lets "closer within, farther between" position the modules itself. A real page still lands on the grid from chapter 2.')}</p>`
  });

  const ctx = ctxFor(lang, reduced);

  function update() {
    const nodes = layoutByForce({ withinGap, betweenGap }, Object.keys(SIZE));
    const boxes = toBoxes(nodes);
    pageFrame(ui.svg, { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h });
    ui.svg.selectAll('rect.page-frame').lower();
    renderBoard(ui.svg, boxes, ctx);
    drawRegions(ui.svg, boxes, false);

    const g = groupingRatio(boxes);
    const ok = g.ratio >= 1.5;
    ui.setReadout('gWithin', `${g.withinMax.toFixed(0)} px`);
    ui.setReadout('gBetween', `${(g.betweenMin === Infinity ? 0 : g.betweenMin).toFixed(0)} px`);
    ui.setReadout('gRatio', `${g.ratio === Infinity ? '∞' : g.ratio.toFixed(2)} ×`, ok);

    ui.setStatus(
      ok
        ? `组间间隙是组内的 ${g.ratio.toFixed(2)} 倍，两组关系一眼可辨——分组靠的是距离的比值，不是任何一个绝对数值。`
        : `比值只有 ${g.ratio.toFixed(2)}，六个模块看起来仍是一片。把组内拉近、或把两组推开，任一方向都能提高比值。`,
      ok
        ? `The between-group gap is ${g.ratio.toFixed(2)}x the within-group gap, so the two groups separate at a glance. Grouping comes from the ratio, not any absolute value.`
        : `The ratio is only ${g.ratio.toFixed(2)} — the six modules still read as one field. Tighten within, or push the groups apart; either raises the ratio.`
    );
  }

  ui.onRange('within', v => { withinGap = v; update(); }, v => `${v}px`);
  ui.onRange('between', v => { betweenGap = v; update(); }, v => `${v}px`);
  update();
}

/* ══ 3-2 共同区域与相似性 ════════════════════════════════════════════════ */
/**
 * 三路对照：只靠接近 / 接近 + 共同区域 / 只靠颜色。
 * 结论是可验证的：共同区域即便在间距比很低时也能建立分组，
 * 而只靠颜色在灰度打印或色觉障碍下会整个失效。
 */
function demoRegion(mount, { lang, section, reduced }) {
  let mode = 'region';
  let betweenGap = 190;   // 故意给一个偏低的间距比，好看出区域的作用

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      `<div class="control-group"><label for="gmode">${pick('分组线索', 'Grouping cue')}</label>
        <select id="gmode">
          <option value="proximity">${pick('只靠接近', 'Proximity only')}</option>
          <option value="region" selected>${pick('接近 + 共同区域', 'Proximity + common region')}</option>
          <option value="colour">${pick('只靠颜色', 'Colour only')}</option>
        </select></div>` +
      range('between2', { zh: '组中心距离', en: 'Between-group distance' }, 120, 460, betweenGap, 10, 'px') +
      toggle('grayscale', { zh: '模拟灰度打印', en: 'Simulate greyscale print' }) +
      readoutList(
        readout('rRatio', { zh: '间距比（组间/组内）', en: 'Gap ratio (between/within)' }),
        readout('rCue', { zh: '当前生效的线索', en: 'Cue actually working' })
      ),
    extra: `<p class="control-note">${pick(
      '打开灰度模拟，再把线索切到"只靠颜色"——分组会整个消失。颜色可以确认分组，但不应该是唯一的分组依据。',
      'Turn on greyscale and switch the cue to "colour only": the grouping disappears entirely. Colour may confirm a grouping, but must never be its only carrier.')}</p>`
  });

  const ctx = ctxFor(lang, reduced);
  const canvas = mount.querySelector('.demo-canvas');

  function update() {
    const nodes = layoutByForce({ withinGap: 12, betweenGap }, Object.keys(SIZE));
    const boxes = toBoxes(nodes);
    pageFrame(ui.svg, { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h });
    ui.svg.selectAll('rect.page-frame').lower();
    renderBoard(ui.svg, boxes, ctx);
    drawRegions(ui.svg, boxes, mode === 'region');

    // 只靠颜色：给每组的卡片底板着色
    const gray = mount.querySelector('#grayscale').checked;
    canvas.classList.toggle('is-grayscale', gray);
    ui.svg.selectAll('g.mod').select('rect.mod-bg')
      .attr('fill', function () {
        if (mode !== 'colour') return null;
        const id = this.parentNode.getAttribute('data-module');
        return d3.color(VIZ.series[GROUPS[id]]).copy({ opacity: 0.16 });
      });

    const g = groupingRatio(boxes);
    ui.setReadout('rRatio', `${g.ratio === Infinity ? '∞' : g.ratio.toFixed(2)} ×`, g.ratio >= 1.5);

    const cueWorks =
      mode === 'region' ? true :
      mode === 'colour' ? !gray :
      g.ratio >= 1.5;
    ui.setReadout('rCue',
      cueWorks ? pick('有效', 'Working') : pick('失效', 'Not working'), cueWorks);

    ui.setStatus(
      mode === 'region'
        ? `间距比只有 ${g.ratio.toFixed(2)}，单靠接近已经不够，但共同区域仍然把两组分开了——区域是比距离更强的分组线索。`
        : mode === 'colour'
          ? (gray
            ? '灰度下颜色线索完全消失，六个模块重新变成一片。这正是"不能只用颜色分组"的原因。'
            : `颜色确实能分组，但它是唯一线索时很脆弱：打开"灰度打印"看看会发生什么。`)
          : (g.ratio >= 1.5
            ? `间距比 ${g.ratio.toFixed(2)}，只靠接近就足够了。`
            : `间距比只有 ${g.ratio.toFixed(2)}，只靠接近已经看不出分组——需要加上共同区域。`),
      mode === 'region'
        ? `The gap ratio is only ${g.ratio.toFixed(2)}, too low for proximity alone, yet the common region still separates the groups — enclosure is a stronger cue than distance.`
        : mode === 'colour'
          ? (gray
            ? 'In greyscale the colour cue vanishes and the six modules read as one field again — which is why colour must never be the only grouping cue.'
            : 'Colour does group, but it is fragile as the only cue. Turn on greyscale print and watch.')
          : (g.ratio >= 1.5
            ? `A gap ratio of ${g.ratio.toFixed(2)} — proximity alone is enough.`
            : `A gap ratio of just ${g.ratio.toFixed(2)} — proximity alone no longer reads; add a common region.`)
    );
  }

  ui.on('gmode', 'change', e => { mode = e.target.value; update(); });
  ui.on('grayscale', 'change', update);
  ui.onRange('between2', v => { betweenGap = v; update(); }, v => `${v}px`);
  update();
}

/* ══ 3-3 密度与留白的平衡 ════════════════════════════════════════════════ */
/**
 * 留白不是"没放东西的地方"，是有成本也有收益的资源。
 * 这里两项都实测：首屏覆盖率（模块真实占地 / 画布面积）与
 * 完成诊断任务需要的扫视距离（按任务顺序的质心连线总长）。
 */
function demoDensity(mount, { lang, section, reduced }) {
  let pad = 16, count = 6;

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      range('pad', { zh: '模块间距', en: 'Module spacing' }, 4, 48, pad, 2, 'px') +
      range('count', { zh: '首屏模块数', en: 'Modules on first screen' }, 3, 6, count) +
      readoutList(
        readout('dCover', { zh: '首屏内容覆盖率', en: 'First-screen coverage' }),
        readout('dScan', { zh: '任务扫视距离', en: 'Scan distance for the task' }),
        readout('dViol', S.metrics.violations)
      ),
    extra: `<p class="control-note">${pick(
      '覆盖率太低是浪费，太高是拥挤；扫视距离越长，完成同一个任务越费力。两者会互相牵制——这正是需要权衡的地方。',
      'Too little coverage wastes the screen; too much crowds it. A longer scan path makes the same task harder. The two pull against each other — that is the trade-off.')}</p>`
  });

  const ctx = ctxFor(lang, reduced);
  // 任务顺序：先看趋势，再看完成率，最后定位排行
  const TASK_PATH = ['trend', 'completion', 'ranking'];

  function update() {
    const ids = Object.keys(SIZE).slice(0, count);
    const band = gridBand(12, CANVAS.w, { margin: pad + 8, gutter: pad });
    const col = (i, n) => ({ x: band(i), w: band.spanWidth(n) });
    const top = pad + 8, r1 = 200, gap = pad;
    const plan = [
      { id: 'trend', ...col(0, 7), y: top, h: r1, main: true },
      { id: 'completion', ...col(7, 5), y: top, h: r1 },
      { id: 'ranking', ...col(0, 5), y: top + r1 + gap, h: 226 },
      { id: 'heat', ...col(5, 4), y: top + r1 + gap, h: 226 },
      { id: 'devices', ...col(9, 3), y: top + r1 + gap, h: 108 },
      { id: 'blurb', ...col(9, 3), y: top + r1 + gap + 108 + gap, h: 118 }
    ].filter(p => ids.includes(p.id));

    pageFrame(ui.svg, { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h });
    ui.svg.selectAll('rect.page-frame').lower();
    const boxes = renderBoard(ui.svg, plan, ctx);

    // #region snippet:ch3-density
    // 覆盖率：模块真实占地面积之和 / 画布面积。留白 = 1 - 覆盖率。 ←→ Coverage: total real module area / canvas area. Whitespace = 1 - coverage.
    const covered = boxes.reduce((a, b) => a + b.w * b.h, 0);
    const coverage = covered / (CANVAS.w * CANVAS.h);

    // 扫视距离：按**任务顺序**连接各模块质心的折线总长—— ←→ Scan distance: the polyline through module centroids in TASK order —
    // 不是任意两两距离，因为用户不会随机看，他按任务走。 ←→ not arbitrary pairwise distances, because users do not look randomly; they follow the task.
    const centre = Object.fromEntries(boxes.map(b => [b.id, [b.x + b.w / 2, b.y + b.h / 2]]));
    const stops = TASK_PATH.filter(id => centre[id]).map(id => centre[id]);
    const scan = d3.pairs(stops).reduce((a, [p, q]) => a + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
    // #endregion

    // 把扫视路径画出来
    const layer = ui.svg.selectAll('g.scan-layer').data([0])
      .join(en => en.append('g').attr('class', 'scan-layer'));
    layer.selectAll('path.scan-path').data(stops.length > 1 ? [stops] : [])
      .join(en => en.append('path').attr('class', 'scan-path'))
      .attr('d', d3.line());
    layer.selectAll('circle.scan-stop').data(stops, (d, i) => i)
      .join(en => en.append('circle').attr('class', 'scan-stop').attr('r', 9))
      .attr('cx', d => d[0]).attr('cy', d => d[1]);
    layer.selectAll('text.scan-num').data(stops, (d, i) => i)
      .join(en => en.append('text').attr('class', 'scan-num').attr('text-anchor', 'middle'))
      .attr('x', d => d[0]).attr('y', d => d[1] + 4).text((d, i) => i + 1);

    const { violations } = constraintViolations(MODULES, boxes, ctx);
    const crit = violations.filter(v => v.severity === 'critical');
    const okCover = coverage >= 0.38 && coverage <= 0.72;

    ui.setReadout('dCover', `${(coverage * 100).toFixed(0)} %`, okCover);
    ui.setReadout('dScan', `${scan.toFixed(0)} px`);
    ui.setReadout('dViol', String(crit.length), crit.length === 0);

    ui.setStatus(
      crit.length
        ? `间距 ${pad}px 下已有 ${crit.length} 条硬约束被违反：${crit[0][lang]}留白不足会先压垮模块自己。`
        : coverage > 0.72
          ? `覆盖率 ${(coverage * 100).toFixed(0)}%，页面偏密；扫视距离 ${scan.toFixed(0)}px 虽短，但拥挤会让分组线索失效。`
          : coverage < 0.38
            ? `覆盖率仅 ${(coverage * 100).toFixed(0)}%，留白过多；扫视距离被拉到 ${scan.toFixed(0)}px，同一个任务要看得更远。`
            : `覆盖率 ${(coverage * 100).toFixed(0)}%、扫视距离 ${scan.toFixed(0)}px，两者都在合理区间。`,
      crit.length
        ? `At ${pad}px spacing, ${crit.length} hard constraint(s) already fail: ${crit[0].en}. Too little whitespace breaks the modules themselves first.`
        : coverage > 0.72
          ? `Coverage ${(coverage * 100).toFixed(0)}% — dense. The ${scan.toFixed(0)}px scan path is short, but crowding defeats the grouping cues.`
          : coverage < 0.38
            ? `Coverage only ${(coverage * 100).toFixed(0)}% — too airy. The scan path stretches to ${scan.toFixed(0)}px for the same task.`
            : `Coverage ${(coverage * 100).toFixed(0)}% with a ${scan.toFixed(0)}px scan path — both in a reasonable range.`
    );
  }

  ui.onRange('pad', v => { pad = v; update(); }, v => `${v}px`);
  ui.onRange('count', v => { count = v; update(); });
  update();
}

/* ══ 3-4 选择合适的页面组成（小测） ══════════════════════════════════════ */
/**
 * 教学装置借自参考课程的「3 错 1 对」小测，但判分方式不同：
 * 参考课程的答案是预设的，这里的**对错由实测决定**。
 *
 * 量什么，比怎么量更重要。
 * 早期版本只量「扫视距离」，结果单栏阅读版胜出——因为纵向排布路径最短。
 * 但这个任务是**每天扫一眼**，它要的是"同屏都在"，不是"路径最短"。
 * 于是首要指标改成**首屏完整可见的模块数**：单栏版必须滚动，
 * 折线以下的模块在监控场景里等于不存在。
 *
 * 这也是本节真正要教的：先想清楚任务要什么，再决定拿什么去衡量版面。
 */
function demoComposition(mount, { lang, section, reduced }) {
  const TASK = {
    zh: '每天开屏先扫一眼：活跃是否异常，哪门课完成率最低',
    en: 'Every morning, at a glance: is activity abnormal, and which course lags?'
  };
  const TASK_PATH = ['trend', 'completion', 'ranking'];

  const OPTIONS = [
    { id: 'monitor', zh: '监控型', en: 'Monitor',
      zhDesc: '横向铺开，六块同屏', enDesc: 'Spread wide; all six on one screen' },
    { id: 'article', zh: '阅读型', en: 'Reading',
      zhDesc: '单栏纵向，像一篇报告', enDesc: 'A single vertical column, like a report' },
    { id: 'form', zh: '录入型', en: 'Input',
      zhDesc: '窄栏分步，每次聚焦一块', enDesc: 'Narrow stepped column, one focus at a time' }
  ];

  const ui = scaffold(mount, {
    w: QUIZ_W, h: QUIZ_H, label: t(section.title),
    controls:
      '<div class="quiz-block">' +
        '<h5>' + pick('先选，再看结果', 'Choose first, then see why') + '</h5>' +
        '<p class="task-prompt">' + t(TASK) + '</p>' +
        '<p class="task-sub">' + pick(
           '三种页面组成，哪一种最适合这个任务？先凭直觉选一个。',
           'Which composition best suits that task? Commit to one first.') + '</p>' +
        '<div class="quiz-options" id="quizOpts">' +
          OPTIONS.map(o =>
            '<button class="quiz-opt" data-opt="' + o.id + '">' +
              '<b>' + (lang === 'zh' ? o.zh : o.en) + '</b>' +
              '<span>' + (lang === 'zh' ? o.zhDesc : o.enDesc) + '</span></button>').join('') +
        '</div>' +
        '<div class="quiz-result" id="quizResult"></div>' +
      '</div>',
    extra: '<p class="control-note">' + pick(
      '结果先看有没有违反图表的可读约束，再看首屏能完整看到几块，最后比较扫视距离。折线以下的内容还在，但需要滚动。',
      'The result first checks chart constraints, then how many modules fit above the fold, and finally scan distance. Content below the fold remains available but needs scrolling.') + '</p>'
  });

  const ctx = ctxFor(lang, reduced);
  const FOLD = 330;   // 首屏折线：以下的内容需要滚动才能看到

  /** 三种组成各有自己的**自然高度**——单栏版本来就更高，这正是它的代价。 */
  function layoutFor(kind) {
    const band = gridBand(12, QUIZ_W, { margin: 20, gutter: 14 });
    const col = (i, n) => ({ x: band(i), w: band.spanWidth(n) });
    if (kind === 'monitor') {
      // 横向铺开：六块全部在折线以上，且每块都拿到了自己要求的尺寸
      return [
        { id: 'trend', ...col(0, 6), y: 14, h: 150, main: true },
        { id: 'completion', ...col(6, 3), y: 14, h: 150 },
        { id: 'ranking', ...col(9, 3), y: 14, h: 223 },
        { id: 'heat', ...col(0, 4), y: 176, h: 138 },
        { id: 'devices', ...col(4, 4), y: 176, h: 88 },
        { id: 'blurb', ...col(8, 4), y: 176, h: 138 }
      ];
    }
    if (kind === 'article') {
      // 单栏纵向：扫视路径最短，但整版更高——折线以下的四块要滚动才看得到
      return [
        { id: 'trend', ...col(2, 8), y: 14, h: 150, main: true },
        { id: 'blurb', ...col(2, 8), y: 176, h: 92 },
        { id: 'ranking', ...col(2, 8), y: 280, h: 240 },
        { id: 'completion', ...col(2, 3), y: 532, h: 140 },
        { id: 'heat', ...col(5, 3), y: 532, h: 140 },
        { id: 'devices', ...col(8, 2), y: 532, h: 92 }
      ];
    }
    // 逐步录入：一次只聚焦一块，适合填写，最不适合"扫一眼"
    return [
      { id: 'completion', ...col(4, 4), y: 14, h: 140 },
      { id: 'trend', ...col(4, 4), y: 166, h: 150, main: true },
      { id: 'ranking', ...col(4, 4), y: 328, h: 240 },
      { id: 'heat', ...col(4, 4), y: 580, h: 130 },
      { id: 'devices', ...col(1, 3), y: 166, h: 92 },
      { id: 'blurb', ...col(1, 3), y: 270, h: 140 }
    ];
  }

  // #region snippet:ch3-compose
  /**
   * 当场量每个方案的三项指标：
   *   1. critical 违反数      —— 模块有没有跌破自己的可读下限
   *   2. 首屏完整可见模块数   —— 整块都在折线以上才算数
   *   3. 任务扫视距离         —— 按任务顺序连质心
   *
   * 排序用 (1) → (2) → (3)：先看能不能读，再看是不是同屏，最后才比路径长短。
   * 这个优先级本身就是结论：**衡量什么，由任务决定**。
   */
  function evaluate() {
    const probe = d3.select(mount).select('.demo-canvas')
      .selectAll('svg.eval-probe').data([0])
      .join(en => en.append('svg').attr('class', 'eval-probe')
        .attr('viewBox', '0 0 ' + QUIZ_W + ' 760')
        .style('position', 'absolute').style('opacity', 0).style('pointer-events', 'none'));
    const g = probe.selectAll('g').data([0]).join('g');

    const results = OPTIONS.map(o => {
      const boxes = renderBoard(g, layoutFor(o.id), { ...ctx, reduced: true });
      const { violations } = constraintViolations(MODULES, boxes, ctx);
      const crit = violations.filter(v => v.severity === 'critical');
      const above = boxes.filter(b => b.y + b.h <= FOLD).length;
      const centre = Object.fromEntries(boxes.map(b => [b.id, [b.x + b.w / 2, b.y + b.h / 2]]));
      const stops = TASK_PATH.map(id => centre[id]).filter(Boolean);
      const scan = d3.pairs(stops).reduce((a, [p, q]) => a + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
      return { ...o, crit: crit.length, above, scan, worst: crit[0] ?? null };
    });
    probe.remove();
    return results.sort((a, b) => (a.crit - b.crit) || (b.above - a.above) || (a.scan - b.scan));
  }
  // #endregion

  const ranked = evaluate();
  const best = ranked[0];
  const byId = Object.fromEntries(ranked.map(r => [r.id, r]));

  function show(kind) {
    const boxes = renderBoard(ui.svg, layoutFor(kind), ctx);
    pageFrame(ui.svg, { x: 0, y: 0, w: QUIZ_W, h: QUIZ_H });
    ui.svg.selectAll('rect.page-frame').lower();
    ui.svg.selectAll('line.fold').data([FOLD])
      .join(en => en.append('line').attr('class', 'fold'))
      .attr('x1', 0).attr('x2', QUIZ_W).attr('y1', d => d).attr('y2', d => d);
    ui.svg.selectAll('text.fold-label').data([FOLD])
      .join(en => en.append('text').attr('class', 'fold-label'))
      .attr('x', 8).attr('y', d => d - 6)
      .text(pick('首屏折线 —— 以下需要滚动', 'fold — below this you must scroll'));
    return boxes;
  }

  function reveal(chosen) {
    mount.querySelectorAll('.quiz-opt').forEach(b => {
      b.classList.toggle('is-picked', b.dataset.opt === chosen);
      b.classList.toggle('is-best', b.dataset.opt === best.id);
    });
    const right = chosen === best.id;
    const rows = OPTIONS.map(o => byId[o.id]).map(r =>
      '<tr class="' + (r.id === best.id ? 'is-best' : '') + '">' +
        '<td>' + (lang === 'zh' ? r.zh : r.en) + '</td>' +
        '<td class="' + (r.crit ? 'bad' : 'ok') + '">' + r.crit + '</td>' +
        '<td class="' + (r.above === 6 ? 'ok' : 'bad') + '">' + r.above + '/6</td>' +
        '<td>' + r.scan.toFixed(0) + 'px</td></tr>').join('');

    mount.querySelector('#quizResult').innerHTML =
      '<p class="quiz-verdict ' + (right ? 'good' : 'bad') + '">' +
        (right ? pick('选对了', 'Correct') : pick('再看看实测结果', 'Look at the measurements')) + '</p>' +
      '<table class="quiz-table"><thead><tr>' +
        '<th>' + pick('组成', 'Composition') + '</th>' +
        '<th>' + pick('违反', 'Viol.') + '</th>' +
        '<th>' + pick('首屏可见', 'Above fold') + '</th>' +
        '<th>' + pick('扫视', 'Scan') + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
    show(chosen);

    const b = byId[chosen];
    const note = b.id === 'article'
      ? '单栏的扫视路径其实最短，但折线以下要滚动——监控场景里等于看不到。'
      : '窄栏分步适合逐项填写，不适合一眼比较。';
    const noteEn = b.id === 'article'
      ? 'the single column actually has the shortest path, but everything below the fold needs scrolling — invisible for monitoring.'
      : 'a stepped narrow column suits sequential input, not comparison at a glance.';

    ui.setStatus(
      right
        ? '「' + b.zh + '」首屏完整可见 ' + b.above + '/6 块、硬约束违反 ' + b.crit +
          ' 条。对"每天扫一眼"这个任务，同屏可见比路径短更重要——所以指标的优先级要跟着任务走。'
        : '你选的「' + b.zh + '」首屏只看得到 ' + b.above + '/6 块（扫视 ' + b.scan.toFixed(0) +
          'px）；「' + best.zh + '」是 ' + best.above + '/6。' + note,
      right
        ? '"' + b.en + '" keeps ' + b.above + '/6 modules fully above the fold with ' + b.crit +
          ' violation(s). For a daily glance, simultaneous visibility beats a short path — the metric order follows the task.'
        : 'You picked "' + b.en + '": only ' + b.above + '/6 above the fold (scan ' + b.scan.toFixed(0) +
          'px). "' + best.en + '" gets ' + best.above + '/6. Note: ' + noteEn
    );
  }

  mount.querySelectorAll('.quiz-opt').forEach(b =>
    b.addEventListener('click', () => reveal(b.dataset.opt)));

  show('monitor');
  ui.setStatus(
    '先别急着看数字——凭直觉选一个，再看实测结果。选错一次比直接被告知答案记得牢。',
    'Do not read the numbers yet. Commit to a choice first, then look. Getting it wrong once sticks better than being told.');
}

/* ── 注册 ──────────────────────────────────────────────────────────────── */
const CH3 = '../js/demos/ch3.js';

export const DEMOS = {
  proximity: {
    render: demoProximity,
    snippets: [
      { url: CH3, name: 'ch3-force',
        title: { zh: '关键点 1 · 让接近原则自己发生', en: 'Key 1 · Let proximity happen by itself' },
        why: { zh: 'forceX/forceY 拉向组中心、forceCollide 给出物理下限，分组是被推出来的，不是摆出来的。',
               en: 'forceX/forceY pull toward group centres and forceCollide sets the floor — the grouping emerges rather than being posed.' } },
      { url: CH3, name: 'ch3-ratio',
        title: { zh: '关键点 2 · 分组强度是比值，不是距离', en: 'Key 2 · Grouping is a ratio, not a distance' },
        why: { zh: '组间最近间隙 ÷ 组内最大间隙，两个量都取自真实边框，因此结论可复算。',
               en: 'Smallest between-group gap over largest within-group gap, both from real bounding boxes — so the conclusion is recomputable.' } }
    ]
  },
  region: {
    render: demoRegion,
    snippets: [
      { url: CH3, name: 'ch3-ratio',
        title: { zh: '关键点 1 · 区域比距离更强', en: 'Key 1 · Enclosure beats distance' },
        why: { zh: '间距比很低时接近原则已失效，共同区域仍能维持分组——这是可以在演示里验证的。',
               en: 'When the gap ratio is low, proximity fails but a common region still holds — and the demo lets you verify it.' } },
      { url: CH3, name: 'ch3-force',
        title: { zh: '关键点 2 · 颜色不能是唯一线索', en: 'Key 2 · Colour must never be the only cue' },
        why: { zh: '灰度打印或色觉障碍下颜色线索整个消失，分组必须另有承载。',
               en: 'In greyscale or for colour-vision deficiency the cue vanishes entirely; the grouping needs another carrier.' } }
    ]
  },
  density: {
    render: demoDensity,
    snippets: [
      { url: CH3, name: 'ch3-density',
        title: { zh: '关键点 1 · 覆盖率与扫视距离都实测', en: 'Key 1 · Coverage and scan path are both measured' },
        why: { zh: '覆盖率取真实占地面积；扫视距离按任务顺序连质心，而不是任意两两距离。',
               en: 'Coverage uses real occupied area; the scan path follows the task order rather than arbitrary pairwise distances.' } },
      { url: CH3, name: 'ch3-ratio',
        title: { zh: '关键点 2 · 留白不足会先压垮模块自己', en: 'Key 2 · Too little whitespace breaks the modules first' },
        why: { zh: '把间距压到很小，硬约束会先于"感觉拥挤"报警——这是密度的物理下限。',
               en: 'Squeeze the spacing and the hard constraints fire before it merely "feels" crowded — that is the physical floor of density.' } }
    ]
  },
  composition: {
    render: demoComposition,
    snippets: [
      { url: CH3, name: 'ch3-density',
        title: { zh: '关键点 1 · 用任务路径衡量组成', en: 'Key 1 · Judge a composition by the task path' },
        why: { zh: '同一组模块换一种组成，扫视距离就变；任务决定组成，不是审美决定组成。',
               en: 'The same modules in a different composition change the scan path. The task picks the composition, not taste.' } },
      { url: CH3, name: 'ch3-ratio',
        title: { zh: '关键点 2 · 小测的对错由实测判定', en: 'Key 2 · The quiz is graded by measurement' },
        why: { zh: '三个方案的违反数与扫视距离都是当场算出来的，不存在预设答案。',
               en: 'Violations and scan distance for all three options are computed on the spot — there is no answer key.' } }
    ]
  }
};
