/**
 * shell.js —— 章节页外壳：导航、小节切换、三标签页、路由、语言切换。
 *
 * 这部分是从旧 lesson.js 迁过来的，因为它本来就写得不错：
 * 完整的 WAI tablist（role/aria-selected/roving tabindex/方向键）、
 * URL 三元状态（lang/section/tab）+ popstate、移动端小节选择器。
 * 迁移时**原样保留这些可访问性行为**，只改结构与依赖：
 *
 *   - 拆成 ES module，不再是一个 76KB 的 IIFE
 *   - 演示交给 registry.js，外壳不认识任何具体演示
 *   - 「关键代码」改由 snippets.js 从运行中的源码抽取，不再手写副本
 */

import { COURSE } from '../course-data.js';
import { t, pick, esc, linkFor, getLang, setLang, applyDocumentLang } from './i18n.js';
import { S } from './strings.js';
import { extract, highlight } from './snippets.js';
import { getDemo } from './registry.js';
import { markVisited } from './state.js';
import { bindSiteXray, closeSiteXray } from './xray-site.js';

const TABS = ['explain', 'code', 'demo'];

const chapterIndex = Number(document.body.dataset.chapter || 0);
const chapter = COURSE.chapters[chapterIndex];

const params = new URLSearchParams(location.search);
const clampSection = (n) =>
  Math.max(0, Math.min(chapter.sections.length - 1, Number.isFinite(n) ? n : 0));

let activeSection = clampSection(Number(params.get('section')));
let activeTab = TABS.includes(params.get('tab')) ? params.get('tab') : 'explain';

/* ── 路由 ──────────────────────────────────────────────────────────────── */
function updateRoute(push = false) {
  const url = new URL(location.href);
  url.searchParams.set('lang', getLang());
  url.searchParams.set('section', activeSection);
  url.searchParams.set('tab', activeTab);
  history[push ? 'pushState' : 'replaceState']({ activeSection, activeTab }, '', url);
}

