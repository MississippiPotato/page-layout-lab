/**
 * demos/ch1.js —— 第 1 章「先诊断，再布局」的四个演示。
 *
 * 本章的演示原型：**真实看板 + 标注叠层 + 计时/点击轨迹**。
 *
 * 本章要立住的论点是"布局问题不是装饰问题"。
 * 论证方式不是老师断言，而是让学习者**自己花掉那十几秒**：
 * 1-1 在乱稿上限时找答案，用时与误点写进基线，第 5-4 节再测一次作对照。
 */

import d3 from '../d3.js';
import * as data from '../../data/campus.js';
import { MODULES, renderBoard, gridBand, VIZ } from '../charts.js';
import { constraintViolations, labelCollisions } from '../metrics.js';
import { S } from '../strings.js';
import { pick, t } from '../i18n.js';
import { scaffold, range, toggle, button, actions, readout, readoutList, pageFrame } from './kit.js';
import { readState, patchState } from '../state.js';
import { createProbe, fmtMs, renderCompare } from '../task-probe.js';

const CANVAS = { w: 880, h: 540 };
const PAGE = { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };

// #region snippet:ch1-broken
/**
 * 混乱初稿——全课的起点。 ←→ The messy draft: where the whole course starts.
 *
 * 它的四类问题都是**刻意**的，而且每一类都能被量出来： ←→ Its four faults are deliberate, and every one of them is measurable:
 *   层级：主图与 KPI 面积相近，没有明确的第一落点 ←→ hierarchy: the main chart and the KPIs have similar area, so there is no first fixation
 *   对齐：各卡片边缘互不共线（下面的 dx/dy 偏移） ←→ alignment: no two card edges share a line
 *   分组：相关模块被拆开，不相关的挨在一起 ←→ grouping: related modules are split apart while unrelated ones sit together
 *   编码：排行榜不排序、不高亮——于是"找最低的一门"必须逐行读数字 ←→ encoding: the ranking is neither sorted nor highlighted, so finding the lowest means reading all eight numbers
 */
const DRAFT = [
  { id: 'completion', x: 38,  y: 40,  w: 244, h: 158 },
  { id: 'trend',      x: 300, y: 26,  w: 322, h: 176 },
  { id: 'devices',    x: 638, y: 52,  w: 204, h: 140 },
  { id: 'ranking',    x: 52,  y: 216, w: 296, h: 188 },
  { id: 'heat',       x: 368, y: 230, w: 272, h: 174 },
  { id: 'blurb',      x: 658, y: 208, w: 198, h: 212 }
];
// #endregion

/** 修好之后的版面：主图占主导、共线、相关模块相邻、排行榜排序且高亮。 */
function fixedLayout() {
  const band = gridBand(12, CANVAS.w, { margin: 24, gutter: 16 });
  const col = (i, n) => ({ x: band(i), w: band.spanWidth(n) });
  const top = 24, r1 = 250, gap = 16, r2 = CANVAS.h - top - r1 - gap - 24;
  return [
    { id: 'trend',      main: true, ...col(0, 7), y: top, h: r1 },
    { id: 'completion',             ...col(7, 2), y: top, h: r1 },
    { id: 'devices',                ...col(9, 3), y: top, h: r1 },
    { id: 'ranking',                ...col(0, 5), y: top + r1 + gap, h: r2 },
    { id: 'heat',                   ...col(5, 4), y: top + r1 + gap, h: r2 },
    { id: 'blurb',                  ...col(9, 3), y: top + r1 + gap, h: r2 }
  ];
}

const draftBoxes = () => DRAFT.map(d => ({ ...d }));

/** 乱稿上下文：排行榜不排序、不高亮——这正是任务变慢的原因之一。 */
const draftCtx = (lang, reduced) =>
  ({ lang, data, reduced, rankSorted: false, highlightWorst: false });
const fixedCtx = (lang, reduced) =>
  ({ lang, data, reduced, rankSorted: true, highlightWorst: true });

/* ══ 1-1 布局问题不是装饰问题 ════════════════════════════════════════════ */
/**
 * 限时任务 A + 四类问题的标注叠层。
 * 先让学习者体验"难用"，再把难用的原因逐条标出来。
 */
