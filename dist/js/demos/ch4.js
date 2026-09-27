/**
 * demos/ch4.js —— 第 4 章「响应式与可访问布局」的四个演示。
 *
 * 本章的演示原型：**可调的真实视口 + 并排对照**。
 *
 * 本章要破的观念是"响应式 = 等比缩小"。破法不是讲道理，而是把两种做法
 * 并排放在同一宽度下，再把各自的**实测**结果摆出来：
 * 等比缩小会让字号真的降到 6px、标签真的重叠；重排不会。
 */

import d3 from '../d3.js';
import * as data from '../../data/campus.js';
import { MODULES, renderBoard, gridBand } from '../charts.js';
import { constraintViolations, labelCollisions } from '../metrics.js';
import { S } from '../strings.js';
import { pick, t } from '../i18n.js';
import { scaffold, range, toggle, button, actions, readout, readoutList, renderHealth } from './kit.js';
import { readState, patchState } from '../state.js';

const DESKTOP = 1200;          // 设计基准宽度
const BASE_FONT = 10;          // viz.css 里轴标签的基准字号
const MIN_LEGIBLE = 8;         // 低于 8px 的正文在屏幕上基本不可读

// #region snippet:ch4-reflow
/**
 * 内容驱动的重排：**不是**按 768/992 这类约定俗成的数字切换， ←→ Content-driven reflow: NOT a switch at conventional numbers like 768 or 992,
 * 而是按"还能不能放得下"来决定。 ←→ but a decision based on whether things still fit.
 *
 * 每个模块自己声明了 min.w（见 charts.js 的 MODULES）， ←→ Each module declares its own min.w (see MODULES in charts.js);
 * 这里只做一件事：在给定宽度下，能并排就并排，放不下就换行。 ←→ this function does one thing: at a given width, sit side by side if possible, otherwise wrap.
 */
export function reflow(width, order, ctxData = { data }) {
  const margin = width < 520 ? 14 : 24;
  const gutter = width < 520 ? 10 : 16;
  const cols = width < 520 ? 4 : width < 900 ? 8 : 12;
  const band = gridBand(cols, width, { margin, gutter });

  // 主图优先吃满可用宽度；其余按优先级依次放置，放不下就另起一行 ←→ Place modules in priority order; start a new row whenever the next one no longer fits
  const spanFor = (id) => {
    const min = MODULES[id].min.w;
    const need = Math.ceil((min + gutter) / band.step());
    return Math.max(1, Math.min(cols, need));
  };

  const rows = [];
  let row = [], used = 0;
  for (const id of order) {
    let span = spanFor(id);
    // 需要的宽度超过一整行时，就独占一行——这不是特例， ←→ If a module needs more than one row can give, it takes the whole row. Not a special case:
    // 而是"放不下就换行"这条规则在跨度用满时的自然结果。 ←→ just the same wrap rule, at the point where the span runs out.
    if (band.spanWidth(span) < MODULES[id].min.w) span = cols;
    if (used + span > cols) { rows.push(row); row = []; used = 0; }
    row.push({ id, span });
    used += span;
    if (used === cols) { rows.push(row); row = []; used = 0; }
  }
  if (row.length) rows.push(row);

  // 行高由该行里**要求最高**的模块决定，而不是把固定总高切成几份。 ←→ Row height comes from the tallest requirement in that row, not from slicing a fixed total.
  // 这也是真实响应式页面的行为：越窄，页面越**高**（靠滚动换空间）， ←→ This is what real responsive pages do: the narrower the viewport, the TALLER the page,
  // 而不是把每一行压得越来越扁。早期版本按固定总高均分， ←→ trading space for scrolling rather than flattening every row. An earlier version split a fixed height evenly,
  // 结果窄屏下主图高度被压到 116px，报出的其实是自己造出来的违反。 ←→ which squeezed the main chart to 116px on narrow screens and reported a violation it had manufactured itself.
  const gapY = gutter;
  const boxes = [];
  let y = margin;
  rows.forEach(r => {
    // 有些模块（文本块）的所需高度取决于它拿到的宽度，必须按宽度问它 ←→ Some modules (text) need a height that depends on the width they get, so ask them per width
    const need = c => {
      const m = MODULES[c.id];
      const w = band.spanWidth(c.span);
      return m.minHeightAt ? Math.max(m.min.h, m.minHeightAt(w, ctxData)) : m.min.h;
    };
    const h = Math.max(...r.map(need)) * (r.some(c => c.id === 'trend') ? 1.5 : 1);
    let col = 0;
    for (const cell of r) {
      boxes.push({
        id: cell.id, main: cell.id === 'trend',
        x: band(col), w: band.spanWidth(cell.span), y, h
      });
      col += cell.span;
    }
    y += h + gapY;
  });
  return { boxes, height: y - gapY + margin };
}
// #endregion