function switchSection(i) {
  activeSection = clampSection(i);
  activeTab = 'explain';
  updateRoute(true);
  render();
  document.querySelector('.lesson-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── 视图 ──────────────────────────────────────────────────────────────── */
function sectionHTML(s, i) {
  const isActive = i === activeSection;
  const tab = isActive ? activeTab : 'explain';
  const num = `${chapterIndex + 1}.${i + 1}`;
  const theory = s.theory.map(d => `<li>${esc(t(d))}</li>`).join('');

  const tabBtn = (key, label) => `<button id="tab-${s.id}-${key}" role="tab"
      aria-controls="panel-${s.id}-${key}" aria-selected="${tab === key}"
      tabindex="${tab === key ? '0' : '-1'}"
      class="${tab === key ? 'active' : ''}" data-tab="${key}">${esc(t(label))}</button>`;

  const panel = (key, body) => `<section id="panel-${s.id}-${key}"
      aria-labelledby="tab-${s.id}-${key}" role="tabpanel"
      class="tab-panel${tab === key ? ' active' : ''}" data-panel="${key}">${body}</section>`;

  return `<article class="lesson-section${isActive ? ' active' : ''}" data-section-panel="${i}">
    <header class="section-banner"><span class="section-number">${num}</span>
      <div><h2>${esc(t(s.title))}</h2><p class="section-en">${esc(s.title.en)}</p>
      <p>${esc(t(s.subtitle))}</p></div></header>

    <div class="lesson-tabs" role="tablist" aria-label="${esc(t(s.title))}">
      ${tabBtn('explain', COURSE.ui.explain)}${tabBtn('code', COURSE.ui.code)}${tabBtn('demo', COURSE.ui.demo)}
    </div>

    ${panel('explain', `<div class="explain-lead${i === 0 ? '' : ' no-case'}">
      ${i === 0 ? `<div class="case-block"><h3>${esc(chapterIndex === 0
        ? pick('情景导入', 'Scenario') : pick('本章情景', 'Chapter Scenario'))}</h3>
        ${chapterIndex === 0 ? `<p class="case-question">${esc(pick('能否快速找出完成率最低的课程？', 'Can you quickly find the course with the lowest completion?'))}</p>` : ''}
        ${chapter.case ? `<div class="case-context"><b>${esc(t(COURSE.ui.caseContext))}</b>
          <span>${esc(t(chapter.case))}</span></div>` : ''}</div>` : ''}
      <div class="theory-block"><h3>${esc(t(COURSE.ui.theory))}</h3><ul>${theory}</ul></div></div>
      <div class="key-pit-grid">
        <div class="teaching-note"><b>${esc(t(COURSE.ui.keyPoint))}</b><p>${esc(t(s.key))}</p></div>
        <div class="teaching-note pit"><b>${esc(t(COURSE.ui.pitfall))}</b><p>${esc(t(s.pit))}</p></div>
      </div>`)}

    ${panel('code', `<div class="code-stack" id="code-${s.id}">
        <p class="code-loading">${pick('正在从运行中的源码抽取…', 'Extracting from the running source…')}</p>
      </div>`)}

    ${panel('demo', `<div class="demo-intro">
        <div><h3>${esc(t(COURSE.ui.try))}</h3><p>${esc(t(s.subtitle))}</p></div>
        <span class="demo-tag">D3.JS · INTERACTIVE</span></div>
      <div class="demo-mount" id="demo-${s.id}"></div>`)}
  </article>`;
}

function render() {
  applyDocumentLang();
  document.title = `${chapterIndex + 1}. ${t(chapter.title)} · ${t(COURSE.meta.title)}`;

  const lang = getLang();
  const topLinks = COURSE.chapters.map((ch, i) =>
    `<a class="${i === chapterIndex ? 'active' : ''}" href="${linkFor(`../${ch.slug}/`)}">${i + 1}. ${esc(t(ch.title))}</a>`).join('');
  const sectionNav = chapter.sections.map((s, i) =>
    `<button data-section="${i}" class="${i === activeSection ? 'active' : ''}">
       <b>${chapterIndex + 1}.${i + 1}</b><span>${esc(t(s.title))}</span></button>`).join('');
  const sectionOptions = chapter.sections.map((s, i) =>
    `<option value="${i}" ${i === activeSection ? 'selected' : ''}>${chapterIndex + 1}.${i + 1} ${esc(t(s.title))}</option>`).join('');

  const prev = chapterIndex > 0 ? COURSE.chapters[chapterIndex - 1] : null;
  const next = chapterIndex < COURSE.chapters.length - 1 ? COURSE.chapters[chapterIndex + 1] : null;
  const pagerLink = (ch, dirLabel, arrow) => ch
    ? `<a class="pager-link" href="${linkFor(`../${ch.slug}/`)}"><small>${arrow} ${esc(t(dirLabel))}</small><b>${esc(t(ch.title))}</b></a>`
    : '<span class="pager-link pager-empty"></span>';

  const app = document.getElementById('lessonApp');
  app.style.setProperty('--accent', chapter.accent);
  app.innerHTML = `
    <nav class="course-topbar" aria-label="${esc(t(COURSE.ui.chapters))}">
      <a class="back-portal" href="${linkFor('../')}">← ${esc(t(COURSE.ui.portal))}</a>
      <div class="course-chapter-tabs">${topLinks}</div>
      <div class="topbar-tools">
        <button id="xraySiteBtn" class="xray-toggle" aria-pressed="false">${esc(t(S.xraySite))}</button>
        <div class="lang-switch light">
          <button data-lang="zh" class="${lang === 'zh' ? 'active' : ''}">中</button>
          <button data-lang="en" class="${lang === 'en' ? 'active' : ''}">EN</button>
        </div>
      </div>
    </nav>

    <header class="lesson-hero"><div class="lesson-hero-inner"><div>
      <p class="eyebrow">CAMPUS PULSE · PHASE ${String(chapterIndex + 1).padStart(2, '0')}</p>
      <h1>${esc(t(chapter.title))}</h1>
      <p class="chapter-en">${esc(chapter.title.en)}</p>
      <p class="chapter-desc">${esc(t(chapter.desc))}</p>
    </div></div></header>

    <main class="lesson-shell">
      <aside class="chapter-sidebar">
        <h2>${esc(t(COURSE.ui.toc))}</h2>
        <nav class="section-nav">${sectionNav}</nav>
        <div class="sidebar-progress">
          <div class="progress-label"><span>${esc(t(COURSE.ui.progress))}</span>
            <b>${activeSection + 1} / ${chapter.sections.length}</b></div>
          <i><b style="width:${((activeSection + 1) / chapter.sections.length) * 100}%"></b></i>
        </div>
      </aside>
      <div class="lesson-content">
        <div class="mobile-section-select">
          <label for="sectionSelect">${esc(t(COURSE.ui.menu))}</label>
          <select id="sectionSelect">${sectionOptions}</select>
        </div>
        ${chapter.sections.map(sectionHTML).join('')}
      </div>
    </main>

    <nav class="chapter-pager">
      ${pagerLink(prev, COURSE.ui.previous, '←')}
      <a class="pager-portal" href="${linkFor('../')}">${esc(t(COURSE.ui.portal))}</a>
      ${pagerLink(next, COURSE.ui.nextChapter, '→')}
    </nav>
    <footer class="site-footer">${esc(t(COURSE.ui.footer))}</footer>`;

  bindEvents();
  // 页面重渲染后坐标全变了，先关掉可能残留的透视叠层
  closeSiteXray();
  bindSiteXray(document.getElementById('xraySiteBtn'));
  const section = chapter.sections[activeSection];
  markVisited(`${chapterIndex + 1}.${activeSection + 1}`);
  renderCode(section);
  if (activeTab === 'demo') renderDemo(section);
}

/* ── 关键代码：从运行中的源码抽取 ──────────────────────────────────────── */
async function renderCode(section) {
  const host = document.getElementById(`code-${section.id}`);
  if (!host) return;
  const demo = getDemo(section.demo);
  const specs = demo?.snippets ?? [];

  if (!specs.length) {
    host.innerHTML = `<p class="code-loading">${pick('本节暂无关键代码。', 'No key code for this section yet.')}</p>`;
    return;
  }

  const results = await Promise.all(specs.map(sp => extract(sp.url, sp.name, getLang())));
  const cards = results.map((r, i) => {
    const sp = specs[i];
    if (!r) {
      return `<article class="code-point"><header><h3>${esc(t(sp.title))}</h3></header>
        <p class="code-missing">${pick('抽取失败：请确认已通过 http 服务器打开本站。',
          'Extraction failed — make sure the site is served over http.')}</p></article>`;
    }
    const file = sp.url.split('/').pop();
    return `<article class="code-point">
      <header><h3>${esc(t(sp.title))}</h3>
        <span class="code-origin">${esc(file)} · L${r.lines[0]}–${r.lines[1]}</span></header>
      <pre><code>${highlight(r.code)}</code></pre>
      <p><b>${esc(t(COURSE.ui.why))}${pick('：', ': ')}</b>${esc(t(sp.why))}</p>
    </article>`;
  }).join('');

  host.innerHTML = `<div class="code-mode code-live">${
    pick('以下代码实时取自本页正在运行的源码，不是手写副本。',
         'The code below is read live from this page’s running source — not a hand-written copy.')
  }</div>${cards}`;
}

/* ── 演示 ──────────────────────────────────────────────────────────────── */
/**
 * 渲染演示。
 *
 * 必须等 document.fonts.ready 之后再渲染：本课的指标全部来自 getBBox() /
 * getComputedTextLength() 的实测，而字体未落定时浏览器给的是回退字体的尺寸。
 * 实测过：同一个轴标签在字体落定前是 29.4px、落定后是 23.7px——
 * 前者会让一张本来合格的图被报成「12 个标签全部重叠」。
 * 量之前先确认量的是最终状态，否则"实测"并不比"估算"更可信。
 */
async function renderDemo(section) {
  const mount = document.getElementById(`demo-${section.id}`);
  if (!mount || mount.dataset.rendered === section.id + getLang()) return;
  const demo = getDemo(section.demo);
  if (!demo) {
    mount.innerHTML = `<p class="demo-pending">${
      pick('本节演示正在重做中。', 'This demo is being rebuilt.')}</p>`;
    return;
  }
  mount.dataset.rendered = section.id + getLang();
  try { await document.fonts.ready; } catch { /* 不支持就直接渲染 */ }
  // 等待期间可能已经切走了语言或小节，确认一下再画
  if (mount.dataset.rendered !== section.id + getLang()) return;
  demo.render(mount, {
    lang: getLang(),
    section, chapter, chapterIndex,
    accent: chapter.accent,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  });
}

/* ── 事件 ──────────────────────────────────────────────────────────────── */
function bindEvents() {
  document.querySelectorAll('[data-lang]').forEach(btn =>
    btn.addEventListener('click', () => { setLang(btn.dataset.lang); render(); }));

  document.querySelectorAll('.section-nav button').forEach(btn =>
    btn.addEventListener('click', () => switchSection(+btn.dataset.section)));

  document.getElementById('sectionSelect')
    ?.addEventListener('change', e => switchSection(+e.target.value));

  document.querySelectorAll('.lesson-tabs button').forEach(btn =>
    btn.addEventListener('click', () => activateTab(btn)));

  // 保留旧实现的 WAI tablist 键盘行为：方向键 / Home / End
  document.querySelectorAll('.lesson-tabs').forEach(list =>
    list.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      const cur = tabs.indexOf(document.activeElement);
      if (cur < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
        : (cur + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      activateTab(tabs[next]);
    }));
}

function activateTab(btn) {
  const article = btn.closest('.lesson-section');
  article.querySelectorAll('.lesson-tabs button').forEach(b => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  article.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));

  activeTab = btn.dataset.tab;
  updateRoute(true);
  if (activeTab === 'demo') renderDemo(chapter.sections[+article.dataset.sectionPanel]);
}

/* ── 启动 ──────────────────────────────────────────────────────────────── */
export function start() {
  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(location.search);
    activeSection = clampSection(Number(p.get('section')));
    activeTab = TABS.includes(p.get('tab')) ? p.get('tab') : 'explain';
    render();
  });
  updateRoute(false);
  render();
}