function demoAudit(mount, { lang, section, reduced }) {
  const task = data.taskBank.find(x => x.id === 'worst-completion');

  const issues = [
    { id: 'hierarchy', zh: '层级', en: 'Hierarchy',
      box: [30, 18, 820, 190],
      zhy: '趋势图与其他卡片没有拉开明显差别，第一眼不一定先看到趋势。',
      eny: 'The trend is not much more prominent than the other cards, so it may not draw the first glance.' },
    { id: 'alignment', zh: '对齐', en: 'Alignment',
      box: [30, 200, 840, 215],
      zhy: '六个模块的边缘大多没有对齐，视线沿卡片移动时缺少稳定的参照线。',
      eny: 'Most of the six cards do not share edges, making them harder to scan along a common line.' },
    { id: 'grouping', zh: '分组', en: 'Grouping',
      box: [30, 18, 330, 400],
      zhy: '平均完成率与课程排行有关，但旧版没有用位置或间距把它们明确放成一组。',
      eny: 'Average completion and the course ranking belong together, but their placement does not make that relationship clear.' },
    { id: 'encoding', zh: '编码', en: 'Encoding',
      box: [44, 206, 320, 202],
      zhy: '排行榜未按完成率排序，也未标出最低项，找答案时需要比较多行。',
      eny: 'The ranking is unsorted and the lowest row is unmarked, so the search requires comparing several values.' }
  ];

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      `<div class="task-block">
         <h5>${t(S.task.title)}</h5>
         <p class="task-prompt">${t(task)}</p>
         <p class="task-sub" id="taskState">${t(S.task.prompt)}</p>
         ${actions(button('startTask', S.start, true), button('resetTask', S.retry))}
         <div class="task-result" id="taskResult"></div>
       </div>
       <hr class="control-sep">
       <p class="control-label">${pick('诊断叠层', 'Diagnostic overlay')}</p>` +
      issues.map(i => toggle('iss-' + i.id, { zh: i.zh, en: i.en })).join('') +
      actions(button('issAll', { zh: '显示全部问题', en: 'Show all' })),
    extra: '<div class="probe-host"></div>'
  });

  const ctx = draftCtx(lang, reduced);
  const boxes = renderBoard(ui.svg, draftBoxes(), ctx);
  pageFrame(ui.svg, PAGE);
  ui.svg.selectAll('rect.page-frame').lower();

  const probeHost = mount.querySelector('.probe-host');
  const stateEl = mount.querySelector('#taskState');
  const resultEl = mount.querySelector('#taskResult');

  const st = readState();
  renderCompare(probeHost, { baseline: st.baseline, retest: st.retest }, lang);

  const probe = createProbe(ui.svg, {
    task,
    onTick: ({ misclicks }) => {
      stateEl.textContent = `${t(S.task.wrong)} · ${t(S.task.misclicks)} ${misclicks}`;
    },
    onFinish: (run) => {
      stateEl.textContent = t(S.task.correct);
      resultEl.innerHTML =
        `<b>${fmtMs(run.ms)}</b><span>${t(S.task.misclicks)} ${run.misclicks}</span>`;
      // 写入基线：第 5-4 节要用它做对照
      patchState({ baseline: run });
      renderCompare(probeHost, { baseline: run, retest: readState().retest }, lang);
      ui.setStatus(
        `你用了 ${fmtMs(run.ms)}、点错 ${run.misclicks} 次。慢不是因为不够认真，` +
        `而是这份排行榜既没排序也没标出最低项，你需要比较多行数据。`,
        `That took ${fmtMs(run.ms)} with ${run.misclicks} misclick(s). It was slow not for lack of effort, ` +
        `but because the ranking is neither sorted nor marked, you had to compare several rows.`
      );
    }
  });

  ui.on('startTask', 'click', () => {
    stateEl.textContent = t(S.task.running);
    resultEl.innerHTML = '';
    probe.start();
  });
  ui.on('resetTask', 'click', () => {
    probe.cancel();
    stateEl.textContent = t(S.task.prompt);
    resultEl.innerHTML = '';
    ui.svg.selectAll('g.probe-path').remove();
  });

  /* ── 诊断叠层 ── */
  function drawIssues() {
    const on = issues.filter(i => mount.querySelector('#iss-' + i.id).checked);
    const layer = ui.svg.selectAll('g.issue-layer').data([0])
      .join(en => en.append('g').attr('class', 'issue-layer'));

    layer.selectAll('rect.issue-box').data(on, d => d.id)
      .join(en => en.append('rect').attr('class', 'issue-box').attr('rx', 9))
      .attr('x', d => d.box[0]).attr('y', d => d.box[1])
      .attr('width', d => d.box[2]).attr('height', d => d.box[3]);
    layer.selectAll('text.issue-tag').data(on, d => d.id)
      .join(en => en.append('text').attr('class', 'issue-tag'))
      .attr('x', d => d.box[0] + 8).attr('y', d => d.box[1] + 15)
      .text(d => (lang === 'zh' ? d.zh : d.en));

    ui.setReadout('issCount', `${on.length} / ${issues.length}`, on.length === issues.length);
    if (on.length) {
      const last = on[on.length - 1];
      ui.setStatus(lang === 'zh' ? last.zhy : last.eny, lang === 'zh' ? last.zhy : last.eny);
    }
  }
  issues.forEach(i => ui.on('iss-' + i.id, 'change', drawIssues));
  ui.on('issAll', 'click', () => {
    issues.forEach(i => { mount.querySelector('#iss-' + i.id).checked = true; });
    drawIssues();
  });

  ui.setStatus(
    '先别看标注。点「开始」，在这份乱稿上找出完成率最低的课程——记住你花了多久。',
    'Ignore the annotations for now. Press Start and find the course with the lowest completion — note how long it takes.'
  );
}

