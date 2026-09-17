/**
 * portal.js —— 课程门户。
 *
 * 语言状态与取词统一走 js/i18n.js，不再自己实现一套；
 * D3 由页面上的 <script> 以 UMD 方式先行加载（见 js/d3.js 的说明）。
 */

import { COURSE as C } from './course-data.js';
import d3 from './js/d3.js';
import { t as tx, linkFor, getLang, setLang } from './js/i18n.js';
import { renderBoard, gridBand } from './js/charts.js';
import * as data from './data/campus.js';

/** 本模块内的语言快照；切换后由 setLang() 返回新值并重新 render()。 */
let lang = getLang();

function languageSwitch(light = false) {
  return `<div class="lang-switch ${light ? 'light' : ''}" role="group" aria-label="切换语言 / Switch language">
    <button data-lang="zh" class="${lang === 'zh' ? 'active' : ''}">中</button>
    <button data-lang="en" class="${lang === 'en' ? 'active' : ''}">EN</button>
  </div>`;
}

function render() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = `${tx(C.meta.title)} · ${lang === 'zh' ? 'D3 页面布局课程' : 'D3 Page Layout Course'}`;
  const hero = document.getElementById('portalHero');
  hero.innerHTML = `<div class="hero-lang">${languageSwitch()}</div>
    <div class="hero-shell">
      <div class="hero-copy">
        <p class="eyebrow">VISUALIZATION · LAYOUT CURRICULUM</p>
        <h1>${tx(C.meta.title)}<span class="hero-en">PAGE LAYOUT STUDIO</span></h1>
        <p class="hero-question">${tx(C.meta.question)}</p>
        <p class="hero-intro">${tx(C.meta.intro)}</p>
        <div class="hero-stats">${C.meta.stats.map(d => `<span>${tx(d)}</span>`).join('')}</div>
      </div>
      <div class="hero-visual"><svg id="heroBlueprint" class="blueprint-stage" viewBox="0 0 560 390" role="img" aria-label="${lang === 'zh' ? '从混乱布局到清晰布局的动态演示' : 'Animated transition from chaotic to clear layout'}"></svg></div>
    </div>`;

  document.getElementById('portalNav').innerHTML = `<div class="portal-nav-inner">
    <a class="portal-brand" href="#top"><b>LAYOUT</b> / STUDIO</a>
    <div class="portal-links"><a href="#chapters">${tx(C.ui.chapters)}</a><a href="#route">${tx(C.ui.route)}</a><a href="#how">${tx(C.ui.how)}</a></div>
  </div>`;

  const cards = C.chapters.map((ch, i) => `<a class="chapter-card" style="--accent:${ch.accent}" href="${linkFor(`./${ch.slug}/`)}">
    <div class="card-top"><span class="chapter-no">${tx(C.ui.chapterLabel)} ${String(i + 1).padStart(2, '0')}</span><span class="live-badge">● ${tx(C.ui.live)}</span></div>
    <h3>${tx(ch.title)}</h3><p class="en-title">${ch.title.en}</p><p class="desc">${tx(ch.desc)}</p>
    <ul class="tag-list">${ch.tags.map(tag => `<li>${tx(tag)}</li>`).join('')}</ul>
    <span class="card-cta">${tx(C.ui.enter)} · ${ch.sections.length} ${tx(C.ui.sections)} <i>→</i></span>
  </a>`).join('');

  const route = C.chapters.map((ch, i) => `<div class="route-step" style="--accent:${ch.accent}"><b>${String(i + 1).padStart(2, '0')} / ${tx(ch.title)}</b><p>${tx(ch.outcome)}</p></div>`).join('');
  document.getElementById('portalMain').className = 'portal-main';
  document.getElementById('portalMain').innerHTML = `<section id="chapters">
    <div class="section-head"><div><p class="eyebrow" style="color:var(--primary)">COURSE MAP · 01—05</p><h2>${tx(C.ui.chapters)}</h2></div><p>${tx(C.meta.subtitle)}</p></div>
    <div class="chapter-grid">${cards}</div>
  </section>
  <section id="route" class="route-section"><div class="section-head"><div><p class="eyebrow" style="color:var(--primary)">ONE CASE · FIVE DECISIONS</p><h2>${tx(C.ui.route)}</h2></div><p>${lang === 'zh' ? '五章都用 Campus Pulse 的同一套数据。先做查找任务，再调整布局，最后用原题复测；中间还要检查分组和窄屏。' : 'All five chapters use the same Campus Pulse data. Start with a search task, adjust the layout, and repeat that task at the end; grouping and small screens are checked along the way.'}</p></div><div class="route-track">${route}</div></section>
  <section id="how" class="info-grid"><article class="info-panel"><h2>${tx(C.ui.how)}</h2><ol class="how-list">${C.how.map(d => `<li>${tx(d)}</li>`).join('')}</ol></article><article class="info-panel dark"><h2>${tx(C.ui.sources)}</h2><ul class="source-list">${C.sources.map(d => `<li>${d}</li>`).join('')}</ul></article></section>`;
  document.getElementById('siteFooter').textContent = tx(C.ui.footer);
  bindLanguage();
  renderHeroBlueprint();
}

