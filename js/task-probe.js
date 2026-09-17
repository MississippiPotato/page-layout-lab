/**
 * task-probe.js —— 限时任务探针。
 *
 * 第 1-1 节让学习者在**乱稿**上限时找答案，记录用时、误点与点击轨迹；
 * 第 5-4 节在**他自己重构过的布局**上再做一次同样的任务，两次并排对照。
 *
 * 这是全课最有说服力的一件事：布局好坏不再靠老师断言，
 * 学习者自己花掉的那十几秒就是证据。
 *
 * 但必须诚实：这是 n=1、非受控的一次自测，第二次还带练习效应。
 * 它演示的是"布局影响视觉搜索"这一机制，不是实验结论——
 * 这句话在界面上始终可见（见 strings.js 的 S.task.caveat），不允许折叠隐藏。
 */

import d3 from './d3.js';
import { t } from './i18n.js';
import { S } from './strings.js';

/**
 * 在一块已渲染的看板上挂一次限时任务。
 *
 * @param {d3.Selection} svg 看板所在的 <svg>
 * @param {{task:object, lang:string, onTick?:fn, onFinish:fn}} opts
 *        task 取自 data.taskBank，其 answer 必须在数据中唯一
 */
export function createProbe(svg, { task, onTick, onFinish }) {
  let startedAt = null;
  let misclicks = 0;
  const path = [];
  let layer = null;

  /** 点击命中判定：优先看条目（data-course），否则看模块（data-module）。 */
  function hitOf(event) {
    const el = event.target.closest('[data-course], [data-module]');
    if (!el) return null;
    return {
      course: el.getAttribute('data-course'),
      module: el.getAttribute('data-module'),
      el
    };
  }

  function onClick(event) {
    if (startedAt === null) return;
    const hit = hitOf(event);
    if (!hit) return;

    const [x, y] = d3.pointer(event, svg.node());
    const ms = performance.now() - startedAt;
    path.push({ x, y, ms });

    const correct = hit.course === task.answer || hit.module === task.answer;
    if (correct) {
      finish(ms, hit);
    } else {
      misclicks++;
      flash(hit.el, false);
      onTick?.({ ms, misclicks, correct: false });
    }
  }

  /** 误点时给一次明确反馈，避免学习者以为没点上。 */
  function flash(el, ok) {
    d3.select(el).classed(ok ? 'probe-hit' : 'probe-miss', true);
    setTimeout(() => d3.select(el).classed('probe-miss', false).classed('probe-hit', false), 420);
  }

  function finish(ms, hit) {
    const at = startedAt;
    startedAt = null;
    svg.node().removeEventListener('click', onClick, true);
    svg.classed('probe-armed', false);
    flash(hit.el, true);
    drawPath();
    onFinish({
      taskId: task.id,
      ms: Math.round(ms),
      misclicks,
      correct: true,
      path: path.slice(),
      at: Date.now()
    });
    return at;
  }

  /**
   * 画出**真实**点击轨迹。 ←→ Draw the learner's real click trail.
   *
   * 注意这与"预测阅读路径"是两回事：这条线是学习者实际点过的地方， ←→ This is not the predicted reading path: it is where the learner actually clicked,
   * 第 1-4 节会把它叠在启发式预测路径上作对照—— ←→ and section 1-4 overlays it on the predicted path for comparison.
   * 预测只是设计意图，实际点击才是发生过的事。 ←→ Prediction expresses intent; the clicks are what actually happened.
   */
  // #region snippet:probe-path
  function drawPath() {
    if (path.length < 1) return;
    layer = svg.selectAll('g.probe-path').data([0])
      .join(en => en.append('g').attr('class', 'probe-path'));

    const line = d3.line().x(d => d.x).y(d => d.y).curve(d3.curveCatmullRom.alpha(0.4));
    layer.selectAll('path.probe-line').data(path.length > 1 ? [path] : [])
      .join(en => en.append('path').attr('class', 'probe-line'))
      .attr('d', line);

    layer.selectAll('circle.probe-dot').data(path, (d, i) => i)
      .join(en => en.append('circle').attr('class', 'probe-dot').attr('r', 7))
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .classed('is-last', (d, i) => i === path.length - 1);

    layer.selectAll('text.probe-num').data(path, (d, i) => i)
      .join(en => en.append('text').attr('class', 'probe-num').attr('text-anchor', 'middle'))
      .attr('x', d => d.x).attr('y', d => d.y + 3.5)
      .text((d, i) => i + 1);
  }
  // #endregion

  return {
    start() {
      startedAt = performance.now();
      misclicks = 0;
      path.length = 0;
      svg.selectAll('g.probe-path').remove();   // 清掉上一轮的轨迹（仅此一处，属于显式重置）
      svg.classed('probe-armed', true);
      // 用捕获阶段，避免被模块自身的交互拦掉
      svg.node().addEventListener('click', onClick, true);
    },
    cancel() {
      startedAt = null;
      svg.classed('probe-armed', false);
      svg.node().removeEventListener('click', onClick, true);
    },
    get running() { return startedAt !== null; }
  };
}

/** 毫秒转成好读的秒数。 */
export const fmtMs = (ms) => `${(ms / 1000).toFixed(1)}s`;

/**
 * 渲染一次任务结果 / 两次对照。
 * baseline 与 retest 都可能为 null，此时只显示还缺哪一半。
 */
export function renderCompare(host, { baseline, retest }, lang) {
  const row = (label, run) => run
    ? `<li><span>${t(label)}</span><b>${fmtMs(run.ms)}</b>
         <i>${t(S.task.misclicks)} ${run.misclicks}</i></li>`
    : `<li class="pending"><span>${t(label)}</span><b>—</b></li>`;

  let delta = '';
  if (baseline && retest) {
    const pct = Math.round(Math.abs(baseline.ms - retest.ms) / baseline.ms * 100);
    const faster = retest.ms < baseline.ms;
    delta = `<p class="probe-delta ${faster ? 'good' : 'bad'}">${
      t(faster ? S.task.faster(pct) : S.task.slower(pct))}</p>`;
  }

  host.innerHTML = `
    <div class="probe-compare">
      <ul>${row(S.task.baseline, baseline)}${row(S.task.retest, retest)}</ul>
      ${delta}
      <p class="probe-caveat">${t(S.task.caveat)}</p>
    </div>`;
}