/* ══ 1-2 内容盘点与任务地图 ══════════════════════════════════════════════ */
/**
 * 优先级矩阵：横轴使用频次、纵轴任务影响。
 * 拖动（或方向键）改变位置，右侧实时重排优先级，结果写入 state，
 * 第 4-2 节的窄屏排序会直接用它——这是主线的一段真实连接。
 */
function demoMatrix(mount, { lang, section, reduced }) {
  const W = 700, H = 470;
  const saved = readState().priority;

  // 初始值给一份合理但不完美的估计，让学习者有东西可改
  const seed = {
    trend:      { f: 4.6, i: 4.8 }, ranking: { f: 4.0, i: 4.3 },
    completion: { f: 3.6, i: 3.9 }, heat:    { f: 2.4, i: 3.0 },
    devices:    { f: 1.6, i: 1.8 }, blurb:   { f: 1.2, i: 1.1 }
  };
  const nodes = Object.entries(seed).map(([id, v]) => ({ id, ...v }));

  const ui = scaffold(mount, {
    w: W, h: H, label: t(section.title),
    hint: { zh: '拖动圆点；也可用 Tab 选中后按方向键微调。',
            en: 'Drag a dot, or Tab to it and nudge with the arrow keys.' },
    controls:
      `<p class="control-label">${pick('当前优先级（高→低）', 'Priority (high → low)')}</p>
       <ol class="priority-list" id="prioList"></ol>`,
    extra: `<p class="control-note">${pick(
      '优先级会保存，第 4-2 节的窄屏排序会直接用它。',
      'The priority is saved; section 4-2 reorders the narrow layout from it.')}</p>`
  });

  const m = { l: 56, r: 24, t: 24, b: 46 };
  const x = d3.scaleLinear().domain([0, 5]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, 5]).range([H - m.b, m.t]);
  const svg = ui.svg;

  svg.selectAll('g.axis-x').data([0]).join(en => en.append('g').attr('class', 'axis-x'))
    .attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5));
  svg.selectAll('g.axis-y').data([0]).join(en => en.append('g').attr('class', 'axis-y'))
    .attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
  svg.selectAll('text.axis-title-x').data([0])
    .join(en => en.append('text').attr('class', 'axis-title-x').attr('text-anchor', 'middle'))
    .attr('x', (m.l + W - m.r) / 2).attr('y', H - 8)
    .text(pick('使用频次 →', 'Frequency of use →'));
  svg.selectAll('text.axis-title-y').data([0])
    .join(en => en.append('text').attr('class', 'axis-title-y').attr('text-anchor', 'middle'))
    .attr('transform', `translate(16,${(m.t + H - m.b) / 2}) rotate(-90)`)
    .text(pick('任务影响 →', 'Task impact →'));

  // 四象限参考线
  svg.selectAll('line.quad').data([['x', 2.5], ['y', 2.5]]).join('line').attr('class', 'quad')
    .attr('x1', d => d[0] === 'x' ? x(d[1]) : m.l).attr('x2', d => d[0] === 'x' ? x(d[1]) : W - m.r)
    .attr('y1', d => d[0] === 'y' ? y(d[1]) : m.t).attr('y2', d => d[0] === 'y' ? y(d[1]) : H - m.b);

  function rank() {
    return [...nodes].sort((a, b) => (b.f * b.i) - (a.f * a.i));
  }

  function updateList() {
    const order = rank();
    mount.querySelector('#prioList').innerHTML = order.map((d, i) =>
      `<li><span class="rank-no">${i + 1}</span>${t(MODULES[d.id].title)}
         <b>${(d.f * d.i).toFixed(1)}</b></li>`).join('');
    patchState({ priority: order.map(d => d.id) });
  }

  function draw() {
    const g = svg.selectAll('g.pnode').data(nodes, d => d.id)
      .join(en => {
        const gg = en.append('g').attr('class', 'pnode')
          .attr('tabindex', 0).attr('role', 'slider')
          .attr('aria-valuemin', 0).attr('aria-valuemax', 5);
        gg.append('circle').attr('class', 'pnode-dot');
        gg.append('text').attr('class', 'pnode-label').attr('text-anchor', 'middle');
        return gg;
      })
      .attr('transform', d => `translate(${x(d.f)},${y(d.i)})`)
      .attr('aria-label', d => `${t(MODULES[d.id].title)} ${pick('频次', 'frequency')} ${d.f.toFixed(1)} ${pick('影响', 'impact')} ${d.i.toFixed(1)}`)
      .attr('aria-valuenow', d => +(d.f * d.i).toFixed(1));

    // 圆面积编码优先级得分：面积是这张图里唯一的量化通道
    g.select('circle').attr('r', d => 9 + Math.sqrt(d.f * d.i) * 3.4)
      .attr('fill', d => d3.interpolateRgbBasis(['#cde2fb', VIZ.series[0]])(Math.min(1, d.f * d.i / 24)));
    g.select('text').attr('y', d => -(13 + Math.sqrt(d.f * d.i) * 3.4))
      .text(d => t(MODULES[d.id].title));

    g.call(d3.drag()
      .on('drag', (event, d) => {
        d.f = Math.max(0, Math.min(5, x.invert(event.x)));
        d.i = Math.max(0, Math.min(5, y.invert(event.y)));
        draw(); updateList();
      }));

    // 键盘等效：方向键微调，保持与拖拽同等能力
    g.on('keydown', (event, d) => {
      const step = event.shiftKey ? 0.5 : 0.1;
      const map = { ArrowRight: ['f', step], ArrowLeft: ['f', -step],
                    ArrowUp: ['i', step], ArrowDown: ['i', -step] };
      const mv = map[event.key];
      if (!mv) return;
      event.preventDefault();
      d[mv[0]] = Math.max(0, Math.min(5, d[mv[0]] + mv[1]));
      draw(); updateList();
    });
  }

  draw();
  updateList();
  if (saved) ui.setStatus(
    '已载入你上次保存的优先级。把模块拖到它真正该在的位置——右侧顺序会实时更新。',
    'Loaded your saved priority. Drag each module to where it really belongs — the list updates live.');
  else ui.setStatus(
    '优先级 = 使用频次 × 任务影响。先盘点内容，再谈布局：不知道谁重要，就无法决定谁该大、谁该在上面。',
    'Priority = frequency x impact. Inventory first: without knowing what matters, you cannot decide what should be large or first.');
}