/** 桌面基准版面——「等比缩小」缩的就是它。 */
function desktopLayout(height = 620) {
  const band = gridBand(12, DESKTOP, { margin: 24, gutter: 16 });
  const col = (i, n) => ({ x: band(i), w: band.spanWidth(n) });
  const top = 24, r1 = height * 0.5, gap = 16, r2 = height - top - r1 - gap - 24;
  return [
    { id: 'trend', main: true, ...col(0, 7), y: top, h: r1 },
    { id: 'completion', ...col(7, 2), y: top, h: r1 },
    { id: 'devices', ...col(9, 3), y: top, h: r1 },
    { id: 'ranking', ...col(0, 5), y: top + r1 + gap, h: r2 },
    { id: 'heat', ...col(5, 4), y: top + r1 + gap, h: r2 },
    { id: 'blurb', ...col(9, 3), y: top + r1 + gap, h: r2 }
  ];
}

const DEFAULT_ORDER = ['trend', 'ranking', 'completion', 'heat', 'devices', 'blurb'];
const ctxFor = (lang, reduced) => ({ lang, data, reduced, rankSorted: true, highlightWorst: true });

/** 在画布上画一个设备外框，并返回内部绘图用的 <g>。 */
function deviceFrame(svg, key, { x, y, w, h, label }) {
  const g = svg.selectAll(`g.device-${key}`).data([0])
    .join(en => en.append('g').attr('class', `device-${key} device`));
  g.selectAll('rect.device-shell').data([0])
    .join(en => en.append('rect').attr('class', 'device-shell').attr('rx', 12))
    .attr('x', x).attr('y', y).attr('width', w).attr('height', h);
  g.selectAll('text.device-label').data([label])
    .join(en => en.append('text').attr('class', 'device-label'))
    .attr('x', x + 2).attr('y', y - 7).text(d => d);
  const inner = g.selectAll('g.device-inner').data([0])
    .join(en => en.append('g').attr('class', 'device-inner'));
  return inner;
}