function bindLanguage() {
  document.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => {
    lang = setLang(btn.dataset.lang);
    render();
  }));
}

// #region snippet:hero
/**
 * 门户首屏：让**真实的看板**在"混乱初稿"与"重构版"之间来回切换。
 *
 * 旧版这里画的是六个灰色矩形，动画只是矩形在挪位置——首屏就没有可视化，
 * 和课程主张相矛盾。现在用的是与课程完全相同的 charts.js：
 * 真实数据、真实图表、带 key 的 data-join，模块是**移动过去**的。
 *
 * 顺带把最后一处 selectAll('*').remove() 也去掉了：
 * 课程第 5-1 节教对象连续性，门户首屏更不该自己打自己的脸。
 */
const HERO = { w: 560, h: 390 };

/**
 * 混乱初稿：主图不够主、四条边各走各的、排行榜不排序。
 *
 * 要点是"设计得不好"，不是"渲染坏了"：每个模块仍然给足了自己的可读下限，
 * 所以文字不会糊成一团。首屏如果看起来像 bug，读者只会以为网站坏了，
 * 而不会读到"这是一份布局没做好的看板"。
 */
const HERO_DRAFT = [
  { id: 'trend',   x: 92,  y: 14,  w: 450, h: 104 },   // 主图偏矮，趋势被压平
  { id: 'ranking', x: 20,  y: 132, w: 250, h: 230 },   // 左边缘与主图差 72px
  { id: 'heat',    x: 286, y: 140, w: 254, h: 110 },   // 顶边又比排行低 8px
  { id: 'blurb',   x: 286, y: 264, w: 246, h: 98  }    // 右边缘差 8px
];

/** 重构版：主图占主导、边缘共线、相关模块相邻。 */
function heroFixed() {
  const band = gridBand(12, HERO.w, { margin: 20, gutter: 12 });
  const col = (i, n) => ({ x: band(i), w: band.spanWidth(n) });
  return [
    { id: 'trend',   main: true, ...col(0, 12), y: 20,  h: 150 },
    { id: 'ranking', ...col(0, 7),  y: 182, h: 186 },
    { id: 'heat',    ...col(7, 5),  y: 182, h: 108 },
    { id: 'blurb',   ...col(7, 5),  y: 300, h: 68 }
  ];
}

let heroFixedState = false;

function renderHeroBlueprint() {
  const svg = d3.select('#heroBlueprint');
  if (svg.empty()) return;

  const ctx = {
    lang, data,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    t: 900, rankSorted: heroFixedState, highlightWorst: heroFixedState
  };

  const boxes = heroFixedState ? heroFixed() : HERO_DRAFT.map(d => ({ ...d }));
  renderBoard(svg, boxes, ctx);

  svg.selectAll('text.hero-caption').data([heroFixedState])
    .join(en => en.append('text').attr('class', 'hero-caption'))
    .attr('x', 20).attr('y', HERO.h - 6)
    .text(d => d
      ? (lang === 'zh' ? '重构版 · 排序 + 共线 + 主次分明' : 'Rebuilt · sorted, aligned, clear hierarchy')
      : (lang === 'zh' ? '混乱初稿 · 排行未排序，最低项未标出' : 'Messy draft · ranking unsorted, lowest unmarked'));

  window.clearInterval(window.__layoutHeroTimer);
  if (!ctx.reduced) {
    window.__layoutHeroTimer = window.setInterval(() => {
      heroFixedState = !heroFixedState;
      renderHeroBlueprint();
    }, 3200);
  }
}
// #endregion

render();
