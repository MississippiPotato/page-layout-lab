(function () {
  const C = window.COURSE;
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') || localStorage.getItem('layout-course-lang') || 'zh';
  if (!['zh', 'en'].includes(lang)) lang = 'zh';
  const tx = value => typeof value === 'string' ? value : value[lang];
  const linkFor = href => `${href}${href.includes('?') ? '&' : '?'}lang=${lang}`;

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
    <section id="route" class="route-section"><div class="section-head"><div><p class="eyebrow" style="color:var(--primary)">ONE CASE · FIVE DECISIONS</p><h2>${tx(C.ui.route)}</h2></div><p>${lang === 'zh' ? '同一组模块、同一套数据、同一个任务。每章只解决一类问题，让改变的原因清晰可见。' : 'The same modules, data, and task. Each chapter solves one class of problem so the cause of every change stays visible.'}</p></div><div class="route-track">${route}</div></section>
    <section id="how" class="info-grid"><article class="info-panel"><h2>${tx(C.ui.how)}</h2><ol class="how-list">${C.how.map(d => `<li>${tx(d)}</li>`).join('')}</ol></article><article class="info-panel dark"><h2>${tx(C.ui.sources)}</h2><ul class="source-list">${C.sources.map(d => `<li>${d}</li>`).join('')}</ul></article></section>`;
    document.getElementById('siteFooter').textContent = tx(C.ui.footer);
    bindLanguage();
    renderHeroBlueprint();
  }

  function bindLanguage() {
    document.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => {
      lang = btn.dataset.lang;
      localStorage.setItem('layout-course-lang', lang);
      const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState({}, '', url);
      render();
    }));
  }

  function renderHeroBlueprint() {
    if (!window.d3) return;
    const svg = d3.select('#heroBlueprint');
    svg.selectAll('*').remove();
    const accent = ['#36d8c2', '#786ff2', '#ff6b4a', '#f0a202', '#67a4ff'];
    const modules = [
      { id: 'chart', label: lang === 'zh' ? '每周活跃趋势' : 'WEEKLY ACTIVITY', good: [45, 108, 310, 175], bad: [235, 66, 250, 95] },
      { id: 'active', label: lang === 'zh' ? '今日活跃' : 'ACTIVE TODAY', good: [45, 38, 145, 52], bad: [48, 52, 160, 112] },
      { id: 'complete', label: lang === 'zh' ? '完成率' : 'COMPLETION', good: [205, 38, 145, 52], bad: [42, 191, 210, 72] },
      { id: 'ranking', label: lang === 'zh' ? '课程排行' : 'COURSE RANKING', good: [372, 108, 143, 175], bad: [278, 180, 210, 102] },
      { id: 'recent', label: lang === 'zh' ? '最近活动' : 'RECENT ACTIVITY', good: [45, 300, 470, 50], bad: [69, 286, 260, 48] }
    ];
    svg.append('rect').attr('x', 18).attr('y', 16).attr('width', 524).attr('height', 356).attr('rx', 15).attr('fill', '#182139').attr('stroke', '#34415f');
    svg.append('text').attr('x', 45).attr('y', 49).attr('fill', '#eff3ff').attr('font-size', 14).attr('font-weight', 800).text('CAMPUS PULSE');
    svg.append('text').attr('x', 515).attr('y', 49).attr('text-anchor', 'end').attr('fill', '#7f8bae').attr('font-size', 9).text('LAYOUT / 05');
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'heroLine').attr('x1', '0%').attr('x2', '100%');
    grad.append('stop').attr('stop-color', '#36d8c2'); grad.append('stop').attr('offset', '100%').attr('stop-color', '#786ff2');
    const g = svg.selectAll('g.module').data(modules, d => d.id).join('g').attr('class', 'module').attr('transform', d => `translate(${d.good[0]},${d.good[1]})`);
    g.append('rect').attr('width', d => d.good[2]).attr('height', d => d.good[3]).attr('rx', 7).attr('fill', '#222d49').attr('stroke', (d, i) => accent[i]).attr('stroke-opacity', .72);
    g.append('text').attr('x', 12).attr('y', 22).attr('fill', '#9ba7c6').attr('font-size', 8).attr('font-weight', 700).text(d => d.label);
    g.filter(d => d.id === 'chart').append('path').attr('d', d3.line()([[18,132],[58,108],[98,120],[138,66],[178,88],[218,51],[278,70]])).attr('fill','none').attr('stroke','url(#heroLine)').attr('stroke-width',3);
    g.filter(d => d.id === 'active' || d.id === 'complete').append('text').attr('x',12).attr('y',45).attr('fill','#fff').attr('font-size',20).attr('font-weight',850).text(d => d.id === 'active' ? '8,392' : '72%');
    g.filter(d => d.id === 'ranking').selectAll('line').data([0,1,2,3]).join('line').attr('x1',14).attr('x2',(d,i)=>48+i*21).attr('y1',(d,i)=>55+i*29).attr('y2',(d,i)=>55+i*29).attr('stroke',(d,i)=>accent[(i+1)%accent.length]).attr('stroke-width',8).attr('stroke-linecap','round');
    g.filter(d => d.id === 'recent').selectAll('circle').data([0,1,2,3]).join('circle').attr('cx',(d,i)=>18+i*75).attr('cy',35).attr('r',4).attr('fill',(d,i)=>accent[i]);
    let good = true;
    const cycle = () => {
      good = !good;
      g.transition().duration(900).ease(d3.easeCubicInOut).attr('transform', d => { const p = good ? d.good : d.bad; return `translate(${p[0]},${p[1]})`; });
      g.select('rect').transition().duration(900).attr('width', d => (good ? d.good : d.bad)[2]).attr('height', d => (good ? d.good : d.bad)[3]).attr('stroke-opacity', good ? .72 : .35);
    };
    window.clearInterval(window.__layoutHeroTimer);
    window.__layoutHeroTimer = window.setInterval(cycle, 2700);
  }
  render();
})();