/* ══ 1-3 建立视觉层级 ════════════════════════════════════════════════════ */
/**
 * 层级由**面积**建立。滑杆改变主图占几列，真实图表随之重绘，
 * 右侧同时给出主/次面积比与主图的实测标签碰撞——
 * 面积给得太小，层级没建立起来，图表自己也会先读不了。
 */
function demoHierarchy(mount, { lang, section, reduced }) {
  let mainSpan = 4;   // 故意从"主图不够大"起步

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      range('hSpan', S.mainSpan, 3, 10, mainSpan, 1, pick(' 列', ' col')) +
      readoutList(
        readout('hRatio', { zh: '主/次面积比', en: 'Main : secondary area' }),
        readout('hColl', S.metrics.collisions),
        readout('hVerdict', { zh: '层级判定', en: 'Hierarchy verdict' })
      ),
    extra: `<p class="control-note">${pick(
      '经验参考：主模块面积达到次模块的 2.5 倍以上，第一落点才稳定。这个阈值是启发式，但面积比是实测的。',
      'Rule of thumb: the main module needs ~2.5x the area of the next one for a stable first fixation. The threshold is heuristic; the ratio is measured.')}</p>`
  });

  const ctx = fixedCtx(lang, reduced);

  function update() {
    const band = gridBand(12, CANVAS.w, { margin: 24, gutter: 16 });
    const col = (i, n) => ({ x: band(i), w: band.spanWidth(n) });
    const rest = 12 - mainSpan;
    const top = 24, r1 = 250, gap = 16, r2 = CANVAS.h - top - r1 - gap - 24;
    const aSpan = Math.max(2, Math.round(rest / 2));
    const boxes = [
      { id: 'trend', main: true, ...col(0, mainSpan), y: top, h: r1 },
      { id: 'completion', ...col(mainSpan, aSpan), y: top, h: r1 },
      { id: 'devices', ...col(mainSpan + aSpan, Math.max(2, rest - aSpan)), y: top, h: r1 },
      { id: 'ranking', ...col(0, 5), y: top + r1 + gap, h: r2 },
      { id: 'heat', ...col(5, 4), y: top + r1 + gap, h: r2 },
      { id: 'blurb', ...col(9, 3), y: top + r1 + gap, h: r2 }
    ];

    pageFrame(ui.svg, PAGE);
    ui.svg.selectAll('rect.page-frame').lower();
    renderBoard(ui.svg, boxes, ctx);

    const main = boxes.find(b => b.id === 'trend');
    const others = boxes.filter(b => b.id !== 'trend');
    const biggestOther = Math.max(...others.map(b => b.w * b.h));
    const ratio = (main.w * main.h) / biggestOther;
    const coll = main.node?.__ticks ? labelCollisions(main.node.__ticks, 'x').count : 0;
    const ok = ratio >= 2.5 && coll === 0;

    ui.setReadout('hRatio', `${ratio.toFixed(2)} ×`, ratio >= 2.5);
    ui.setReadout('hColl', String(coll), coll === 0);
    ui.setReadout('hVerdict',
      ok ? pick('层级成立', 'Established') : pick('层级不足', 'Too weak'), ok);

    ui.setStatus(
      ratio < 2.5
        ? `主图面积只有次模块的 ${ratio.toFixed(2)} 倍，视线没有明确的第一落点——层级靠的是面积差，不是边框或颜色。`
        : coll ? `面积够了，但主图内部已经挤到标签重叠 ${coll} 处：层级不能以牺牲可读性为代价。`
        : `主图面积达到次模块的 ${ratio.toFixed(2)} 倍，第一落点稳定，且图表自身仍然可读。`,
      ratio < 2.5
        ? `The main chart is only ${ratio.toFixed(2)}x the next module — no stable first fixation. Hierarchy comes from area, not borders or colour.`
        : coll ? `Area is sufficient, but ${coll} labels now overlap inside the main chart: hierarchy must not cost legibility.`
        : `The main chart is ${ratio.toFixed(2)}x the next module — a stable first stop, and still legible.`
    );
  }

  ui.onRange('hSpan', v => { mainSpan = v; update(); }, v => `${v}${pick(' 列', ' col')}`);
  update();
}

