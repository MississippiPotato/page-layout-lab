(function () {
  const C = window.COURSE;
  const chapterIndex = Number(document.body.dataset.chapter || 0);
  const chapter = C.chapters[chapterIndex];
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') || localStorage.getItem('layout-course-lang') || 'zh';
  if (!['zh', 'en'].includes(lang)) lang = 'zh';
  const routeSection = Number(params.get('section'));
  let activeSection = Number.isInteger(routeSection) ? Math.max(0, Math.min(chapter.sections.length - 1, routeSection)) : 0;
  let activeTab = ['explain', 'code', 'demo'].includes(params.get('tab')) ? params.get('tab') : 'explain';
  const tx = value => typeof value === 'string' ? value : value[lang];
  const esc = text => String(text).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const linkFor = href => `${href}${href.includes('?') ? '&' : '?'}lang=${lang}`;
  const moduleNames = {
    chart:{zh:'每周活跃趋势',en:'Weekly activity'}, active:{zh:'今日活跃',en:'Active today'}, complete:{zh:'完成率',en:'Completion'},
    ranking:{zh:'课程排行',en:'Course ranking'}, recent:{zh:'最近活动',en:'Recent activity'}, device:{zh:'设备分布',en:'Device mix'}
  };
  const nameOf = id => tx(moduleNames[id]);

  const CODE = {
    audit: [`const issues = d3.group(observations, d => d.type);\n\nissueLayer.selectAll("g.issue")\n  .data(issues, d => d[0])\n  .join("g")\n  .attr("class", "issue");`, `const coverage = d3.mean(ISSUE_TYPES, type =>\n  selected.has(type) ? 1 : 0\n);\n\nscoreScale.domain([0, 1]);`],
    matrix: [`const x = d3.scaleLinear().domain([1, 5]).range([54, width - 30]);\nconst y = d3.scaleLinear().domain([1, 5]).range([height - 42, 24]);`, `const drag = d3.drag().on("drag", (event, d) => {\n  d.frequency = x.invert(event.x);\n  d.impact = y.invert(event.y);\n  updatePriority();\n});`],
    hierarchy: [`const size = d3.scaleLinear()\n  .domain([1, 5])\n  .range([1, 4]);\n\nmodules.forEach(d => d.span = size(d.importance));`, `cards.data(layout, d => d.id)\n  .join(enter => enter.append("g"))\n  .transition().duration(500)\n  .attr("transform", d => \`translate(\${d.x},\${d.y})\`);`],
    path: [`const salience = d3.sum([\n  areaWeight(d), positionWeight(d),\n  contrastWeight(d), whitespaceWeight(d)\n]);`, `const ordered = [...modules].sort((a,b) => b.salience - a.salience);\nconst path = d3.line().curve(d3.curveCatmullRom.alpha(.4));`],
    grid: [`const x = d3.scaleBand()\n  .domain(d3.range(columns))\n  .range([margin, width - margin])\n  .paddingInner(gutterRatio);`, `cards.data(layout, d => d.id)\n  .join("g")\n  .transition().duration(600)\n  .attr("transform", d => \`translate(\${x(d.col)},\${d.y})\`);`],
    alignment: [`const nearest = value => gridLines.reduce((a,b) =>\n  Math.abs(b - value) < Math.abs(a - value) ? b : a\n);`, `const error = Math.abs(card.x - nearest(card.x));\ncard.x = nearest(card.x);\nselection.transition().duration(650).attr("transform", position);`],
    ratio: [`const split = d3.scaleLinear().domain([45, 80]).range([0, innerWidth]);\nconst mainWidth = split(mainPercent);\nconst sideWidth = innerWidth - mainWidth - gutter;`, `const readable = lineLength >= 45 && lineLength <= 75;\nfeedback.attr("fill", readable ? success : warning);`],
    rhythm: [`const space = d3.scaleOrdinal()\n  .domain(["xs","sm","md","lg","xl"])\n  .range([1,2,3,5,8].map(n => n * base));`, `rows.data(items, d => d.id).join("g")\n  .transition().duration(450)\n  .attr("transform", (_,i) => \`translate(0,\${i * space("xl")})\`);`],
    proximity: [`const x = d3.scalePoint()\n  .domain(items.map(d => d.id))\n  .range([start, end])\n  .padding(.5);`, `const perceptualGap = betweenGap / insideGap;\nconst grouped = perceptualGap >= 2;\nregions.attr("opacity", grouped ? 1 : .15);`],
    region: [`const groups = d3.groups(items, d => d.group);\nconst hulls = groups.map(([key, values]) => ({ key, bounds: extent(values) }));`, `regionLayer.selectAll("rect")\n  .data(hulls, d => d.key)\n  .join("rect")\n  .transition().attr("opacity", commonRegion ? 1 : 0);`],
    density: [`const padding = d3.scaleLinear().domain([0, 100]).range([6, 28]);\nconst cardGap = padding(breathingRoom);`, `const crowding = d3.mean(cards, d => Math.min(1, d.content / d.area));\nconst scanCost = cards.length * averageDistance(cards);`],
    composition: [`const layouts = { article: articleLayout, dashboard: dashboardLayout, form: formLayout };\nconst layout = layouts[mode](modules, width);`, `modulesG.data(layout, d => d.id).join("g")\n  .transition().duration(650)\n  .attr("transform", d => \`translate(\${d.x},\${d.y})\`);`],
    responsive: [`const mode = width < 560 ? "mobile" : width < 920 ? "tablet" : "desktop";\nconst layout = layoutByMode(mode, modules);`, `cards.data(layout, d => d.id).join("g")\n  .transition().duration(420)\n  .attr("transform", d => \`translate(\${d.x},\${d.y})\`);`],
    priority: [`const visible = modules\n  .filter(d => width > d.minWidth || d.priority >= 4)\n  .sort((a,b) => b.priority - a.priority);`, `const visualOrder = visible.map(d => d.id);\nconst domOrder = modules.map(d => d.id);\nreportOrderConflict(visualOrder, domOrder);`],
    accessibility: [`const fontPx = baseFont * zoom / 100;\nconst requiredHeight = lines * fontPx * lineHeight + padding * 2;`, `cards.attr("height", d => Math.max(d.minHeight, requiredHeight(d)))\n  .attr("aria-label", d => d.label);\ntargets.attr("r", targetSize / 2);`],
    breakpoint: [`const fails = chartWidth < minChart || navWidth > availableWidth;\nconst mode = fails ? "stack" : "columns";`, `if (mode !== previousMode) {\n  cards.transition().duration(400).attr("transform", reflow);\n  breakpointLabel.text(\`switch @ \${width}px\`);\n}`],
    beforeafter: [`const layout = modules.map(d => ({\n  ...d, ...stageLayouts[stage][d.id]\n}));`, `cards.data(layout, d => d.id).join("g")\n  .transition().duration(420)\n  .attr("transform", d => \`translate(\${d.x},\${d.y})\`);`],
    lab: [`const drag = d3.drag().on("drag", (event,d) => {\n  d.x = clamp(event.x - d.w/2); d.y = clamp(event.y - d.h/2);\n  updateLayout(d); updateMetrics();\n});`, `const score = d3.sum([\n  alignment * .35, spacing * .25,\n  hierarchy * .25, overflow * .15\n]);`],
    xray: [`const error = card.x - nearestGridLine(card.x);\nannotations.push({ id: card.id, error, fix: -error });`, `annotation.selectAll("line").data(errors, d => d.id).join("line")\n  .attr("class", d => Math.abs(d.error) > 4 ? "error-line" : "guide-line");`],
    multiscreen: [`const screens = [1200, 768, 375];\nconst views = screens.map(width => ({ width, cards: layoutByWidth(width) }));`, `screenG.selectAll("g.card").data(d => d.cards, d => d.id).join("g")\n  .attr("transform", d => \`translate(\${d.x},\${d.y})\`);`]
  };

  const B = (zh, en) => ({ zh, en });
  const CODE_META = {
    audit:[B('按问题类型建立诊断状态','Model issue types as diagnostic state'),B('把勾选结果换算成覆盖率','Convert selections into audit coverage'),B('勾选四类症状，观察覆盖率与画布标注同步变化。','Select the four symptoms and watch coverage and canvas annotations update together.')],
    matrix:[B('把频率与影响映射到坐标','Map frequency and impact to position'),B('拖动后重新计算任务优先级','Recalculate task priority after dragging'),B('拖动模块；坐标与右侧优先级排序使用同一份数据。','Drag a module; its position and priority ranking use the same data.')],
    hierarchy:[B('把重要性映射为空间权重','Map importance to spatial weight'),B('用稳定 ID 更新模块位置','Update module positions with stable IDs'),B('改变重要性，观察面积、位置和阅读路径如何共同变化。','Change importance and observe area, position, and reading path together.')],
    path:[B('建立显著性排序假设','Build a salience-order hypothesis'),B('把排序结果绘制成阅读路径','Draw the ordered result as a reading path'),B('路径只表达当前权重假设，不代表真实眼动数据。','The path expresses the current weighting hypothesis, not eye-tracking evidence.')],
    grid:[B('由列数、边距与沟槽计算坐标','Compute coordinates from columns, margins, and gutters'),B('用共享列线更新卡片位置','Update cards on shared column lines'),B('调整网格参数，再打乱并吸附卡片，比较平均对齐误差。','Adjust the grid, then break and snap cards while comparing mean alignment error.')],
    alignment:[B('计算最近的共享参考线','Find the nearest shared reference line'),B('用误差驱动吸附反馈','Use measured error to drive snapping feedback'),B('从打乱状态开始，吸附后观察误差归零。','Start from the broken state and watch error fall to zero after snapping.')],
    ratio:[B('由任务比例计算主栏宽度','Compute main-column width from task ratio'),B('用行长区间判断可读性风险','Evaluate readability with a line-length range'),B('拖动主栏比例，观察行长与侧栏上下文的权衡。','Drag the main-column ratio and observe the trade-off between line length and sidebar context.')],
    rhythm:[B('把基础单位扩展成间距尺度','Expand a base unit into a spacing scale'),B('用同一尺度生成垂直节奏','Generate vertical rhythm from one scale'),B('改变基础单位与内容行数，检查重复基线是否仍成立。','Change the base unit and row count to test whether the repeated baseline still holds.')],
    proximity:[B('计算组内与组间距离比','Calculate the between/within gap ratio'),B('把距离比转换成分组反馈','Turn the gap ratio into grouping feedback'),B('让两种距离逐渐接近，观察分组何时变得含糊。','Bring the two gaps closer and observe when grouping becomes ambiguous.')],
    region:[B('按语义分组计算共同区域','Compute common regions by semantic group'),B('让区域随分组状态显隐','Show or hide regions with grouping state'),B('比较只有距离与增加共同区域后的分组强度。','Compare distance-only grouping with grouping reinforced by common regions.')],
    density:[B('由模块数量与内边距计算卡片','Compute cards from count and padding'),B('把密度转换成拥挤风险','Convert density into crowding risk'),B('增加模块或减少内边距，观察扫描风险如何上升。','Add modules or reduce padding and observe scanning risk rise.')],
    composition:[B('按主要任务选择页面模式','Select a composition from the primary task'),B('用同一模块数据切换组成','Recompose the same modules by stable ID'),B('切换监控、阅读、填写任务，比较同一内容的三种页面组成。','Switch among monitoring, reading, and input tasks to compare three compositions of the same content.')],
    responsive:[B('按内容阈值选择布局模式','Choose a layout mode from content thresholds'),B('在阈值处重排而非整体缩小','Reflow at thresholds instead of shrinking'),B('拖动视口宽度，观察列数与顺序在阈值处改变。','Drag viewport width and watch columns and order change at thresholds.')],
    priority:[B('按任务优先级确定窄屏顺序','Set narrow-screen order from task priority'),B('比较视觉顺序与内容顺序','Compare visual and content order'),B('缩窄视口后，主图会提前而不是被等比压缩。','Narrow the viewport; the primary chart moves earlier instead of shrinking proportionally.')],
    accessibility:[B('由文字缩放计算所需高度','Compute required height from text zoom'),B('同时验证触控目标下限','Validate the touch-target minimum'),B('把文字放大到 200%，并将触控目标调到 44px 以下比较风险。','Zoom text to 200% and compare targets above and below 44px.')],
    breakpoint:[B('用内容最低宽度触发断点','Trigger breakpoints from minimum content width'),B('只在约束失败时改变结构','Change structure only when a constraint fails'),B('改变容器与图表最低宽度，观察触发堆叠的真实条件。','Change container and chart minimum widths to observe the actual stacking condition.')],
    beforeafter:[B('为每个阶段保存独立布局状态','Store an explicit layout for each stage'),B('用稳定 ID 过渡到下一阶段','Transition to the next stage with stable IDs'),B('逐格拖动时间线；每一步只引入一种布局决策。','Scrub one step at a time; each stage introduces one layout decision.')],
    lab:[B('拖动时更新同一份卡片数据','Update the same card data while dragging'),B('按四项可解释指标合成评分','Combine four explainable metrics'),B('制造问题、拖动模块并重置，比较每项指标的变化。','Make the layout messy, drag modules, and reset while comparing each metric.')],
    xray:[B('计算到目标网格的误差向量','Compute error vectors to target grid lines'),B('把误差与修复方向画在卡片旁','Draw errors and repair directions beside cards'),B('红色误差线指出偏移，间距标注给出当前值与目标值。','Red error lines show offsets; gap labels compare current and target values.')],
    multiscreen:[B('从同一内容模型生成多屏布局','Generate multi-screen layouts from one content model'),B('在各宽度复用稳定模块身份','Reuse stable module IDs at every width'),B('提高文字缩放，检查三个视图何时暴露固定高度风险。','Increase text zoom and inspect when fixed-height risks appear across the three views.')]
  };

  function renderApp() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = `${chapterIndex + 1}. ${tx(chapter.title)} · ${tx(C.meta.title)}`;
    const topLinks = C.chapters.map((ch, i) => `<a class="${i === chapterIndex ? 'active' : ''}" href="${linkFor(`../${ch.slug}/`)}">${i + 1}. ${tx(ch.title)}</a>`).join('');
    const sectionOptions = chapter.sections.map((s, i) => `<option value="${i}" ${i === activeSection ? 'selected' : ''}>${chapterIndex + 1}.${i + 1} ${tx(s.title)}</option>`).join('');
    const sectionNav = chapter.sections.map((s, i) => `<button data-section="${i}" class="${i === activeSection ? 'active' : ''}"><b>${chapterIndex + 1}.${i + 1}</b><span>${tx(s.title)}</span></button>`).join('');
    const sections = chapter.sections.map((s, i) => renderSection(s, i)).join('');
    const prev = chapterIndex > 0 ? C.chapters[chapterIndex - 1] : null;
    const next = chapterIndex < C.chapters.length - 1 ? C.chapters[chapterIndex + 1] : null;
    document.getElementById('lessonApp').style.setProperty('--accent', chapter.accent);
    document.getElementById('lessonApp').innerHTML = `<nav class="course-topbar" aria-label="${tx(C.ui.chapters)}">
      <a class="back-portal" href="${linkFor('../')}">← ${tx(C.ui.portal)}</a><div class="course-chapter-tabs">${topLinks}</div>
      <div class="lang-switch light"><button data-lang="zh" class="${lang === 'zh' ? 'active' : ''}">中</button><button data-lang="en" class="${lang === 'en' ? 'active' : ''}">EN</button></div>
    </nav>
    <header class="lesson-hero"><div class="lesson-hero-inner"><div><p class="eyebrow">CAMPUS PULSE · PHASE ${String(chapterIndex + 1).padStart(2,'0')}</p><h1>${tx(chapter.title)}</h1><p class="chapter-en">${chapter.title.en}</p><p class="chapter-desc">${tx(chapter.desc)}</p></div><div class="chapter-counter"><span>${tx(C.ui.chapterLabel)}</span><b>0${chapterIndex + 1}</b></div></div></header>
    <main class="lesson-shell"><aside class="chapter-sidebar"><h2>${tx(C.ui.toc)}</h2><nav class="section-nav">${sectionNav}</nav><div class="sidebar-progress"><div class="progress-label"><span>${tx(C.ui.progress)}</span><b>${activeSection + 1} / ${chapter.sections.length}</b></div><div class="progress-track"><i style="width:${(activeSection + 1) / chapter.sections.length * 100}%"></i></div></div></aside>
      <div class="lesson-content"><div class="mobile-section-select"><label for="sectionSelect">${tx(C.ui.menu)}</label><select id="sectionSelect">${sectionOptions}</select></div>${sections}</div>
    </main>
    <nav class="chapter-pager">${prev ? `<a class="pager-link" href="${linkFor(`../${prev.slug}/`)}"><small>← ${tx(C.ui.previous)}</small><b>${tx(prev.title)}</b></a>` : '<span class="pager-link pager-empty"></span>'}<a class="pager-portal" href="${linkFor('../')}">${tx(C.ui.portal)}</a>${next ? `<a class="pager-link next" href="${linkFor(`../${next.slug}/`)}"><small>${tx(C.ui.nextChapter)} →</small><b>${tx(next.title)}</b></a>` : '<span class="pager-link pager-empty"></span>'}</nav>
    <footer class="site-footer">${tx(C.ui.footer)}</footer>`;
    bindEvents();
    renderDemo(chapter.sections[activeSection]);
  }

  function renderSection(s, i) {
    const active = i === activeSection ? ' active' : '';
    const tab = i === activeSection ? activeTab : 'explain';
    const theory = s.theory.map(d => `<li>${tx(d)}</li>`).join('');
    const snippets = CODE[s.demo] || CODE.hierarchy;
    const codeMeta = CODE_META[s.demo] || CODE_META.hierarchy;
    return `<article class="lesson-section${active}" data-section-panel="${i}">
      <header class="section-banner"><span class="section-number">${chapterIndex + 1}.${i + 1}</span><div><h2>${tx(s.title)}</h2><p class="section-en">${s.title.en}</p><p>${tx(s.subtitle)}</p></div></header>
      <div class="lesson-tabs" role="tablist" aria-label="${tx(s.title)}"><button id="tab-${s.id}-explain" role="tab" aria-controls="panel-${s.id}-explain" aria-selected="${tab === 'explain'}" tabindex="${tab === 'explain' ? '0' : '-1'}" class="${tab === 'explain' ? 'active' : ''}" data-tab="explain">${tx(C.ui.explain)}</button><button id="tab-${s.id}-code" role="tab" aria-controls="panel-${s.id}-code" aria-selected="${tab === 'code'}" tabindex="${tab === 'code' ? '0' : '-1'}" class="${tab === 'code' ? 'active' : ''}" data-tab="code">${tx(C.ui.code)}</button><button id="tab-${s.id}-demo" role="tab" aria-controls="panel-${s.id}-demo" aria-selected="${tab === 'demo'}" tabindex="${tab === 'demo' ? '0' : '-1'}" class="${tab === 'demo' ? 'active' : ''}" data-tab="demo">${tx(C.ui.demo)}</button></div>
      <section id="panel-${s.id}-explain" aria-labelledby="tab-${s.id}-explain" role="tabpanel" class="tab-panel${tab === 'explain' ? ' active' : ''}" data-panel="explain"><div class="explain-lead"><div class="case-block"><h3>${tx(C.ui.caseProblem)}</h3><p class="case-question">${tx(s.subtitle)}</p><div class="case-context"><b>${tx(C.ui.caseContext)}</b><span>${tx(chapter.case)}</span></div></div><div class="theory-block"><h3>${tx(C.ui.theory)}</h3><ul>${theory}</ul></div></div><div class="key-pit-grid"><div class="teaching-note"><b>${tx(C.ui.keyPoint)}</b><p>${tx(s.key)}</p></div><div class="teaching-note pit"><b>${tx(C.ui.pitfall)}</b><p>${tx(s.pit)}</p></div></div></section>
      <section id="panel-${s.id}-code" aria-labelledby="tab-${s.id}-code" role="tabpanel" class="tab-panel${tab === 'code' ? ' active' : ''}" data-panel="code"><div class="code-mode">${tx(C.ui.codeSimplified)}</div><div class="code-stack"><article class="code-point"><header><h3>${tx(codeMeta[0])}</h3><span>01 / MODEL</span></header><pre><code>${highlight(snippets[0])}</code></pre><p><b>${tx(C.ui.why)}：</b> ${tx(s.key)}</p></article><article class="code-point"><header><h3>${tx(codeMeta[1])}</h3><span>02 / UPDATE</span></header><pre><code>${highlight(snippets[1])}</code></pre><p><b>${tx(C.ui.observe)}：</b> ${tx(codeMeta[2])}</p></article></div></section>
      <section id="panel-${s.id}-demo" aria-labelledby="tab-${s.id}-demo" role="tabpanel" class="tab-panel${tab === 'demo' ? ' active' : ''}" data-panel="demo"><div class="demo-intro"><div><h3>${tx(C.ui.try)}</h3><p>${tx(s.subtitle)}</p></div><span class="demo-tag">D3.JS · INTERACTIVE</span></div><div class="demo-mount" id="demo-${s.id}"></div></section>
      </article>`;
  }

  function highlight(code) {
    return esc(code)
      .replace(/(\/\/[^\n]*)/g, '<span class="cmt">$1</span>')
      .replace(/\b(const|let|if|else|return|new)\b/g, '<span class="fn">$1</span>')
      .replace(/("[^"\n]*"|'[^'\n]*')/g, '<span class="str">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>');
  }

  function bindEvents() {
    document.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => {
      lang = btn.dataset.lang; localStorage.setItem('layout-course-lang', lang);
      const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState({}, '', url); renderApp();
    }));
    document.querySelectorAll('.section-nav button').forEach(btn => btn.addEventListener('click', () => switchSection(+btn.dataset.section)));
    const select = document.getElementById('sectionSelect'); if (select) select.addEventListener('change', () => switchSection(+select.value));
    document.querySelectorAll('.lesson-tabs button').forEach(btn => btn.addEventListener('click', () => {
      const section = btn.closest('.lesson-section');
      section.querySelectorAll('.lesson-tabs button').forEach(b => b.classList.toggle('active', b === btn));
      section.querySelectorAll('.lesson-tabs button').forEach(b => { b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); b.tabIndex = b === btn ? 0 : -1; });
      section.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
      activeTab = btn.dataset.tab;
      updateRouteState(true);
      if (btn.dataset.tab === 'demo') renderDemo(chapter.sections[+section.dataset.sectionPanel]);
    }));
    document.querySelectorAll('.lesson-tabs').forEach(list => list.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    }));
  }

  function updateRouteState(push = false) {
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    url.searchParams.set('section', activeSection);
    url.searchParams.set('tab', activeTab);
    history[push ? 'pushState' : 'replaceState']({}, '', url);
  }

  function switchSection(i) {
    activeSection = i;
    activeTab = 'explain';
    updateRouteState(true);
    renderApp();
    document.querySelector('.lesson-shell').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function demoBase(section, controls, extra = '') {
    const mount = document.getElementById(`demo-${section.id}`); if (!mount) return null;
    mount.innerHTML = `<div class="demo-shell"><aside class="demo-controls"><h4>${lang === 'zh' ? '实验参数' : 'LAB CONTROLS'}</h4>${controls}${extra}</aside><div class="demo-canvas"><svg viewBox="0 0 720 430" role="img" aria-label="${esc(tx(section.title))}"></svg><div class="demo-status" role="status" aria-live="polite"></div></div></div>`;
    return { mount, svg:d3.select(mount).select('svg'), status:mount.querySelector('.demo-status'), controls:mount.querySelector('.demo-controls') };
  }
  const range = (id,label,min,max,value,step=1) => `<div class="control-group"><label for="${id}"><span>${label}</span><b id="${id}Out">${value}</b></label><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" step="${step}"></div>`;
  const action = (id,label,primary=false) => `<button id="${id}" class="demo-btn ${primary?'primary':''}">${label}</button>`;
  const statusText = (zh,en) => lang === 'zh' ? zh : en;
  const setStatus = (base, zh, en) => base.status.textContent = statusText(zh,en);
  function defs(svg) { const d=svg.append('defs'); d.append('marker').attr('id','arrow').attr('viewBox','0 0 10 10').attr('refX',8).attr('refY',5).attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto').append('path').attr('d','M0,0 L10,5 L0,10z').attr('fill','#ff6b4a'); }
  const baseModules = () => [
    {id:'chart',value:'8.4K',importance:5},{id:'active',value:'8,392',importance:4},{id:'complete',value:'72%',importance:4},{id:'ranking',value:'#1',importance:3},{id:'recent',value:'24',importance:2},{id:'device',value:'62%',importance:1}
  ];
  function drawCard(g,d) { g.append('rect').attr('class',d.main?'svg-card main':'svg-card').attr('rx',7).attr('width',d.w).attr('height',d.h); g.append('text').attr('class','svg-label').attr('x',12).attr('y',24).text(nameOf(d.id)); g.append('text').attr('class','svg-value').attr('x',12).attr('y',50).text(d.value||''); }

  function renderDemo(section) {
    if (!window.d3) return;
    const fn = {
      audit:demoAudit,matrix:demoMatrix,hierarchy:demoHierarchy,path:demoPath,grid:demoGrid,alignment:demoAlignment,ratio:demoRatio,rhythm:demoRhythm,
      proximity:demoProximity,region:demoRegion,density:demoDensity,composition:demoComposition,responsive:demoResponsive,priority:demoPriority,
      accessibility:demoAccessibility,breakpoint:demoBreakpoint,beforeafter:demoBeforeAfter,lab:demoLab,xray:demoXray,multiscreen:demoMultiscreen
    }[section.demo];
    if (fn) fn(section);
  }

  function demoAudit(section) {
    const issueNames={hierarchy:{zh:'层级',en:'Hierarchy'},alignment:{zh:'对齐',en:'Alignment'},grouping:{zh:'分组',en:'Grouping'},overflow:{zh:'溢出',en:'Overflow'}};
    const controls=Object.entries(issueNames).map(([id,n])=>`<label class="toggle-row"><input type="checkbox" data-issue="${id}"> ${tx(n)}</label>`).join('')+`<div class="demo-actions">${action('auditAll',lang==='zh'?'显示全部问题':'Show all issues',true)}${action('auditReset',tx(C.ui.reset))}</div><div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'诊断覆盖':'Audit coverage'}</span><b id="auditScore">0%</b><i><b id="auditBar" style="width:0%"></b></i></div></div>`;
    const b=demoBase(section,controls); const svg=b.svg; defs(svg);
    const cards=[{id:'active',x:46,y:62,w:170,h:112,value:'8,392'},{id:'chart',x:244,y:52,w:380,h:116,value:'8.4K'},{id:'complete',x:72,y:205,w:238,h:74,value:'72%'},{id:'ranking',x:345,y:205,w:280,h:150,value:'#1'},{id:'recent',x:42,y:326,w:260,h:56,value:'24'}];
    svg.append('rect').attr('class','svg-frame').attr('x',16).attr('y',16).attr('width',688).attr('height',398).attr('rx',10);
    const cg=svg.selectAll('g.card').data(cards).join('g').attr('transform',d=>`translate(${d.x},${d.y})`); cg.each(function(d){drawCard(d3.select(this),d)});
    const issueData={hierarchy:{x:35,y:42,w:600,h:145,label:'01'},alignment:{x:32,y:185,w:610,h:185,label:'02'},grouping:{x:320,y:190,w:320,h:180,label:'03'},overflow:{x:34,y:318,w:285,h:80,label:'04'}};
    const selected=new Set();
    const update=()=>{const data=[...selected].map(k=>({...issueData[k],id:k}));const g=svg.selectAll('g.issue').data(data,d=>d.id).join(enter=>{const n=enter.append('g').attr('class','issue');n.append('rect').attr('fill','none').attr('stroke','#ff6b4a').attr('stroke-width',2).attr('stroke-dasharray','6 4').attr('rx',8);n.append('circle').attr('r',13).attr('fill','#ff6b4a');n.append('text').attr('fill','#fff').attr('font-size',10).attr('font-weight',800).attr('text-anchor','middle').attr('dy','.35em');return n;});g.select('rect').attr('x',d=>d.x).attr('y',d=>d.y).attr('width',d=>d.w).attr('height',d=>d.h);g.select('circle').attr('cx',d=>d.x+10).attr('cy',d=>d.y);g.select('text').attr('x',d=>d.x+10).attr('y',d=>d.y).text(d=>d.label);const score=selected.size/4*100;b.controls.querySelector('#auditScore').textContent=`${score}%`;b.controls.querySelector('#auditBar').style.width=`${score}%`;setStatus(b,score===100?'已定位四类结构问题。下一步先修层级，再修网格。':`已标注 ${selected.size}/4 类问题。`,score===100?'All four structural issue types found. Repair hierarchy first, then the grid.':`${selected.size}/4 issue types marked.`)};
    b.controls.querySelectorAll('[data-issue]').forEach(el=>el.addEventListener('change',()=>{el.checked?selected.add(el.dataset.issue):selected.delete(el.dataset.issue);update()}));b.controls.querySelector('#auditAll').onclick=()=>{b.controls.querySelectorAll('[data-issue]').forEach(el=>{el.checked=true;selected.add(el.dataset.issue)});update()};b.controls.querySelector('#auditReset').onclick=()=>{selected.clear();b.controls.querySelectorAll('[data-issue]').forEach(el=>el.checked=false);update()};update();
  }

  function demoMatrix(section) {
    const b=demoBase(section,`<p style="font-size:.8rem;color:var(--muted)">${lang==='zh'?'拖动模块：横轴是使用频率，纵轴是决策影响。':'Drag modules: frequency is horizontal; decision impact is vertical.'}</p><div class="metric-list" id="priorityList"></div>`);const svg=b.svg, x=d3.scaleLinear().domain([1,5]).range([75,675]),y=d3.scaleLinear().domain([1,5]).range([365,45]);
    const data=baseModules().slice(0,5).map((d,i)=>({...d,frequency:[4.6,4.2,3.3,2.1,1.5][i],impact:[4.8,3.4,4.0,2.6,1.5][i]}));
    svg.append('g').attr('class','axis').attr('transform','translate(0,365)').call(d3.axisBottom(x).ticks(5));svg.append('g').attr('class','axis').attr('transform','translate(75,0)').call(d3.axisLeft(y).ticks(5));svg.append('line').attr('x1',x(3)).attr('x2',x(3)).attr('y1',45).attr('y2',365).attr('class','guide-line');svg.append('line').attr('x1',75).attr('x2',675).attr('y1',y(3)).attr('y2',y(3)).attr('class','guide-line');svg.append('text').attr('class','svg-meta').attr('x',675).attr('y',405).attr('text-anchor','end').text(lang==='zh'?'任务频率 →':'TASK FREQUENCY →');svg.append('text').attr('class','svg-meta').attr('transform','translate(22,45) rotate(-90)').text(lang==='zh'?'决策影响 →':'DECISION IMPACT →');
    const update=()=>{const node=svg.selectAll('g.node').data(data,d=>d.id).join(enter=>{const g=enter.append('g').attr('class','node drag-card');g.append('circle').attr('r',28).attr('fill',chapter.accent).attr('fill-opacity','.88');g.append('text').attr('text-anchor','middle').attr('dy','.32em').attr('fill','#fff').attr('font-size',9).attr('font-weight',750);return g;}).attr('transform',d=>`translate(${x(d.frequency)},${y(d.impact)})`).attr('tabindex',0).attr('role','slider').attr('aria-label',d=>`${nameOf(d.id)} · ${lang==='zh'?'方向键调整频率与影响':'Use arrow keys to adjust frequency and impact'}`).on('keydown',(e,d)=>{const step=.2;if(e.key==='ArrowLeft')d.frequency-=step;else if(e.key==='ArrowRight')d.frequency+=step;else if(e.key==='ArrowUp')d.impact+=step;else if(e.key==='ArrowDown')d.impact-=step;else return;e.preventDefault();d.frequency=Math.max(1,Math.min(5,d.frequency));d.impact=Math.max(1,Math.min(5,d.impact));update()});node.select('text').text(d=>nameOf(d.id));node.call(d3.drag().on('drag',(e,d)=>{d.frequency=Math.max(1,Math.min(5,x.invert(e.x)));d.impact=Math.max(1,Math.min(5,y.invert(e.y)));update()}));const ranked=[...data].sort((a,b)=>b.frequency*b.impact-a.frequency*a.impact);b.controls.querySelector('#priorityList').innerHTML=ranked.slice(0,4).map((d,i)=>`<div class="metric-row"><span>0${i+1} ${nameOf(d.id)}</span><b>${(d.frequency*d.impact).toFixed(1)}</b><i><b style="width:${d.frequency*d.impact/25*100}%"></b></i></div>`).join('');setStatus(b,`当前核心层：${nameOf(ranked[0].id)}。优先级来自频率 × 影响。`,`Current core layer: ${nameOf(ranked[0].id)}. Priority comes from frequency × impact.`)};update();
  }

  function hierarchyLayout(data){const sorted=[...data].sort((a,b)=>b.importance-a.importance),scale=d3.scaleLinear().domain([1,5]).range([120,370]);let x=38,y=55,rowH=0;return sorted.map(d=>{const w=Math.min(scale(d.importance),640);const h=d.importance>=5?160:d.importance>=3?94:68;if(x+w>680){x=38;y+=rowH+15;rowH=0}const out={...d,x,y,w,h};x+=w+15;rowH=Math.max(rowH,h);return out})}
  function hierarchyControls(data,showPath){return data.slice(0,5).map(d=>range(`imp-${d.id}`,nameOf(d.id),1,5,d.importance)).join('')+`<label class="toggle-row"><input id="showRead" type="checkbox" ${showPath?'checked':''}> ${lang==='zh'?'显示启发式阅读路径':'Show heuristic reading path'}</label>`}
  function demoHierarchy(section,forcePath=false) {const data=baseModules().slice(0,5);const b=demoBase(section,hierarchyControls(data,forcePath));const svg=b.svg;defs(svg);svg.append('rect').attr('class','svg-frame').attr('x',15).attr('y',15).attr('width',690).attr('height',400).attr('rx',10);const update=()=>{const layout=hierarchyLayout(data);const cards=svg.selectAll('g.hcard').data(layout,d=>d.id).join(enter=>{const g=enter.append('g').attr('class','hcard');g.each(function(d){drawCard(d3.select(this),d)});return g;});cards.transition().duration(450).attr('transform',d=>`translate(${d.x},${d.y})`);cards.select('rect').transition().duration(450).attr('width',d=>d.w).attr('height',d=>d.h).attr('class',d=>d.importance===5?'svg-card main':'svg-card');const show=b.controls.querySelector('#showRead').checked;const pts=layout.map(d=>[d.x+d.w/2,d.y+d.h/2]);svg.selectAll('path.reading-path').data(show?[pts]:[]).join('path').attr('class','reading-path').attr('d',d3.line().curve(d3.curveCatmullRom.alpha(.35)));setStatus(b,show?'路径按视觉重量排序；它解释设计意图，不是眼动数据。':'提高模块重要性，观察它获得的面积与位置。',show?'The path follows visual weight; it explains intent, not eye-tracking data.':'Raise a module’s importance and watch it gain area and position.')};data.forEach(d=>{const el=b.controls.querySelector(`#imp-${d.id}`);el.addEventListener('input',()=>{d.importance=+el.value;b.controls.querySelector(`#imp-${d.id}Out`).textContent=el.value;update()})});b.controls.querySelector('#showRead').addEventListener('change',update);update()}
  function demoPath(section){demoHierarchy(section,true)}

  function demoGridCore(section,brokenStart=false){let state={columns:12,margin:46,gutter:14,broken:brokenStart};const controls=range('gridCols',lang==='zh'?'列数':'Columns',6,12,12)+range('gridMargin',lang==='zh'?'边距':'Margin',24,72,46)+range('gridGutter',lang==='zh'?'沟槽':'Gutter',6,28,14)+`<label class="toggle-row"><input id="showGrid" type="checkbox" checked> ${lang==='zh'?'显示网格':'Show grid'}</label><div class="demo-actions">${action('breakGrid',lang==='zh'?'打乱网格':'Break grid')}${action('snapGrid',lang==='zh'?'吸附网格':'Snap to grid',true)}</div><div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'平均对齐误差':'Mean alignment error'}</span><b id="alignError">0 px</b><i><b id="alignBar" style="width:100%"></b></i></div></div>`;const b=demoBase(section,controls),svg=b.svg;const data=[{id:'active',col:0,span:3,y:60,h:80,value:'8,392'},{id:'complete',col:3,span:3,y:60,h:80,value:'72%'},{id:'ranking',col:6,span:3,y:60,h:80,value:'#1'},{id:'device',col:9,span:3,y:60,h:80,value:'62%'},{id:'chart',col:0,span:8,y:158,h:200,value:'8.4K'},{id:'recent',col:8,span:4,y:158,h:200,value:'24'}];const offsets=new Map(data.map((d,i)=>[d.id,brokenStart?{x:(i%2?13:-9),y:(i%3-1)*8}:{x:0,y:0}]));
    const update=()=>{svg.selectAll('*').remove();svg.append('rect').attr('class','svg-frame').attr('x',12).attr('y',12).attr('width',696).attr('height',406).attr('rx',10);const inner=720-state.margin*2,step=inner/state.columns,band=step-state.gutter;if(b.controls.querySelector('#showGrid').checked)svg.selectAll('rect.grid-guide').data(d3.range(state.columns)).join('rect').attr('class','grid-guide').attr('x',d=>state.margin+d*step).attr('y',43).attr('width',Math.max(2,band)).attr('height',342);const layout=data.map(d=>{const off=offsets.get(d.id);return {...d,x:state.margin+d.col*step+off.x,y:d.y+off.y,w:d.span*step-state.gutter}});const cards=svg.selectAll('g.gcard').data(layout,d=>d.id).join('g').attr('class','gcard').attr('transform',d=>`translate(${d.x},${d.y})`);cards.each(function(d){drawCard(d3.select(this),d)});const errors=layout.map(d=>Math.abs(offsets.get(d.id).x));const error=d3.mean(errors);b.controls.querySelector('#alignError').textContent=`${error.toFixed(1)} px`;b.controls.querySelector('#alignBar').style.width=`${Math.max(0,100-error*6)}%`;setStatus(b,state.broken?'轻微偏移累积成明显视觉噪声。点击“吸附网格”。':`${state.columns} 列共享同一套边缘与沟槽。`,state.broken?'Small offsets accumulate into visible noise. Snap the cards back to the grid.':`${state.columns} columns now share the same edges and gutters.`)};
    [['gridCols','columns'],['gridMargin','margin'],['gridGutter','gutter']].forEach(([id,key])=>{const el=b.controls.querySelector(`#${id}`);el.oninput=()=>{state[key]=+el.value;b.controls.querySelector(`#${id}Out`).textContent=el.value;offsets.forEach(v=>{v.x=0;v.y=0});state.broken=false;update()}});b.controls.querySelector('#showGrid').onchange=update;b.controls.querySelector('#breakGrid').onclick=()=>{offsets.forEach((v,k)=>{const i=data.findIndex(d=>d.id===k);v.x=(i%2?1:-1)*(8+i*2);v.y=(i%3-1)*7});state.broken=true;update()};b.controls.querySelector('#snapGrid').onclick=()=>{offsets.forEach(v=>{v.x=0;v.y=0});state.broken=false;update()};update()}
  function demoGrid(section){demoGridCore(section,false)}function demoAlignment(section){demoGridCore(section,true)}

  function demoRatio(section){let pct=68;const b=demoBase(section,range('mainPct',lang==='zh'?'主栏比例':'Main column',48,80,pct)+`<div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'文本可读性':'Text readability'}</span><b id="readability">—</b><i><b id="ratioBar"></b></i></div></div>`);const svg=b.svg;const update=()=>{svg.selectAll('*').remove();const x=35,y=55,total=650,gap=18,main=(total-gap)*pct/100,side=total-gap-main;svg.append('rect').attr('class','svg-frame').attr('x',18).attr('y',20).attr('width',684).attr('height',385).attr('rx',10);const data=[{id:'chart',x,y,w:main,h:290,value:'8.4K',main:true},{id:'ranking',x:x+main+gap,y,w:side,h:290,value:'#1'}];const g=svg.selectAll('g').data(data).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);g.each(function(d){drawCard(d3.select(this),d)});const chars=Math.round(main/7.3),ok=chars>=45&&chars<=75;b.controls.querySelector('#readability').textContent=`${chars} ${lang==='zh'?'字/行':'chars/line'}`;b.controls.querySelector('#ratioBar').style.width=`${ok?92:52}%`;b.controls.querySelector('#ratioBar').style.background=ok?'var(--success)':'var(--gold)';setStatus(b,ok?'主栏可容纳舒适行长，侧栏仍保留足够上下文。':'当前比例让正文行长或侧栏宽度进入风险区。',ok?'The main column supports a comfortable line length while preserving sidebar context.':'This ratio pushes line length or sidebar width into a risk zone.')};const el=b.controls.querySelector('#mainPct');el.oninput=()=>{pct=+el.value;b.controls.querySelector('#mainPctOut').textContent=`${pct}%`;update()};b.controls.querySelector('#mainPctOut').textContent=`${pct}%`;update()}

  function demoRhythm(section){let base=8,density=3;const b=demoBase(section,range('spaceBase',lang==='zh'?'基础单位':'Base unit',4,12,base)+range('densityRows',lang==='zh'?'内容行数':'Content rows',2,6,density)+`<label class="toggle-row"><input id="baseline" type="checkbox" checked> ${lang==='zh'?'显示基线':'Show baseline'}</label>`);const svg=b.svg;const update=()=>{svg.selectAll('*').remove();svg.append('rect').attr('class','svg-frame').attr('x',30).attr('y',20).attr('width',660).attr('height',390).attr('rx',10);if(b.controls.querySelector('#baseline').checked)svg.selectAll('line.base').data(d3.range(52,390,base)).join('line').attr('class','guide-line').attr('x1',45).attr('x2',675).attr('y1',d=>d).attr('y2',d=>d).attr('opacity','.25');const rows=d3.range(density).map(i=>({id:i,x:55,y:62+i*(42+base*2),w:610,h:42}));const g=svg.selectAll('g.row').data(rows,d=>d.id).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);g.append('rect').attr('class','svg-card').attr('rx',6).attr('width',d=>d.w).attr('height',d=>d.h);g.append('circle').attr('cx',18).attr('cy',21).attr('r',7).attr('fill',chapter.accent);g.append('line').attr('x1',38).attr('x2',250).attr('y1',16).attr('y2',16).attr('stroke','#aeb7c8').attr('stroke-width',5).attr('stroke-linecap','round');g.append('line').attr('x1',38).attr('x2',360).attr('y1',28).attr('y2',28).attr('stroke','#d4dae6').attr('stroke-width',4).attr('stroke-linecap','round');setStatus(b,`基础单位 ${base}px 生成 ${base*2}/${base*3}/${base*5}px 的语义间距。`,`A ${base}px base creates semantic gaps of ${base*2}/${base*3}/${base*5}px.`)};[['spaceBase','base'],['densityRows','density']].forEach(([id,key])=>{const el=b.controls.querySelector('#'+id);el.oninput=()=>{if(key==='base')base=+el.value;else density=+el.value;b.controls.querySelector('#'+id+'Out').textContent=el.value;update()}});b.controls.querySelector('#baseline').onchange=update;update()}

  function demoGroupingCore(section,regionStart=false){let inside=12,between=72,region=regionStart;const b=demoBase(section,range('insideGap',lang==='zh'?'组内距离':'Within-group gap',4,34,inside)+range('betweenGap',lang==='zh'?'组间距离':'Between-group gap',24,120,between)+`<label class="toggle-row"><input id="commonRegion" type="checkbox" ${region?'checked':''}> ${lang==='zh'?'显示共同区域':'Show common region'}</label><div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'分组强度':'Grouping strength'}</span><b id="groupRatio">—</b><i><b id="groupBar"></b></i></div></div>`);const svg=b.svg;const update=()=>{svg.selectAll('*').remove();svg.append('rect').attr('class','svg-frame').attr('x',18).attr('y',18).attr('width',684).attr('height',394).attr('rx',10);const cw=120,ch=98,total=cw*4+inside*2+between,start=(720-total)/2,y=155;const data=['active','complete','ranking','device'].map((id,i)=>({id,group:i<2?0:1,x:start+i*cw+(i%2)*inside+(i>=2?inside+between:0),y,w:cw,h:ch,value:["8,392","72%","#1","62%"][i]}));if(region){const groups=d3.groups(data,d=>d.group).map(([key,a])=>({key,x:d3.min(a,d=>d.x)-15,w:d3.max(a,d=>d.x)+cw-d3.min(a,d=>d.x)+30}));svg.selectAll('rect.region').data(groups).join('rect').attr('x',d=>d.x).attr('y',y-35).attr('width',d=>d.w).attr('height',ch+70).attr('rx',13).attr('fill',chapter.accent).attr('fill-opacity','.07').attr('stroke',chapter.accent).attr('stroke-opacity','.35')};const g=svg.selectAll('g.card').data(data,d=>d.id).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);g.each(function(d){drawCard(d3.select(this),d)});const ratio=between/inside,score=Math.min(100,ratio/4*100);b.controls.querySelector('#groupRatio').textContent=`${ratio.toFixed(1)}×`;b.controls.querySelector('#groupBar').style.width=`${score}%`;setStatus(b,ratio>=2.5?'组内与组间距离差异清晰，关系容易被感知。':'两种距离过于接近，四张卡片看起来属于同一组。',ratio>=2.5?'The gap ratio is clear enough for grouping to be perceived.':'The two gaps are too similar; all four cards appear to belong together.')};[['insideGap','inside'],['betweenGap','between']].forEach(([id,key])=>{const el=b.controls.querySelector('#'+id);el.oninput=()=>{key==='inside'?inside=+el.value:between=+el.value;b.controls.querySelector('#'+id+'Out').textContent=el.value;update()}});b.controls.querySelector('#commonRegion').onchange=e=>{region=e.target.checked;update()};update()}
  function demoProximity(s){demoGroupingCore(s,false)}function demoRegion(s){demoGroupingCore(s,true)}

  function demoDensity(section){let count=7,pad=16;const b=demoBase(section,range('densityCount',lang==='zh'?'模块数量':'Module count',4,12,count)+range('densityPad',lang==='zh'?'卡片内边距':'Card padding',6,30,pad)+`<div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'拥挤风险':'Crowding risk'}</span><b id="crowdRisk">—</b><i><b id="crowdBar"></b></i></div></div>`);const svg=b.svg;const update=()=>{svg.selectAll('*').remove();svg.append('rect').attr('class','svg-frame').attr('x',22).attr('y',18).attr('width',676).attr('height',394).attr('rx',10);const cols=count>8?4:count>5?3:2,gap=Math.max(5,30-pad*.75),cw=(620-gap*(cols-1))/cols;const data=d3.range(count).map(i=>({id:i,x:50+(i%cols)*(cw+gap),y:52+Math.floor(i/cols)*(88+gap),w:cw,h:88}));const g=svg.selectAll('g.dcard').data(data,d=>d.id).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);g.append('rect').attr('class','svg-card').attr('rx',6).attr('width',d=>d.w).attr('height',d=>d.h);g.append('text').attr('class','svg-meta').attr('x',pad).attr('y',pad+10).text((d,i)=>`${lang==='zh'?'模块':'MODULE'} ${i+1}`);g.append('line').attr('x1',pad).attr('x2',d=>Math.max(pad+15,d.w-pad)).attr('y1',pad+30).attr('y2',pad+30).attr('stroke','#c7cfdd').attr('stroke-width',5).attr('stroke-linecap','round');const risk=Math.min(100,Math.max(0,(count-5)*10+(16-pad)*2));b.controls.querySelector('#crowdRisk').textContent=`${Math.round(risk)}%`;b.controls.querySelector('#crowdBar').style.width=`${risk}%`;b.controls.querySelector('#crowdBar').style.background=risk>65?'var(--coral)':risk>35?'var(--gold)':'var(--success)';setStatus(b,risk<40?'密度与留白处于可扫描区间。':'单位注意力中的对象过多；考虑合并或渐进披露。',risk<40?'Density and whitespace remain scannable.':'Too many objects compete for attention; consider grouping or progressive disclosure.')};[['densityCount','count'],['densityPad','pad']].forEach(([id,key])=>{const el=b.controls.querySelector('#'+id);el.oninput=()=>{key==='count'?count=+el.value:pad=+el.value;b.controls.querySelector('#'+id+'Out').textContent=el.value;update()}});update()}

  function demoComposition(section){let mode='dashboard';const b=demoBase(section,`<div class="control-group"><label>${lang==='zh'?'主要任务':'Primary task'}</label><select id="compositionMode"><option value="dashboard">${lang==='zh'?'监控与比较':'Monitor and compare'}</option><option value="article">${lang==='zh'?'连续阅读':'Continuous reading'}</option><option value="form">${lang==='zh'?'逐步填写':'Step-by-step input'}</option></select></div>`);const svg=b.svg;const layouts={dashboard:[['chart',45,100,400,235],['active',45,40,125,48],['complete',185,40,125,48],['ranking',465,100,205,235],['recent',45,350,625,42]],article:[['chart',165,70,390,180],['active',165,270,185,58],['complete',370,270,185,58],['recent',165,345,390,42],['ranking',45,70,95,317]],form:[['active',170,58,380,60],['complete',170,135,380,60],['chart',170,212,380,92],['ranking',170,320,180,55],['recent',370,320,180,55]]};const values={chart:'8.4K',active:'8,392',complete:'72%',ranking:'#1',recent:'24'};const update=()=>{svg.selectAll('*').remove();svg.append('rect').attr('class','svg-frame').attr('x',20).attr('y',18).attr('width',680).attr('height',394).attr('rx',10);const data=layouts[mode].map(([id,x,y,w,h])=>({id,x,y,w,h,value:values[id],main:id==='chart'}));const g=svg.selectAll('g.comp').data(data,d=>d.id).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);g.each(function(d){drawCard(d3.select(this),d)});const labels={dashboard:['监控任务需要并列比较与持续可见。','Monitoring needs side-by-side comparison and persistent visibility.'],article:['阅读任务需要稳定行长和连续流。','Reading needs stable line length and a continuous flow.'],form:['填写任务需要明确顺序与单一焦点。','Input tasks need clear sequence and a single focus.']};setStatus(b,...labels[mode])};b.controls.querySelector('#compositionMode').onchange=e=>{mode=e.target.value;update()};update()}

  function layoutForWidth(w,priority=false){const ids=priority?['chart','active','complete','ranking','recent']:['active','complete','ranking','chart','recent'];const pad=24,gap=14;if(w<520){return ids.map((id,i)=>({id,x:pad,y:48+i*68,w:w-pad*2,h:id==='chart'?108:54,value:{chart:'8.4K',active:'8,392',complete:'72%',ranking:'#1',recent:'24'}[id]}))}if(w<850){const cw=(w-pad*2-gap)/2;return ids.map((id,i)=>({id,x:pad+(i%2)*(cw+gap),y:52+Math.floor(i/2)*90,w:cw,h:id==='chart'?150:74,value:{chart:'8.4K',active:'8,392',complete:'72%',ranking:'#1',recent:'24'}[id]}))}const cw=(w-pad*2-gap*3)/4;return [{id:'active',x:pad,y:52,w:cw,h:66,value:'8,392'},{id:'complete',x:pad+cw+gap,y:52,w:cw,h:66,value:'72%'},{id:'ranking',x:pad+2*(cw+gap),y:52,w:cw,h:66,value:'#1'},{id:'recent',x:pad+3*(cw+gap),y:52,w:cw,h:66,value:'24'},{id:'chart',x:pad,y:136,w:cw*3+gap*2,h:190,value:'8.4K',main:true},{id:'device',x:pad+3*(cw+gap),y:136,w:cw,h:190,value:'62%'}]}
  function demoResponsiveCore(section,priority=false){let width=priority?430:980;const b=demoBase(section,range('viewportWidth',lang==='zh'?'视口宽度':'Viewport width',320,1200,width)+`<div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'布局模式':'Layout mode'}</span><b id="modeOut">—</b><i><b style="width:100%"></b></i></div></div>`);const svg=b.svg;const update=()=>{svg.selectAll('*').remove();const mode=width<520?'MOBILE · 1 COL':width<850?'TABLET · 2 COL':'DESKTOP · 4 COL',frameW=640,frameX=40;svg.append('rect').attr('x',frameX).attr('y',20).attr('width',frameW).attr('height',392).attr('rx',12).attr('fill','#e8ebf3').attr('stroke','#cfd6e5');const innerScale=d3.scaleLinear().domain([0,width]).range([frameX+8,frameX+frameW-8]);const scale=(frameW-16)/width;const viewport=svg.append('g').attr('transform',`translate(${frameX+8},30) scale(${scale})`);viewport.append('rect').attr('width',width).attr('height',370/scale).attr('fill','#fff').attr('rx',8/scale);const data=layoutForWidth(width,priority);const g=viewport.selectAll('g.rcard').data(data,d=>d.id).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);g.append('rect').attr('class',d=>d.id==='chart'?'svg-card main':'svg-card').attr('rx',6/scale).attr('width',d=>d.w).attr('height',d=>d.h).attr('stroke-width',1.4/scale);g.append('text').attr('class','svg-label').attr('x',10).attr('y',20).attr('font-size',Math.max(10,12/scale)).text(d=>nameOf(d.id));b.controls.querySelector('#modeOut').textContent=mode;setStatus(b,priority?'窄屏按任务优先级重排，主图先于辅助模块。':'卡片不是整体缩小，而是在阈值处改变列数与顺序。',priority?'Narrow screens reorder by task priority, placing the main chart before support modules.':'Cards do not scale down as a whole; columns and order change at thresholds.')};const el=b.controls.querySelector('#viewportWidth');el.oninput=()=>{width=+el.value;b.controls.querySelector('#viewportWidthOut').textContent=`${width}px`;update()};b.controls.querySelector('#viewportWidthOut').textContent=`${width}px`;update()}
  function demoResponsive(s){demoResponsiveCore(s,false)}function demoPriority(s){demoResponsiveCore(s,true)}

  function demoAccessibility(section){let zoom=150,target=44;const b=demoBase(section,range('textZoom',lang==='zh'?'文字缩放':'Text zoom',100,200,zoom,10)+range('targetSize',lang==='zh'?'触控目标':'Touch target',28,60,target)+`<div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'布局稳健性':'Layout robustness'}</span><b id="a11yScore">—</b><i><b id="a11yBar"></b></i></div></div>`);const svg=b.svg;const update=()=>{svg.selectAll('*').remove();svg.append('rect').attr('class','svg-frame').attr('x',55).attr('y',24).attr('width',610).attr('height',380).attr('rx',10);const fs=14*zoom/100,line=fs*1.5,cardH=Math.max(92,line*2+42);const data=[{id:'active',x:85,y:65,w:250,h:cardH,value:'8,392'},{id:'complete',x:365,y:65,w:250,h:cardH,value:'72%'},{id:'chart',x:85,y:80+cardH,w:530,h:Math.max(150,line*3+60),value:'8.4K'}];const g=svg.selectAll('g.acard').data(data).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);g.append('rect').attr('class','svg-card').attr('rx',7).attr('width',d=>d.w).attr('height',d=>d.h);g.append('text').attr('x',16).attr('y',28).attr('fill','#3b4358').attr('font-size',fs).attr('font-weight',750).text(d=>nameOf(d.id));g.append('text').attr('x',16).attr('y',28+line).attr('fill','#11182b').attr('font-size',fs*1.35).attr('font-weight',850).text(d=>d.value);g.append('circle').attr('cx',d=>d.w-target/2-8).attr('cy',target/2+8).attr('r',target/2).attr('fill',chapter.accent).attr('fill-opacity','.14').attr('stroke',chapter.accent);const score=Math.max(0,100-Math.max(0,44-target)*4);b.controls.querySelector('#a11yScore').textContent=`${score}%`;b.controls.querySelector('#a11yBar').style.width=`${score}%`;b.controls.querySelector('#a11yBar').style.background=score>85?'var(--success)':'var(--coral)';setStatus(b,target>=44?'组件高度随文字增长，触控目标保持至少 44px。':'触控目标低于 44px，手指操作风险上升。',target>=44?'Components grow with text, and targets remain at least 44px.':'Targets are below 44px, increasing touch error risk.')};[['textZoom','zoom'],['targetSize','target']].forEach(([id,key])=>{const el=b.controls.querySelector('#'+id);el.oninput=()=>{key==='zoom'?zoom=+el.value:target=+el.value;b.controls.querySelector('#'+id+'Out').textContent=key==='zoom'?`${el.value}%`:`${el.value}px`;update()}});b.controls.querySelector('#textZoomOut').textContent=`${zoom}%`;b.controls.querySelector('#targetSizeOut').textContent=`${target}px`;update()}

  function demoBreakpoint(section){let width=760,minChart=430;const b=demoBase(section,range('bpWidth',lang==='zh'?'容器宽度':'Container width',420,1100,width)+range('minChart',lang==='zh'?'图表最低宽度':'Minimum chart width',320,560,minChart)+`<div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'当前判断':'Current decision'}</span><b id="bpDecision">—</b><i><b id="bpBar" style="width:100%"></b></i></div></div>`);const svg=b.svg;const update=()=>{svg.selectAll('*').remove();const fails=width*.68<minChart,mode=fails?'STACK':'COLUMNS',frameW=620,scale=frameW/width;svg.append('rect').attr('x',50).attr('y',24).attr('width',620).attr('height',370).attr('rx',10).attr('fill','#fff').attr('stroke','#cfd6e5');const g=svg.append('g').attr('transform',`translate(50,35) scale(${scale})`);const mainW=fails?width-48:(width-66)*.68,sideW=fails?width-48:(width-66)*.32;const data=fails?[{id:'chart',x:24,y:40,w:mainW,h:145},{id:'ranking',x:24,y:202,w:sideW,h:95}]:[{id:'chart',x:24,y:40,w:mainW,h:255},{id:'ranking',x:42+mainW,y:40,w:sideW,h:255}];const cards=g.selectAll('g').data(data).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);cards.append('rect').attr('class','svg-card').attr('width',d=>d.w).attr('height',d=>d.h).attr('rx',7/scale);cards.append('text').attr('class','svg-label').attr('x',14).attr('y',25).attr('font-size',12/scale).text(d=>nameOf(d.id));b.controls.querySelector('#bpDecision').textContent=mode;setStatus(b,fails?`主图预计只有 ${Math.round(width*.68)}px，小于最低 ${minChart}px，因此切换为上下堆叠。`:`主图仍有 ${Math.round(width*.68)}px，可以保留双栏。`,fails?`The chart would have ${Math.round(width*.68)}px, below its ${minChart}px minimum, so the layout stacks.`:`The chart retains ${Math.round(width*.68)}px, so columns remain viable.`)};[['bpWidth','width'],['minChart','minChart']].forEach(([id,key])=>{const el=b.controls.querySelector('#'+id);el.oninput=()=>{key==='width'?width=+el.value:minChart=+el.value;b.controls.querySelector('#'+id+'Out').textContent=`${el.value}px`;update()}});b.controls.querySelector('#bpWidthOut').textContent=`${width}px`;b.controls.querySelector('#minChartOut').textContent=`${minChart}px`;update()}

  const stageLayouts = [
    {chart:[245,55,360,105],active:[48,48,170,112],complete:[70,218,220,72],ranking:[335,200,285,140],recent:[42,350,275,45]},
    {chart:[225,95,430,190],active:[42,42,145,70],complete:[55,235,150,70],ranking:[375,300,245,82],recent:[38,340,285,45]},
    {chart:[30,140,430,190],active:[30,50,150,70],complete:[190,50,150,70],ranking:[480,140,190,190],recent:[30,350,640,45]},
    {chart:[30,150,430,180],active:[30,55,150,65],complete:[195,55,150,65],ranking:[480,150,190,180],recent:[30,352,640,43]},
    {chart:[30,150,430,180],active:[30,55,150,65],complete:[195,55,150,65],ranking:[480,150,190,180],recent:[30,352,640,43]}
  ];
  function demoBeforeAfter(section){
    let stage=0;
    const labels=lang==='zh'?['混乱初稿','只修层级','只修网格','只修分组','多屏验证']:['Chaotic draft','Hierarchy only','Grid only','Grouping only','Multi-screen validation'];
    const changes=lang==='zh'?['基线：四类结构问题同时存在。','主图获得最大面积，先建立明确主次。','卡片吸附共享列线，统一边缘与栏宽。','KPI 与分析区增加可见的组内/组间关系。','桌面几何保持不变，补充 375 / 768 / 1200px 验证。']:['Baseline: four structural problems coexist.','The chart gains the largest area to establish hierarchy.','Cards snap to shared columns, edges, and widths.','KPI and analysis regions gain explicit within/between relationships.','Desktop geometry stays fixed while 375 / 768 / 1200px are validated.'];
    const b=demoBase(section,range('caseStage',lang==='zh'?'重构阶段':'Redesign stage',0,4,stage)+`<div class="metric-list"><div class="metric-row"><span>${lang==='zh'?'当前阶段':'Current stage'}</span><b id="stageName">—</b><i><b id="stageBar"></b></i></div></div>`);
    const svg=b.svg;
    svg.append('rect').attr('class','svg-frame').attr('x',18).attr('y',18).attr('width',684).attr('height',394).attr('rx',10);
    const regionLayer=svg.append('g'),cardLayer=svg.append('g'),noteLayer=svg.append('g');
    const data=baseModules().filter(d=>stageLayouts[0][d.id]);
    const initial=data.map(d=>{const [x,y,w,h]=stageLayouts[0][d.id];return{...d,x,y,w,h,main:false}});
    cardLayer.selectAll('g.stage-card').data(initial,d=>d.id).join('g').attr('class','stage-card').attr('transform',d=>`translate(${d.x},${d.y})`).each(function(d){drawCard(d3.select(this),d)});
    const update=()=>{
      const layout=data.map(d=>{const [x,y,w,h]=stageLayouts[stage][d.id];return{...d,x,y,w,h,main:d.id==='chart'&&stage>0}});
      const cards=cardLayer.selectAll('g.stage-card').data(layout,d=>d.id);
      cards.transition().duration(420).attr('transform',d=>`translate(${d.x},${d.y})`);
      cards.select('rect').transition().duration(420).attr('width',d=>d.w).attr('height',d=>d.h).attr('class',d=>d.main?'svg-card main':'svg-card');
      const regions=stage>=3?[{id:'kpi',x:22,y:42,w:334,h:91},{id:'analysis',x:22,y:137,w:660,h:205}]:[];
      regionLayer.selectAll('rect').data(regions,d=>d.id).join('rect').attr('rx',11).attr('fill',chapter.accent).attr('fill-opacity','.055').attr('stroke',chapter.accent).attr('stroke-dasharray','5 4').transition().attr('x',d=>d.x).attr('y',d=>d.y).attr('width',d=>d.w).attr('height',d=>d.h);
      const widths=stage===4?['375','768','1200']:[];
      noteLayer.selectAll('text.width-badge').data(widths).join('text').attr('class','stage-note width-badge').attr('x',(d,i)=>520+i*52).attr('y',38).text(d=>`${d}px`);
      b.controls.querySelector('#stageName').textContent=labels[stage];
      b.controls.querySelector('#stageBar').style.width=`${stage/4*100}%`;
      setStatus(b,changes[stage],changes[stage]);
    };
    const el=b.controls.querySelector('#caseStage');
    el.oninput=()=>{stage=+el.value;b.controls.querySelector('#caseStageOut').textContent=`${stage}/4`;update()};
    b.controls.querySelector('#caseStageOut').textContent='0/4';update();
  }

  function labMetrics(cards){
    const nearest=(v,step,offset)=>Math.round((v-offset)/step)*step+offset;
    const errors=cards.flatMap(d=>[Math.abs(d.x-nearest(d.x,80,30)),Math.abs(d.y-nearest(d.y,50,50))]);
    const alignment=Math.max(0,100-d3.mean(errors)*3);
    const byId=Object.fromEntries(cards.map(d=>[d.id,d]));
    const gapChecks=[
      {id:'kpi-gap',from:'active',to:'complete',axis:'x',target:24,value:byId.complete.x-(byId.active.x+byId.active.w)},
      {id:'main-gap',from:'chart',to:'ranking',axis:'x',target:24,value:byId.ranking.x-(byId.chart.x+byId.chart.w)},
      {id:'top-main',from:'active',to:'chart',axis:'y',target:20,value:byId.chart.y-(byId.active.y+byId.active.h)},
      {id:'main-recent',from:'chart',to:'recent',axis:'y',target:20,value:byId.recent.y-(byId.chart.y+byId.chart.h)}
    ];
    const spacing=Math.max(0,100-d3.mean(gapChecks,d=>Math.abs(d.value-d.target))*3);
    const main=byId.chart,maxOther=d3.max(cards.filter(d=>d.id!=='chart'),d=>d.w*d.h);
    const hierarchy=Math.min(100,(main.w*main.h/maxOther)*42);
    const overflow=cards.filter(d=>d.x>=24&&d.y>=34&&d.x+d.w<=696&&d.y+d.h<=410).length/cards.length*100;
    return{alignment,spacing,hierarchy,overflow,gapChecks};
  }
  function demoLabCore(section,xrayStart=false){
    let xray=xrayStart;
    const cards=[{id:'chart',x:42,y:145,w:390,h:180,value:'8.4K'},{id:'active',x:43,y:53,w:150,h:70,value:'8,392'},{id:'complete',x:221,y:62,w:145,h:70,value:'72%'},{id:'ranking',x:470,y:142,w:185,h:180,value:'#1'},{id:'recent',x:48,y:344,w:410,h:48,value:'24'}];
    const b=demoBase(section,`<label class="toggle-row"><input id="labXray" type="checkbox" ${xray?'checked':''}> ${lang==='zh'?'打开 Layout X-Ray':'Turn on Layout X-Ray'}</label><div class="demo-actions">${action('messLab',lang==='zh'?'制造问题':'Make it messy')}${action('resetLab',tx(C.ui.reset),true)}</div><div class="metric-list" id="labMetrics"></div><p style="margin-top:16px;font-size:.72rem;color:var(--muted)">${tx(C.ui.heuristic)}</p>`);
    const svg=b.svg,initial=cards.map(d=>({...d}));
    svg.append('rect').attr('class','svg-frame').attr('x',16).attr('y',16).attr('width',688).attr('height',398).attr('rx',10);
    const guideLayer=svg.append('g'),cardLayer=svg.append('g'),diagnosticLayer=svg.append('g');
    let update;
    const clampCard=d=>{d.x=Math.max(20,Math.min(700-d.w,d.x));d.y=Math.max(20,Math.min(414-d.h,d.y))};
    const drag=d3.drag().on('drag',(e,d)=>{d.x=e.x-d.w/2;d.y=e.y-d.h/2;clampCard(d);update()}).on('end',(e,d)=>{d.x=Math.max(30,Math.min(670-d.w,Math.round((d.x-30)/80)*80+30));d.y=Math.max(50,Math.min(410-d.h,Math.round((d.y-50)/50)*50+50));update()});
    update=()=>{
      guideLayer.selectAll('*').remove();diagnosticLayer.selectAll('*').remove();
      if(xray){guideLayer.selectAll('line.v').data(d3.range(30,700,80)).join('line').attr('class','guide-line').attr('x1',d=>d).attr('x2',d=>d).attr('y1',30).attr('y2',410);guideLayer.selectAll('line.h').data(d3.range(50,410,50)).join('line').attr('class','guide-line').attr('x1',24).attr('x2',696).attr('y1',d=>d).attr('y2',d=>d)}
      const g=cardLayer.selectAll('g.drag-card').data(cards,d=>d.id).join(enter=>{const node=enter.append('g').attr('class','drag-card');node.each(function(d){drawCard(d3.select(this),d)});return node;}).attr('transform',d=>`translate(${d.x},${d.y})`).attr('tabindex',0).attr('role','group').attr('aria-label',d=>`${nameOf(d.id)} · ${lang==='zh'?'方向键移动':'use arrow keys to move'}`).on('keydown',(e,d)=>{const step=e.shiftKey?16:8;if(e.key==='ArrowLeft')d.x-=step;else if(e.key==='ArrowRight')d.x+=step;else if(e.key==='ArrowUp')d.y-=step;else if(e.key==='ArrowDown')d.y+=step;else return;e.preventDefault();clampCard(d);update()}).call(drag);
      g.select('rect').attr('width',d=>d.w).attr('height',d=>d.h);
      g.selectAll('text.coords').data(xray?d=>[d]:()=>[]).join('text').attr('class','svg-meta coords').attr('x',d=>d.w-8).attr('y',d=>d.h-8).attr('text-anchor','end').text(d=>`${Math.round(d.x)},${Math.round(d.y)} · ${d.w}×${d.h}`);
      const m=labMetrics(cards),metricValues={alignment:m.alignment,spacing:m.spacing,hierarchy:m.hierarchy,overflow:m.overflow};
      if(xray){
        const nearest=(v,step,offset)=>Math.round((v-offset)/step)*step+offset;
        const vectors=cards.flatMap(d=>[{id:`${d.id}-x`,card:d.id,x1:d.x,y1:d.y+10,x2:nearest(d.x,80,30),y2:d.y+10,error:d.x-nearest(d.x,80,30),axis:'x'},{id:`${d.id}-y`,card:d.id,x1:d.x+10,y1:d.y,x2:d.x+10,y2:nearest(d.y,50,50),error:d.y-nearest(d.y,50,50),axis:'y'}]).filter(d=>Math.abs(d.error)>2);
        diagnosticLayer.selectAll('line.error-vector').data(vectors,d=>d.id).join('line').attr('class','error-line error-vector').attr('x1',d=>d.x1).attr('y1',d=>d.y1).attr('x2',d=>d.x2).attr('y2',d=>d.y2);
        diagnosticLayer.selectAll('text.error-vector').data(vectors,d=>d.id).join('text').attr('class','error-label error-vector').attr('x',d=>(d.x1+d.x2)/2+4).attr('y',d=>(d.y1+d.y2)/2-4).text(d=>`Δ${d.axis} ${Math.round(d.error)}px`);
        const gapData=m.gapChecks.slice(0,2).map(d=>{const a=cards.find(c=>c.id===d.from),z=cards.find(c=>c.id===d.to);return{...d,x1:a.x+a.w,y1:(a.y+z.y)/2+22,x2:z.x,y2:(a.y+z.y)/2+22}});
        diagnosticLayer.selectAll('line.gap-vector').data(gapData,d=>d.id).join('line').attr('class','gap-line gap-vector').attr('x1',d=>d.x1).attr('y1',d=>d.y1).attr('x2',d=>d.x2).attr('y2',d=>d.y2);
        diagnosticLayer.selectAll('text.gap-vector').data(gapData,d=>d.id).join('text').attr('class','error-label gap-vector').attr('x',d=>(d.x1+d.x2)/2).attr('y',d=>d.y1-5).attr('text-anchor','middle').text(d=>`${Math.round(d.value)} / ${d.target}px`);
      }
      const score=Math.round(metricValues.alignment*.35+metricValues.spacing*.25+metricValues.hierarchy*.25+metricValues.overflow*.15);
      b.controls.querySelector('#labMetrics').innerHTML=Object.entries(metricValues).map(([k,v])=>`<div class="metric-row"><span>${({alignment:lang==='zh'?'对齐':'Alignment',spacing:lang==='zh'?'节奏':'Rhythm',hierarchy:lang==='zh'?'层级':'Hierarchy',overflow:lang==='zh'?'边界':'Bounds'})[k]}</span><b>${Math.round(v)}%</b><i><b style="width:${v}%"></b></i></div>`).join('');
      const worst=xray?cards.flatMap(d=>[{name:nameOf(d.id),axis:'x',error:d.x-(Math.round((d.x-30)/80)*80+30)},{name:nameOf(d.id),axis:'y',error:d.y-(Math.round((d.y-50)/50)*50+50)}]).sort((a,z)=>Math.abs(z.error)-Math.abs(a.error))[0]:null;
      setStatus(b,xray&&worst&&Math.abs(worst.error)>2?`X-Ray：${worst.name} 的 ${worst.axis} 偏移 ${Math.round(worst.error)}px；沿红线反向移动。`:`教学启发式 ${score}/100。${metricValues.alignment<70?'下一步：先把边缘吸附到网格。':'下一步：检查主图是否足够突出。'}`,xray&&worst&&Math.abs(worst.error)>2?`X-Ray: ${worst.name} has a ${Math.round(worst.error)}px ${worst.axis} offset; move against the red vector.`:`Teaching heuristic ${score}/100. ${metricValues.alignment<70?'Next: snap edges to the grid.':'Next: check whether the main chart is prominent enough.'}`);
    };
    b.controls.querySelector('#labXray').onchange=e=>{xray=e.target.checked;update()};
    b.controls.querySelector('#messLab').onclick=()=>{cards.forEach((d,i)=>{d.x+=i%2?19:-13;d.y+=(i%3-1)*13;clampCard(d)});update()};
    b.controls.querySelector('#resetLab').onclick=()=>{cards.forEach((d,i)=>Object.assign(d,initial[i]));update()};update();
  }
  function demoLab(s){demoLabCore(s,false)}function demoXray(s){demoLabCore(s,true)}

  function demoMultiscreen(section){let zoom=100;const b=demoBase(section,range('multiZoom',lang==='zh'?'文字缩放':'Text zoom',100,200,zoom,10)+`<p style="font-size:.78rem;color:var(--muted)">${lang==='zh'?'一套内容模型，同时生成桌面、平板和手机视图。':'One content model generates desktop, tablet, and mobile views.'}</p>`);const svg=b.svg;const screens=[{name:'DESKTOP',w:1180,x:24,drawW:315},{name:'TABLET',w:768,x:354,drawW:190},{name:'MOBILE',w:375,x:563,drawW:135}];const update=()=>{svg.selectAll('*').remove();screens.forEach(s=>{const scale=s.drawW/s.w,frameH=350;svg.append('rect').attr('x',s.x).attr('y',52).attr('width',s.drawW).attr('height',frameH).attr('rx',8).attr('fill','#fff').attr('stroke','#cfd6e5');svg.append('text').attr('class','svg-meta').attr('x',s.x).attr('y',35).text(`${s.name} · ${s.w}px`);const g=svg.append('g').attr('transform',`translate(${s.x},62) scale(${scale})`);const cards=layoutForWidth(s.w,true).map(d=>({...d,y:d.y*(zoom/100),h:d.h*(zoom/100)}));const cg=g.selectAll('g').data(cards,d=>d.id).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);cg.append('rect').attr('class','svg-card').attr('width',d=>d.w).attr('height',d=>d.h).attr('rx',6/scale);cg.append('text').attr('class','svg-label').attr('x',10).attr('y',20).attr('font-size',Math.max(10,11/scale)).text(d=>nameOf(d.id))});setStatus(b,zoom>160?'200% 附近开始暴露固定高度与信息折叠风险。':'三种视图共享模块身份，只改变顺序、列数与尺寸。',zoom>160?'Near 200%, fixed heights and disclosure risks become visible.':'All three views share module identity; only order, columns, and size change.')};const el=b.controls.querySelector('#multiZoom');el.oninput=()=>{zoom=+el.value;b.controls.querySelector('#multiZoomOut').textContent=`${zoom}%`;update()};b.controls.querySelector('#multiZoomOut').textContent=`${zoom}%`;update()}

  window.addEventListener('popstate', () => {
    const route = new URLSearchParams(location.search);
    const nextSection = Number(route.get('section'));
    activeSection = Number.isInteger(nextSection) ? Math.max(0, Math.min(chapter.sections.length - 1, nextSection)) : 0;
    activeTab = ['explain', 'code', 'demo'].includes(route.get('tab')) ? route.get('tab') : 'explain';
    lang = ['zh', 'en'].includes(route.get('lang')) ? route.get('lang') : lang;
    renderApp();
  });
  renderApp();
})();