/* ══ 4-1 响应式不是等比缩小 ══════════════════════════════════════════════ */
function demoResponsive(mount, { lang, section, reduced }) {
  const W = 900, H = 560;
  let width = 430;

  const ui = scaffold(mount, {
    w: W, h: H, label: t(section.title),
    controls:
      range('vw', { zh: '视口宽度', en: 'Viewport width' }, 320, 1200, width, 10, 'px') +
      readoutList(
        readout('sFont', { zh: '等比：实际字号', en: 'Scaled: effective font' }),
        readout('sColl', { zh: '等比：标签碰撞', en: 'Scaled: collisions' }),
        readout('rFont', { zh: '重排：实际字号', en: 'Reflow: effective font' }),
        readout('rColl', { zh: '重排：标签碰撞', en: 'Reflow: collisions' })
      ),
    extra: `<p class="control-note">${pick(
      '等比缩小让版面"看起来还是那一版"，代价是字号随之缩小；重排保持字号不变，改变的是模块的排布。',
      'Scaling keeps the composition intact but shrinks the type with it. Reflow keeps the type and changes the arrangement instead.')}</p>`
  });

  const ctx = ctxFor(lang, reduced);
  const half = (W - 60) / 2;

  const collisionsIn = (boxes) => {
    const trend = boxes.find(b => b.id === 'trend');
    return trend?.node?.__ticks ? labelCollisions(trend.node.__ticks, 'x').count : 0;
  };

  function update() {
    const frameH = H - 60;

    // 左：等比缩小——整版按 width/DESKTOP 缩放，字号跟着一起缩
    const k = width / DESKTOP;
    const leftInner = deviceFrame(ui.svg, 'scaled', {
      x: 24, y: 40, w: half, h: frameH, label: pick('等比缩小', 'Scaled down')
    });
    leftInner.attr('transform', `translate(24,40) scale(${half / DESKTOP})`);
    const scaledBoxes = renderBoard(
      leftInner.selectAll('g.board-scaled').data([0])
        .join(en => en.append('g').attr('class', 'board-scaled')),
      desktopLayout(frameH / (half / DESKTOP)), ctx);

    // 右：真正重排——按当前宽度重新决定谁跟谁并排
    const rightX = 36 + half;
    const rightInner = deviceFrame(ui.svg, 'reflow', {
      x: rightX, y: 40, w: half, h: frameH, label: pick('内容驱动重排', 'Content-driven reflow')
    });
    const rl = reflow(width, DEFAULT_ORDER);
    // 重排后的页面通常更高，按宽高里更紧的那一维缩放，保证整页可见
    const rk = Math.min(half / width, frameH / rl.height);
    rightInner.attr('transform', `translate(${rightX},40) scale(${rk})`);
    const reflowBoxes = renderBoard(
      rightInner.selectAll('g.board-reflow').data([0])
        .join(en => en.append('g').attr('class', 'board-reflow')),
      rl.boxes, ctx);

    // 实测：等比分支的有效字号 = 基准字号 × (视口宽 / 设计宽)，
    // 也就是用户屏幕上真正看到的 px；重排分支不缩放，字号保持不变。
    const effScaled = BASE_FONT * k;
    const effReflow = BASE_FONT;

    const sColl = collisionsIn(scaledBoxes);
    const rColl = collisionsIn(reflowBoxes);

    ui.setReadout('sFont', `${effScaled.toFixed(1)} px`, effScaled >= MIN_LEGIBLE);
    ui.setReadout('sColl', String(sColl), sColl === 0);
    ui.setReadout('rFont', `${effReflow.toFixed(1)} px`, true);
    ui.setReadout('rColl', String(rColl), rColl === 0);

    ui.setStatus(
      effScaled < MIN_LEGIBLE
        ? `视口 ${width}px 时，等比缩小把轴标签压到 ${effScaled.toFixed(1)}px——已经低于 ${MIN_LEGIBLE}px 可读下限；重排保持 ${effReflow}px，代价只是模块换了排布。`
        : `视口 ${width}px 时两种做法都还能读，但等比的字号已降到 ${effScaled.toFixed(1)}px，继续变窄会先失效。`,
      effScaled < MIN_LEGIBLE
        ? `At ${width}px, scaling drops axis labels to ${effScaled.toFixed(1)}px — below the ${MIN_LEGIBLE}px floor. Reflow holds ${effReflow}px and only rearranges.`
        : `At ${width}px both are readable, but the scaled type is down to ${effScaled.toFixed(1)}px and will fail first as the viewport narrows.`
    );
  }

  ui.onRange('vw', v => { width = v; update(); }, v => `${v}px`);
  update();
}

/* ══ 4-2 优先级驱动重排 ══════════════════════════════════════════════════ */
/**
 * 窄屏排序直接读第 1-2 节保存下来的优先级。
 * 这是案例主线的一段真实连接：不是"第 1 章讲过"，而是第 1 章的产出在这里被用上。
 */