/* ══ 1-4 验证阅读顺序 ════════════════════════════════════════════════════ */
/**
 * 把**预测**的阅读路径（按面积与位置的启发式）和学习者在 1-1 留下的
 * **实际**点击轨迹叠在一起。两者不一致，说明设计意图没有被布局传达出去。
 *
 * 必须说清楚：预测路径只是设计意图的表达，不是眼动数据；
 * 实际轨迹也只是一次点击序列，不是注视序列。
 */
function demoPath(mount, { lang, section, reduced }) {
  const st = readState();
  let showFixed = false;

  const ui = scaffold(mount, {
    w: CANVAS.w, h: CANVAS.h, label: t(section.title),
    controls:
      toggle('showPred', { zh: '预测阅读路径', en: 'Predicted reading path' }, true) +
      toggle('showReal', { zh: '你的实际点击', en: 'Your actual clicks' }, true) +
      actions(button('swapLayout', { zh: '切换到重构版', en: 'Switch to the fixed layout' }, true)) +
      readoutList(
        readout('pOrder', { zh: '预测首个落点', en: 'Predicted first stop' }),
        readout('pReal', { zh: '你实际先点了', en: 'You actually clicked' })
      ),
    extra: `<p class="control-note">${pick(
      '预测路径是按面积与位置推出来的设计意图，不是眼动数据；实际轨迹是点击序列，也不是注视序列。两者都只能用来解释意图与结果的差距。',
      'The predicted path expresses design intent from area and position — it is not eye-tracking. The actual trail is a click sequence, not a fixation sequence. Both only illustrate the gap between intent and outcome.')}</p>`
  });

  function update() {
    const ctx = showFixed ? fixedCtx(lang, reduced) : draftCtx(lang, reduced);
    const boxes = renderBoard(ui.svg, showFixed ? fixedLayout() : draftBoxes(), ctx);
    pageFrame(ui.svg, PAGE);
    ui.svg.selectAll('rect.page-frame').lower();

    // #region snippet:ch1-salience
    // 显著性的启发式排序：面积越大、位置越靠上越靠左，越可能先被看到。 ←→ A salience heuristic: larger area, higher and further left means more likely to be seen first.
    // 这是**设计意图**的形式化，不冒充眼动数据——权重是经验值，写死在这里供检视。 ←→ It formalises design intent; it does not impersonate eye-tracking. The weights are heuristics, hard-coded here so they can be inspected and argued with.
    const salience = boxes.map(b => ({
      id: b.id,
      score: Math.sqrt(b.w * b.h) * 1.0 - b.y * 0.22 - b.x * 0.06
    })).sort((a, b) => b.score - a.score);
    // #endregion

    const centre = Object.fromEntries(boxes.map(b => [b.id, [b.x + b.w / 2, b.y + b.h / 2]]));
    const pred = salience.map(s => centre[s.id]);

    const layer = ui.svg.selectAll('g.pred-layer').data([0])
      .join(en => en.append('g').attr('class', 'pred-layer'));
    layer.style('display', mount.querySelector('#showPred').checked ? null : 'none');
    layer.selectAll('path.pred-line').data([pred])
      .join(en => en.append('path').attr('class', 'pred-line'))
      .attr('d', d3.line().curve(d3.curveCatmullRom.alpha(0.4)));
    layer.selectAll('text.pred-num').data(salience, d => d.id)
      .join(en => en.append('text').attr('class', 'pred-num').attr('text-anchor', 'middle'))
      .attr('x', (d, i) => pred[i][0]).attr('y', (d, i) => pred[i][1] + 4)
      .text((d, i) => i + 1);

    // 学习者在 1-1 留下的真实点击
    const real = st.baseline?.path ?? [];
    const rlayer = ui.svg.selectAll('g.real-layer').data([0])
      .join(en => en.append('g').attr('class', 'real-layer'));
    rlayer.style('display',
      mount.querySelector('#showReal').checked && real.length && !showFixed ? null : 'none');
    rlayer.selectAll('path.real-line').data(real.length > 1 ? [real] : [])
      .join(en => en.append('path').attr('class', 'real-line'))
      .attr('d', d3.line().x(d => d.x).y(d => d.y).curve(d3.curveCatmullRom.alpha(0.4)));
    rlayer.selectAll('circle.real-dot').data(real, (d, i) => i)
      .join(en => en.append('circle').attr('class', 'real-dot').attr('r', 6))
      .attr('cx', d => d.x).attr('cy', d => d.y);

    ui.setReadout('pOrder', t(MODULES[salience[0].id].title));
    const firstReal = real[0]
      ? boxes.find(b => real[0].x >= b.x && real[0].x <= b.x + b.w &&
                        real[0].y >= b.y && real[0].y <= b.y + b.h)
      : null;
    ui.setReadout('pReal',
      firstReal ? t(MODULES[firstReal.id].title) : (real.length ? pick('空白处', 'empty space') : '—'),
      !!firstReal && firstReal.id === salience[0].id);

    if (!real.length) {
      ui.setStatus(t(S.task.noBaseline), t(S.task.noBaseline));
    } else if (showFixed) {
      ui.setStatus(
        `重构版里预测的第一落点是「${t(MODULES[salience[0].id].title)}」，与任务优先级一致。`,
        `In the fixed layout the predicted first stop is "${t(MODULES[salience[0].id].title)}", which matches the task priority.`);
    } else {
      const match = firstReal && firstReal.id === salience[0].id;
      ui.setStatus(
        match
          ? '你的第一次点击与预测落点一致——但这份乱稿仍让你多花了时间，说明问题出在后续步骤。'
          : `预测第一落点是「${t(MODULES[salience[0].id].title)}」，你实际先点的却不是它。设计意图没有被这份布局传达出去。`,
        match
          ? 'Your first click matched the predicted stop — yet the draft still cost you time, so the problem lies further along the path.'
          : `The predicted first stop was "${t(MODULES[salience[0].id].title)}", but that is not where you clicked first. The intent is not reaching the reader.`);
    }
  }

  ui.on('showPred', 'change', update);
  ui.on('showReal', 'change', update);
  ui.on('swapLayout', 'click', (e) => {
    showFixed = !showFixed;
    e.target.textContent = showFixed
      ? pick('切回乱稿', 'Back to the draft')
      : pick('切换到重构版', 'Switch to the fixed layout');
    update();
  });
  update();
}

