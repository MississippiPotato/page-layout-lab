/**
 * demos/kit.js —— 所有演示共用的外壳与控件。
 *
 * 旧实现里每个演示自己拼一遍控制栏 HTML、自己写一遍中英三元，
 * 二十个演示因此长得一模一样，也难以统一修改。
 * 这里把"控制栏 + 画布 + 实测读数 + 体检卡"抽成一套，
 * 各章只负责自己的几何与交互；画布尺寸由各章自行指定，避免千篇一律。
 */

import d3 from '../d3.js';
import { t, pick, esc } from '../i18n.js';
import { S } from '../strings.js';
import { healthCard } from '../metrics.js';

/* ── 控件构造器（返回 HTML 片段） ───────────────────────────────────────── */

export const range = (id, label, min, max, value, step = 1, unit = '') =>
  `<div class="control-group">
     <label for="${id}"><span>${esc(t(label))}</span><b id="${id}Out">${value}${esc(unit)}</b></label>
     <input id="${id}" type="range" min="${min}" max="${max}" value="${value}" step="${step}">
   </div>`;

export const toggle = (id, label, checked = false) =>
  `<label class="toggle-row"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}>
     <span>${esc(t(label))}</span></label>`;

export const button = (id, label, primary = false) =>
  `<button id="${id}" class="demo-btn ${primary ? 'primary' : ''}">${esc(t(label))}</button>`;

export const actions = (...html) => `<div class="demo-actions">${html.join('')}</div>`;

export const select = (id, label, options, value) =>
  `<div class="control-group"><label for="${id}">${esc(t(label))}</label>
     <select id="${id}">${options.map(o =>
       `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${esc(t(o.label))}</option>`
     ).join('')}</select></div>`;

/** 一行实测读数。value 留空由 JS 填。 */
export const readout = (id, label) =>
  `<div class="metric-row" data-metric="${id}">
     <span>${esc(t(label))}</span><b id="${id}">—</b></div>`;

export const readoutList = (...rows) => `<div class="metric-list">${rows.join('')}</div>`;

/**
 * 搭起一个演示：左侧参数栏 + 右侧画布 + 状态读数。
 *
 * @param {HTMLElement} mount
 * @param {{controls:string, w:number, h:number, label:string, extra?:string, hint?:object}} opts
 */
export function scaffold(mount, { controls, w, h, label, extra = '', hint = null }) {
  mount.innerHTML = `
    <div class="demo-shell">
      <aside class="demo-controls">
        <h4>${esc(t(S.controls))}</h4>
        ${controls}
        ${extra}
      </aside>
      <div class="demo-canvas">
        <button type="button" class="demo-expand" aria-label="${esc(pick('全屏演示', 'Fullscreen demo'))}">${esc(pick('⛶ 全屏演示', '⛶ Fullscreen'))}</button>
        <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"></svg>
        ${hint ? `<p class="demo-hint">${esc(t(hint))}</p>` : ''}
        <div class="demo-status" role="status" aria-live="polite"></div>
      </div>
    </div>`;

  const statusEl = mount.querySelector('.demo-status');
  const shell = mount.querySelector('.demo-shell');
  const expand = mount.querySelector('.demo-expand');
  mount._demoFullscreenController?.abort();
  const fullscreenController = new AbortController();
  mount._demoFullscreenController = fullscreenController;
  expand.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === shell) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch (_) { /* Browser may deny fullscreen; the ordinary demo still works. */ }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!shell.isConnected) return;
    const active = document.fullscreenElement === shell;
    expand.textContent = active ? pick('退出全屏', 'Exit fullscreen') : pick('⛶ 全屏演示', '⛶ Fullscreen');
    expand.setAttribute('aria-label', active ? pick('退出全屏', 'Exit fullscreen') : pick('全屏演示', 'Fullscreen demo'));
  }, { signal: fullscreenController.signal });
  return {
    mount,
    svg: d3.select(mount).select('svg'),
    controls: mount.querySelector('.demo-controls'),
    status: statusEl,
    w, h,
    /** 写状态行。传 {zh,en} 或两个字符串。 */
    setStatus(msg, en) {
      statusEl.textContent = en === undefined ? t(msg) : pick(msg, en);
    },
    /** 绑定一个 range 控件：值变化时回调，并同步右上角数字。 */
    onRange(id, fn, format = v => v) {
      const el = mount.querySelector('#' + id);
      const out = mount.querySelector('#' + id + 'Out');
      if (!el) return;
      if (out) out.textContent = format(el.value);
      el.addEventListener('input', () => {
        if (out) out.textContent = format(el.value);
        fn(+el.value);
      });
    },
    on(id, event, fn) {
      mount.querySelector('#' + id)?.addEventListener(event, fn);
    },
    /** 更新一行实测读数，并按是否达标着色。 */
    setReadout(id, value, ok = null) {
      const el = mount.querySelector('#' + id);
      if (!el) return;
      el.textContent = value;
      if (ok !== null) el.classList.toggle('bad', !ok);
    }
  };
}

/* ── 体检卡 ────────────────────────────────────────────────────────────── */

/**
 * 渲染「布局体检卡」。刻意**不合成单一总分**：
 * 五个指标量纲不同（个 / px / 字符），加权相加只会得到一个没有含义的数字，
 * 而旧版那个 0–100 分正是这么算出来的。这里改为逐项呈现 + 指出下一步。
 */
export function renderHealth(host, measured, lang) {
  const card = healthCard(measured, lang);
  host.innerHTML = `
    <div class="health-card${card.passing ? ' is-ok' : ''}">
      <h5>${esc(t(S.health))}</h5>
      <ul>${card.items.map(i => `
        <li class="${i.ok ? 'ok' : 'bad'}">
          <span>${esc(i.label)}</span>
          <b>${i.value}${esc(i.unit || '')}</b>
        </li>`).join('')}</ul>
      <p class="health-next">${card.passing
        ? esc(t(S.healthOk))
        : `<b>${esc(t(S.nextFix))}</b>${esc(card.next.hint)}`}</p>
      <p class="health-note">${esc(t(S.measuredNote))}</p>
    </div>`;
  return card;
}

/** 把看板画在一个带边框的"页面"里，让容器边界可见。 */
export function pageFrame(svg, { x, y, w, h }) {
  svg.selectAll('rect.page-frame').data([0])
    .join(en => en.insert('rect', ':first-child').attr('class', 'page-frame').attr('rx', 10))
    .attr('x', x).attr('y', y).attr('width', w).attr('height', h);
}