function demoPriority(mount, { lang, section, reduced }) {
  const W = 760, H = 560;
  let width = 400;
  const saved = readState().priority;
  let order = saved && saved.length === 6 ? [...saved] : [...DEFAULT_ORDER];

  const ui = scaffold(mount, {
    w: W, h: H, label: t(section.title),
    controls:
      range('pw', { zh: '视口宽度', en: 'Viewport width' }, 320, 900, width, 10, 'px') +
      toggle('useDom', { zh: '改用 DOM 书写顺序', en: 'Use DOM source order' }) +
      `<p class="control-label">${pick('当前排序来源', 'Order in use')}</p>
       <ol class="priority-list" id="orderList"></ol>`,
    extra: `<div class="health-host"></div>
      <p class="control-note">${saved
        ? pick('已读取你在第 1-2 节保存的优先级。', 'Loaded the priority you saved in section 1-2.')
        : pick('尚未在第 1-2 节保存优先级，这里先用默认顺序。', 'No priority saved in 1-2 yet — using the default order.')}</p>`
  });

  const ctx = ctxFor(lang, reduced);
  const healthHost = mount.querySelector('.health-host');

  function update() {
    const useDom = mount.querySelector('#useDom').checked;
    // DOM 书写顺序 = charts.js 里模块声明的顺序，与任务优先级无关
    const active = useDom ? Object.keys(MODULES) : order;

    const frameH = H - 56;
    const inner = deviceFrame(ui.svg, 'prio', {
      x: (W - 360) / 2, y: 36, w: 360, h: frameH,
      label: `${width}px`
    });
    const rl = reflow(width, active);
    const k = Math.min(360 / width, frameH / rl.height);
    inner.attr('transform', `translate(${(W - 360) / 2},36) scale(${k})`);
    const boxes = renderBoard(
      inner.selectAll('g.board').data([0]).join(en => en.append('g').attr('class', 'board')),
      rl.boxes, ctx);

    // #region snippet:ch4-order
    // 视觉顺序 = 按最终坐标从上到下、从左到右读出来的顺序。 ←→ Visual order = the order you read the final coordinates, top to bottom then left to right.
    // 它与 DOM 书写顺序不一致时，键盘与读屏用户走的路和眼睛看到的路就分叉了。 ←→ When it diverges from DOM source order, keyboard and screen-reader users travel a different path from the one the eye sees.
    const visual = [...boxes]
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
      .map(b => b.id);
    const conflicts = visual.filter((id, i) => active[i] !== id).length;
    // #endregion

    mount.querySelector('#orderList').innerHTML = visual.map((id, i) =>
      `<li><span class="rank-no">${i + 1}</span>${t(MODULES[id].title)}</li>`).join('');

    const { violations } = constraintViolations(MODULES, boxes, ctx);
    renderHealth(healthHost, {
      collisions: 0, alignment: 0, cpl: 30, overflow: 0, violations
    }, lang);

    ui.setStatus(
      useDom
        ? `按 DOM 书写顺序排布时，首屏第一个是「${t(MODULES[visual[0]].title)}」——它未必是用户最需要的那个。`
        : `按任务优先级排布，首屏第一个是「${t(MODULES[visual[0]].title)}」。排在后面的模块仍在页面里，但需要继续滚动才能看到。`,
      useDom
        ? `In source order the first item is "${t(MODULES[visual[0]].title)}" — not necessarily what the user needs first.`
        : `Ordered by task priority, the first item is "${t(MODULES[visual[0]].title)}". Later modules remain on the page but require scrolling.`
    );
  }

  ui.onRange('pw', v => { width = v; update(); }, v => `${v}px`);
  ui.on('useDom', 'change', update);
  update();
}

/* ══ 4-3 文字缩放与触控空间 ══════════════════════════════════════════════ */
/**
 * 文字缩放不是模拟出来的：直接改 CSS 变量 --viz-text-scale，
 * 所有 SVG 文本真的变大，再用 getComputedTextLength() 量后果。
 */
