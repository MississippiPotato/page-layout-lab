/**
 * xray-site.js —— 用课程自己的审计办法，检查这个教学网站自己。
 *
 * 第 5-3 节的 Layout X-Ray 审计的是演示里的看板；这里把同一套办法
 * 转向本站的真实 DOM：量 getBoundingClientRect()，画出内容列的边界、
 * 基线网格、以及每个可点元素的触控目标尺寸。
 *
 * 之所以值得做：一门讲布局的课，应该敢把自己的尺子架在自己身上。
 * 如果本站的列对不齐、触控目标不足 44px，这个按钮会直接把它暴露出来——
 * 那也是一种诚实。
 */

import { t, pick } from './i18n.js';
import { S } from './strings.js';

const NS = 'http://www.w3.org/2000/svg';
const OVERLAY_ID = 'siteXrayOverlay';

// #region snippet:xray-site
/**
 * 量本站真实 DOM 的布局事实。 ←→ Measure the layout facts of this site's real DOM.
 *
 * 全部来自 getBoundingClientRect()——也就是浏览器最终算出来的位置， ←→ Everything comes from getBoundingClientRect(): the position the browser actually computed,
 * 不是 CSS 源码里写的意图。二者不一致的时候，前者才是用户看到的。 ←→ not the intent written in the CSS. When the two disagree, the former is what users see.
 */
function auditSite() {
  const facts = { columns: [], baselines: [], targets: [], container: null };

  // 内容容器：以主内容区的实际边界作为"容器" ←→ Container: take the main content area's real bounds as the container
  const main = document.querySelector('.lesson-content, .portal-main, main');
  if (main) {
    const r = main.getBoundingClientRect();
    facts.container = { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  }

  // 列边界：取主内容区里各区块的左右边，去重后就是本站实际用到的列线 ←→ Column edges: collect each block's left and right edges; de-duplicated, these are the column lines the site actually uses
  const blocks = document.querySelectorAll(
    '.lesson-section, .chapter-sidebar, .demo-controls, .demo-canvas, .chapter-card, .info-panel');
  const edges = new Set();
  blocks.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 2) return;
    edges.add(Math.round(r.x + scrollX));
    edges.add(Math.round(r.right + scrollX));
  });
  facts.columns = [...edges].sort((a, b) => a - b);

  // 触控目标：WCAG 2.5.5 建议 44x44px，这里量所有可点元素的真实尺寸 ←→ Touch targets: WCAG 2.5.5 asks for 44x44px; measure every interactive element's real size
  document.querySelectorAll('button, a, select, input[type=range]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    facts.targets.push({
      x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height,
      ok: r.width >= 44 && r.height >= 44
    });
  });

  // 基线：以正文行高为步长，铺一层水平参考线 ←→ Baselines: lay horizontal guides at the body line-height step
  const probe = document.querySelector('.lesson-content p, .portal-main p, p');
  const lh = probe ? parseFloat(getComputedStyle(probe).lineHeight) || 24 : 24;
  const top = facts.container ? facts.container.y : 0;
  const bottom = facts.container ? facts.container.y + facts.container.h : document.body.scrollHeight;
  for (let y = top; y < bottom; y += lh) facts.baselines.push(y);

  return facts;
}
// #endregion

function buildOverlay(facts) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', OVERLAY_ID);
  svg.setAttribute('width', document.documentElement.scrollWidth);
  svg.setAttribute('height', document.documentElement.scrollHeight);
  Object.assign(svg.style, {
    position: 'absolute', left: '0', top: '0',
    pointerEvents: 'none', zIndex: '9998'
  });

  const add = (tag, attrs, cls) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (cls) el.setAttribute('class', cls);
    svg.appendChild(el);
    return el;
  };

  for (const y of facts.baselines) {
    add('line', { x1: 0, x2: svg.getAttribute('width'), y1: y, y2: y }, 'xs-baseline');
  }
  for (const x of facts.columns) {
    add('line', { x1: x, x2: x, y1: 0, y2: svg.getAttribute('height') }, 'xs-column');
  }
  if (facts.container) {
    add('rect', { x: facts.container.x, y: facts.container.y,
                  width: facts.container.w, height: facts.container.h }, 'xs-container');
  }
  let small = 0;
  for (const tgt of facts.targets) {
    add('rect', { x: tgt.x, y: tgt.y, width: tgt.w, height: tgt.h, rx: 4 },
        tgt.ok ? 'xs-target' : 'xs-target xs-target-small');
    if (!tgt.ok) small++;
  }
  return { svg, small };
}

function buildPanel(facts, small) {
  const el = document.createElement('div');
  el.className = 'xray-panel';
  el.innerHTML = `
    <h5>${t(S.xraySite)}</h5>
    <ul>
      <li><span>${pick('检出列线', 'Column edges')}</span><b>${facts.columns.length}</b></li>
      <li><span>${pick('基线步长', 'Baseline step')}</span><b>${
        facts.baselines.length > 1
          ? (facts.baselines[1] - facts.baselines[0]).toFixed(1) + 'px' : '—'}</b></li>
      <li><span>${pick('可点元素', 'Interactive elements')}</span><b>${facts.targets.length}</b></li>
      <li class="${small ? 'bad' : 'ok'}"><span>${pick('小于 44px 的目标', 'Targets under 44px')}</span><b>${small}</b></li>
    </ul>
    <p>${small
      ? pick(`本站有 ${small} 个可点元素小于 WCAG 建议的 44x44px。把尺子架在自己身上，就要接受量出来的结果。`,
             `This site has ${small} interactive elements below the WCAG 44x44px guideline. If you turn the ruler on yourself, you accept what it reads.`)
      : pick('本站所有可点元素都达到 44x44px。', 'Every interactive element here meets 44x44px.')}</p>`;
  return el;
}

/** 绑定顶栏那颗按钮。页面每次重渲染后都要重新调用。 */
export function bindSiteXray(button) {
  if (!button || button.dataset.bound === '1') return;
  button.dataset.bound = '1';

  button.addEventListener('click', () => {
    const on = document.getElementById(OVERLAY_ID);
    if (on) {
      on.remove();
      document.querySelector('.xray-panel')?.remove();
      button.setAttribute('aria-pressed', 'false');
      return;
    }
    const facts = auditSite();
    const { svg, small } = buildOverlay(facts);
    document.body.appendChild(svg);
    document.body.appendChild(buildPanel(facts, small));
    button.setAttribute('aria-pressed', 'true');
  });
}

/** 语言切换或重渲染时，关掉可能残留的叠层，避免坐标错位。 */
export function closeSiteXray() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.querySelector('.xray-panel')?.remove();
}