/* ── 注册 ──────────────────────────────────────────────────────────────── */
const CH1 = '../js/demos/ch1.js';
const PROBE = '../js/task-probe.js';
const CHARTS = '../js/charts.js';

export const DEMOS = {
  audit: {
    render: demoAudit,
    snippets: [
      { url: CH1, name: 'ch1-broken',
        title: { zh: '关键点 1 · 乱稿的四类问题是刻意的', en: 'Key 1 · The draft’s four faults are deliberate' },
        why: { zh: '每一类都能被量出来，后面四章各修一类；排行榜不排序正是任务变慢的主因。',
               en: 'Each fault is measurable and each later chapter fixes one; the unsorted ranking is the main reason the task is slow.' } },
      { url: PROBE, name: 'probe-path',
        title: { zh: '关键点 2 · 记录的是真实点击，不是眼动', en: 'Key 2 · Real clicks — not eye-tracking' },
        why: { zh: '轨迹来自实际操作，因此可以和预测路径对照；但它是点击序列，不能冒充注视数据。',
               en: 'The trail comes from real interaction so it can be compared with intent — but it is clicks, not fixations.' } }
    ]
  },
  matrix: {
    render: demoMatrix,
    snippets: [
      { url: CH1, name: 'ch1-broken',
        title: { zh: '关键点 1 · 先盘点内容，再谈布局', en: 'Key 1 · Inventory before layout' },
        why: { zh: '不知道谁重要，就无法决定谁该大、谁该在上面。优先级是后面所有决定的输入。',
               en: 'Without knowing what matters you cannot decide what should be large or first. Priority is the input to every later decision.' } },
      { url: CH1, name: 'ch1-salience',
        title: { zh: '关键点 2 · 把判断写成可检视的函数', en: 'Key 2 · Write the judgement as an inspectable function' },
        why: { zh: '权重写死在代码里是故意的：它是经验值，必须能被看到、被质疑、被改。',
               en: 'The weights are hard-coded on purpose: they are heuristics, and must be visible, arguable, and editable.' } }
    ]
  },
  hierarchy: {
    render: demoHierarchy,
    snippets: [
      { url: CHARTS, name: 'band',
        title: { zh: '关键点 1 · 面积由跨列数决定', en: 'Key 1 · Area comes from the column span' },
        why: { zh: '层级不是加粗或描边，而是面积差；而面积在栅格里就是跨几列。',
               en: 'Hierarchy is not bolder borders but a difference in area — and in a grid, area is how many columns you span.' } },
      { url: CHARTS, name: 'trend-join',
        title: { zh: '关键点 2 · 层级不能以可读性为代价', en: 'Key 2 · Hierarchy must not cost legibility' },
        why: { zh: '把次模块压得太窄，它自己的标签会先重叠——实测会立刻报出来。',
               en: 'Squeeze the secondary modules too far and their own labels collide — the measurement says so immediately.' } }
    ]
  },
  path: {
    render: demoPath,
    snippets: [
      { url: CH1, name: 'ch1-salience',
        title: { zh: '关键点 1 · 显著性排序是设计意图的形式化', en: 'Key 1 · Salience ordering formalises intent' },
        why: { zh: '面积、纵向位置、横向位置三项加权——它解释意图，不冒充眼动数据。',
               en: 'Area, vertical and horizontal position, weighted. It explains intent; it does not impersonate eye-tracking.' } },
      { url: PROBE, name: 'probe-path',
        title: { zh: '关键点 2 · 意图与结果要能并排比较', en: 'Key 2 · Intent and outcome must be comparable' },
        why: { zh: '预测路径与实际轨迹画在同一坐标系里，差距才看得见。',
               en: 'Predicted path and actual trail share one coordinate space, so the gap becomes visible.' } }
    ]
  }
};