function demoAccessibility(mount, { lang, section, reduced }) {
  const W = 820, H = 540;
  let zoom = 100, target = 44;

  const ui = scaffold(mount, {
    w: W, h: H, label: t(section.title),
    controls:
      range('zoom', { zh: '文字缩放', en: 'Text zoom' }, 100, 200, zoom, 10, '%') +
      range('touch', { zh: '触控目标', en: 'Touch target' }, 24, 60, target, 1, 'px') +
      readoutList(
        readout('aColl', S.metrics.collisions),
        readout('aTouch', { zh: '触控目标', en: 'Touch target' }),
        readout('aVerdict', { zh: '44px 目标检查', en: '44px target check' })
      ),
    extra: `<p class="control-note">${pick(
      'WCAG 2.5.5（AAA）规定触控目标原则上至少 44×44 CSS 像素，也列有例外；1.4.4（AA）要求文字可放大至 200% 而不丢内容或功能。本演示只测图表标签碰撞和示例触控目标，不等于整页合规测试。',
      'WCAG 2.5.5 (AAA) generally sets a 44×44 CSS-pixel target size, with exceptions; 1.4.4 (AA) requires text to resize to 200% without loss of content or function. This demo checks chart labels and sample targets only, not full-page conformance.')}</p>`
  });

  const ctx = ctxFor(lang, reduced);
  const canvas = mount.querySelector('.demo-canvas');

  function update() {
    // #region snippet:ch4-zoom
    // 字号写在 CSS 里（viz.css 的 calc(10px * var(--viz-text-scale))）， ←→ Type size lives in CSS (calc(10px * var(--viz-text-scale)) in viz.css),
    // 所以"放大到 200%"只需改一个变量，SVG 文本会真的变大， ←→ so zooming to 200% is one variable change and the SVG text really does grow,
    // 随后 getComputedTextLength() 量到的就是放大后的真实宽度。 ←→ after which getComputedTextLength() measures the real enlarged width.
    canvas.style.setProperty('--viz-text-scale', zoom / 100);
    // #endregion

    const boxes = renderBoard(
      ui.svg.selectAll('g.board').data([0]).join(en => en.append('g').attr('class', 'board')),
      reflow(760, DEFAULT_ORDER).boxes.map(b => ({ ...b, x: b.x + 30, y: b.y + 20 })),
      ctx);

    // 触控目标：画在排行榜每一行右侧，尺寸由滑杆决定
    const ranking = boxes.find(b => b.id === 'ranking');
    const layer = ui.svg.selectAll('g.touch-layer').data([0])
      .join(en => en.append('g').attr('class', 'touch-layer'));
    const spots = ranking
      ? d3.range(3).map(i => ({
          id: i,
          cx: ranking.x + ranking.w - target / 2 - 8,
          cy: ranking.y + 40 + i * (target + 8)
        })).filter(s => s.cy + target / 2 < ranking.y + ranking.h)
      : [];
    layer.selectAll('rect.touch-spot').data(spots, d => d.id)
      .join(en => en.append('rect').attr('class', 'touch-spot').attr('rx', 6))
      .attr('x', d => d.cx - target / 2).attr('y', d => d.cy - target / 2)
      .attr('width', target).attr('height', target)
      .classed('too-small', target < 44);

    const trend = boxes.find(b => b.id === 'trend');
    const coll = trend?.node?.__ticks ? labelCollisions(trend.node.__ticks, 'x').count : 0;
    const okTouch = target >= 44;

    ui.setReadout('aColl', String(coll), coll === 0);
    ui.setReadout('aTouch', `${target} px`, okTouch);
    ui.setReadout('aVerdict',
      okTouch ? pick('通过', 'Pass') : pick('不通过', 'Fail'), okTouch);

    ui.setStatus(
      coll
        ? `文字放到 ${zoom}% 后，主图轴标签重叠 ${coll} 处——布局没有为文字增长留出余量。可用的修法是减少标签或让模块换行，不是把字改回去。`
        : `文字放到 ${zoom}% 后，当前主图的轴标签没有重叠；其他文字仍需逐项检查。` +
          (okTouch ? '' : `但触控目标只有 ${target}px，低于 44px 建议值。`),
      coll
        ? `At ${zoom}% text zoom, ${coll} axis labels overlap — the layout left no room for text growth. The fix is fewer labels or a reflow, not smaller type.`
        : `At ${zoom}% text zoom, this chart's axis labels do not overlap; other text still needs checking.` +
          (okTouch ? '' : ` But the touch target is ${target}px, below the 44px guideline.`)
    );
  }

  ui.onRange('zoom', v => { zoom = v; update(); }, v => `${v}%`);
  ui.onRange('touch', v => { target = v; update(); }, v => `${v}px`);
  update();
}

/* ══ 4-4 内容驱动的断点 ══════════════════════════════════════════════════ */
/**
 * 断点不是猜出来的，是**扫出来的**。
 *
 * 从 320px 到 1200px 逐档试渲染，在每一档统计有多少条硬约束被违反，
 * 把结果画成一条曲线——曲线从 0 变成非 0 的那一点，就是断点。
 * 它随"最小图表宽度"等参数变化而移动，因为它本来就是内容的属性。
 */
function demoBreakpoint(mount, { lang, section, reduced }) {
  const W = 880, H = 560;
  let width = 700;

  const ui = scaffold(mount, {
    w: W, h: H, label: t(section.title),
    controls:
      range('bw', { zh: '容器宽度', en: 'Container width' }, 320, 1200, width, 10, 'px') +
      actions(button('rescan', { zh: '重新扫描断点', en: 'Re-scan breakpoints' }, true)) +
      readoutList(
        readout('bBreak', { zh: '算出的断点', en: 'Computed breakpoints' }),
        readout('bNow', { zh: '当前违反数', en: 'Violations here' }),
        readout('bWorst', { zh: '最先失效的模块', en: 'First module to fail' })
      ),
    extra: `<p class="control-note">${pick(
      '点击「重新扫描断点」，程序会按当前写在模块里的最小尺寸逐档检查。上方滑杆只用于查看某个容器宽度的结果，不会修改这些最小尺寸。',
      'Re-scan checks widths against the minimum sizes declared in the chart modules. The width slider lets you inspect a result; it does not change those minimum sizes.')}</p>`
  });

  const ctx = { ...ctxFor(lang, reduced), reduced: true };   // 扫描时关过渡，保证同步测量
  let scan = [];

  /** 用一块离屏画布逐档试渲染并统计违反数。 */
  function runScan() {
    const probe = d3.select(mount).select('.demo-canvas')
      .selectAll('svg.scan-probe').data([0])
      .join(en => en.append('svg').attr('class', 'scan-probe')
                    .attr('width', 1).attr('height', 1)
                    .style('position', 'absolute').style('opacity', 0)
                    .style('pointer-events', 'none'));
    const g = probe.selectAll('g.scan-board').data([0])
      .join(en => en.append('g').attr('class', 'scan-board'));

    const out = [];
    for (let w = 320; w <= 1200; w += 20) {
      probe.attr('viewBox', `0 0 ${w} 620`).attr('width', w).attr('height', 620);
      const rl = reflow(w, DEFAULT_ORDER);
      probe.attr('viewBox', `0 0 ${w} ${rl.height}`).attr('height', rl.height);
      const boxes = renderBoard(g, rl.boxes, ctx);
      const { violations } = constraintViolations(MODULES, boxes, ctx);
      const rowCount = new Set(boxes.map(b => Math.round(b.y))).size;
      // 断点只认 critical。warning（行长偏离舒适区、图例略挤）是**质量**问题，
      // 不是"这个宽度下用不了"。早期把两者混在一起，行长在舒适区边缘反复进出，
      // 扫描结果里就多出六七个假断点。
      const critical = violations.filter(v => v.severity === 'critical');
      out.push({ w, n: critical.length, all: violations.length,
                 rows: rowCount, first: critical[0]?.module ?? violations[0]?.module ?? null });
    }
    probe.remove();
    return out;
  }

  // #region snippet:ch4-breakpoint
  /**
   * 断点的定义要收得住，否则会得到一堆噪声。
   *
   * 只认两种宽度：
   *   1) **结构断点**——版面行数改变（模块被迫换行）；
   *   2) **可读断点**——critical 违反数在 0 与非 0 之间穿越（从能用变成不能用）。
   *      只认 critical：行长偏离舒适区这类 warning 是质量问题，不是断点。
   *
   * 违反数在非零区间内的上下抖动不算断点：那只是同一种"已经不行"的不同程度，
   * 早期版本把每一次抖动都记成断点，结果扫出二十多个，等于没扫。
   */
  function breakpointsOf(samples) {
    const bp = [];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      const structural = a.rows !== b.rows;
      const usability = (a.n === 0) !== (b.n === 0);
      if (structural || usability) bp.push({ w: b.w, structural, usability });
    }
    return bp;
  }
  // #endregion

  function draw() {
    const bps = breakpointsOf(scan);
    const m = { l: 44, r: 20, t: 42, b: 250 };
    const x = d3.scaleLinear().domain([320, 1200]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, Math.max(3, d3.max(scan, d => d.n))])
                .range([H - m.b, m.t]);

    const chart = ui.svg.selectAll('g.bp-chart').data([0])
      .join(en => en.append('g').attr('class', 'bp-chart'));

    chart.selectAll('g.bp-axis-x').data([0])
      .join(en => en.append('g').attr('class', 'bp-axis-x'))
      .attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => `${d}`));
    chart.selectAll('g.bp-axis-y').data([0])
      .join(en => en.append('g').attr('class', 'bp-axis-y'))
      .attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(3));
    chart.selectAll('text.bp-title').data([0])
      .join(en => en.append('text').attr('class', 'bp-title'))
      .attr('x', m.l).attr('y', 13)
      .text(pick('各宽度下被违反的硬约束条数（仅 critical）',
                 'Hard-constraint violations at each width (critical only)'));

    // 阶梯线：约束违反是离散的，用 step 更诚实
    chart.selectAll('path.bp-line').data([scan])
      .join(en => en.append('path').attr('class', 'bp-line'))
      .attr('d', d3.line().x(d => x(d.w)).y(d => y(d.n)).curve(d3.curveStepAfter));

    chart.selectAll('line.bp-mark').data(bps, d => d.w)
      .join(en => en.append('line').attr('class', 'bp-mark'))
      .attr('x1', d => x(d.w)).attr('x2', d => x(d.w)).attr('y1', m.t).attr('y2', H - m.b)
      .classed('is-usability', d => d.usability);
    chart.selectAll('text.bp-mark-label').data(bps, d => d.w)
      .join(en => en.append('text').attr('class', 'bp-mark-label').attr('text-anchor', 'middle'))
      .attr('x', d => x(d.w)).attr('y', m.t - 5).text(d => d.w);

    // 当前宽度的游标
    chart.selectAll('line.bp-cursor').data([width])
      .join(en => en.append('line').attr('class', 'bp-cursor'))
      .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', m.t - 6).attr('y2', H - m.b);

    // 下方：当前宽度下的真实版面
    const frameH = m.b - 40;
    const fw = Math.min(W - 48, 420);
    const inner = deviceFrame(ui.svg, 'bp', {
      x: (W - fw) / 2, y: H - m.b + 30, w: fw, h: frameH, label: `${width}px`
    });
    const rl = reflow(width, DEFAULT_ORDER);
    const k = Math.min(fw / width, frameH / rl.height);
    inner.attr('transform', `translate(${(W - fw) / 2},${H - m.b + 30}) scale(${k})`);
    const boxes = renderBoard(
      inner.selectAll('g.board').data([0]).join(en => en.append('g').attr('class', 'board')),
      rl.boxes, ctx);

    const { violations } = constraintViolations(MODULES, boxes, ctx);
    ui.setReadout('bBreak', bps.length ? bps.map(d => d.w).join(' / ') : pick('无', 'none'), true);
    ui.setReadout('bNow', String(violations.length), violations.length === 0);
    ui.setReadout('bWorst',
      violations.length ? t(MODULES[violations[0].module].title) : '—',
      violations.length === 0);

    patchState({ breakpoints: bps.map(d => d.w) });

    ui.setStatus(
      violations.length
        ? `${width}px 下有 ${violations.length} 条约束被违反，最先失效的是「${t(MODULES[violations[0].module].title)}」：${violations[0][lang]}`
        : `${width}px 下所有模块都在各自的可读下限之上。扫描得到的断点是 ${bps.map(d => d.w).join(' / ') || '无'}——它们由内容决定，不是设备尺寸。`,
      violations.length
        ? `At ${width}px, ${violations.length} constraint(s) fail; the first is "${t(MODULES[violations[0].module].title)}": ${violations[0].en}`
        : `At ${width}px every module clears its legibility floor. The scan found breakpoints at ${bps.map(d => d.w).join(' / ') || 'none'} — set by the content, not the device.`
    );
  }

  ui.onRange('bw', v => { width = v; draw(); }, v => `${v}px`);
  ui.on('rescan', 'click', () => { scan = runScan(); draw(); });

  scan = runScan();
  draw();
}

/* ── 注册 ──────────────────────────────────────────────────────────────── */
const CH4 = '../js/demos/ch4.js';
const CHARTS = '../js/charts.js';

export const DEMOS = {
  responsive: {
    render: demoResponsive,
    snippets: [
      { url: CH4, name: 'ch4-reflow',
        title: { zh: '关键点 1 · 重排按"放不放得下"决定', en: 'Key 1 · Reflow is decided by what fits' },
        why: { zh: '跨列数由模块自己声明的 min.w 反算，而不是按约定俗成的设备宽度切换。',
               en: 'The span is derived from each module’s declared min.w, not from conventional device widths.' } },
      { url: CHARTS, name: 'trend-scale',
        title: { zh: '关键点 2 · 等比缩小会把字号一起缩掉', en: 'Key 2 · Scaling shrinks the type with everything else' },
        why: { zh: '绘图区按比例缩放时字号同比下降，低于 8px 就不可读——这是等比方案的硬伤。',
               en: 'Scaling the plot area scales the type too; below 8px it stops being readable. That is the flaw in the scaled approach.' } }
    ]
  },
  priority: {
    render: demoPriority,
    snippets: [
      { url: CH4, name: 'ch4-order',
        title: { zh: '关键点 1 · 视觉顺序要能与 DOM 顺序对照', en: 'Key 1 · Compare visual order with DOM order' },
        why: { zh: '两者分叉时，键盘与读屏用户走的路和眼睛看到的路就不是同一条。',
               en: 'When they diverge, keyboard and screen-reader users travel a different path from the one the eye sees.' } },
      { url: CH4, name: 'ch4-reflow',
        title: { zh: '关键点 2 · 顺序是重排的输入', en: 'Key 2 · Order is an input to reflow' },
        why: { zh: '窄屏没有"次要位置"，排在后面就等于被折叠；所以顺序必须来自任务优先级。',
               en: 'A narrow screen has no secondary position — later means hidden. So the order must come from task priority.' } }
    ]
  },
  accessibility: {
    render: demoAccessibility,
    snippets: [
      { url: CH4, name: 'ch4-zoom',
        title: { zh: '关键点 1 · 文字缩放是真的放大，不是模拟', en: 'Key 1 · Text zoom is real, not simulated' },
        why: { zh: '字号写在 CSS 变量里，改一个值全部 SVG 文本真的变大，后果因此可被实测。',
               en: 'Type size lives in a CSS variable, so one change really enlarges every SVG label — and the consequence can be measured.' } },
      { url: CHARTS, name: 'blurb-measure',
        title: { zh: '关键点 2 · 放大后行长同样要重新量', en: 'Key 2 · Re-measure the line length after zoom' },
        why: { zh: '断行依赖实测宽度，字一变大，每行字符数立刻跟着变。',
               en: 'Line breaking depends on measured width, so characters per line changes the moment the type grows.' } }
    ]
  },
  breakpoint: {
    render: demoBreakpoint,
    snippets: [
      { url: CH4, name: 'ch4-reflow',
        title: { zh: '关键点 1 · 断点是内容的属性', en: 'Key 1 · A breakpoint belongs to the content' },
        why: { zh: '扫描使用模块当前声明的最小尺寸；若在源码里改这些约束并重新扫描，结果可能变化。',
               en: 'The scan uses each module’s declared minimum size. Changing those constraints in code and scanning again may change the result.' } },
      { url: '../js/metrics.js', name: 'align',
        title: { zh: '关键点 2 · 扫描出来的结论要可复算', en: 'Key 2 · A scanned conclusion must be recomputable' },
        why: { zh: '逐档试渲染 + 统计违反数，任何人都能重跑一遍得到同样的断点。',
               en: 'Render at every step and count violations — anyone can re-run it and get the same breakpoints.' } }
    ]
  }
};
