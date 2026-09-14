(function () {
  const B = (zh, en) => ({ zh, en });
  const S = (id, titleZh, titleEn, subtitleZh, subtitleEn, demo, theory, key, pit) => ({
    id,
    title: B(titleZh, titleEn),
    subtitle: B(subtitleZh, subtitleEn),
    demo,
    theory: theory.map(([zh, en]) => B(zh, en)),
    key: B(key[0], key[1]),
    pit: B(pit[0], pit[1])
  });

  window.COURSE = {
    meta: {
      title: B('页面布局实战课', 'Page Layout Studio'),
      subtitle: B('从混乱到清晰：用一个真实看板学会组织页面', 'From chaos to clarity: learn page organization through one dashboard'),
      question: B('页面能用，为什么仍然难读？', 'The page works. Why is it still hard to read?'),
      intro: B('这不是 CSS 语法清单，而是一套从用户任务出发的布局决策课。五章沿用同一个 Campus Pulse 看板：先诊断，再建立层级与网格，处理空间关系和响应式，最后完成可解释的布局审计。', 'This is not a list of CSS recipes. It is a decision-making course that starts with user tasks. Five chapters follow the same Campus Pulse dashboard: diagnose it, build hierarchy and a grid, shape spatial relationships and responsive behavior, then complete an explainable layout audit.'),
      stats: [B('5 个独立章节', '5 independent chapters'), B('20 个教学小节', '20 lesson sections'), B('20 个 D3 互动实验', '20 interactive D3 labs')]
    },
    ui: {
      portal: B('课程门户', 'Course Portal'),
      chapters: B('课程章节', 'Course Chapters'),
      route: B('案例路线', 'Case Route'),
      how: B('学习方式', 'How to Learn'),
      sources: B('理论来源', 'Theory Sources'),
      enter: B('进入章节', 'Enter chapter'),
      live: B('已上线', 'LIVE'),
      sections: B('小节', 'sections'),
      explain: B('📖 讲解', '📖 Explanation'),
      code: B('⌨️ 关键代码', '⌨️ Key Code'),
      demo: B('▶️ 演示', '▶️ Demo'),
      toc: B('本章目录', 'Chapter Contents'),
      objective: B('学习目标', 'Learning Outcome'),
      caseProblem: B('案例问题', 'Case Problem'),
      caseContext: B('Campus Pulse 现场', 'Campus Pulse Context'),
      theory: B('理论与判断规则', 'Theory and Decision Rules'),
      keyPoint: B('⭐ 关键点', '⭐ Key Point'),
      pitfall: B('常见误区', 'Common Pitfall'),
      keyCode1: B('关键点 1 · 把概念变成可计算参数', 'Key 1 · Turn the concept into a computable parameter'),
      keyCode2: B('关键点 2 · 用 D3 保持对象连续性', 'Key 2 · Preserve object constancy with D3'),
      codeSimplified: B('演示核心逻辑 · 为教学简化', 'Demo Core Logic · Simplified for Learning'),
      observe: B('对应演示', 'Demo mapping'),
      why: B('为什么这样写', 'Why this works'),
      try: B('动手试一试', 'Try it'),
      reset: B('重置', 'Reset'),
      next: B('下一小节', 'Next section'),
      previous: B('上一章', 'Previous chapter'),
      nextChapter: B('下一章', 'Next chapter'),
      heuristic: B('提示：所有分数都是教学启发式，不是客观审美标准。', 'Note: every score is a teaching heuristic, not an objective measure of beauty.'),
      chapterLabel: B('章', 'CHAPTER'),
      menu: B('选择小节', 'Choose a section'),
      progress: B('课程进度', 'Course progress'),
      footer: B('页面布局实战课 · D3.js v7 · 中英双语 · 案例驱动', 'Page Layout Studio · D3.js v7 · Bilingual · Case-driven')
    },
    chapters: [
      {
        slug: 'lesson-01', accent: '#ff6b4a',
        title: B('先诊断，再布局', 'Diagnose Before Layout'),
        desc: B('从用户任务和内容优先级出发，识别“看起来不对”的真正原因。', 'Start with user tasks and content priority to identify why a page feels wrong.'),
        outcome: B('能区分层级、对齐、分组与溢出问题，并建立修复顺序。', 'Distinguish hierarchy, alignment, grouping, and overflow issues, then set a repair order.'),
        case: B('教务运营人员每天先判断活跃趋势是否异常，再定位完成率和课程排行。旧稿里主图与 KPI 面积接近、边缘错位、最近活动孤立，首屏没有稳定的阅读顺序。', 'Academic operations staff first check whether activity trends are abnormal, then inspect completion and course rankings. In the draft, the chart and KPIs compete in size, edges drift, and recent activity is isolated, so the first screen has no stable reading order.'),
        tags: [B('布局审计', 'Layout audit'), B('任务优先级', 'Task priority'), B('阅读顺序', 'Reading order')],
        sections: [
          S('1-1','布局问题不是装饰问题','Layout Problems Are Not Decoration','先问用户要完成什么，再问页面该长什么样。','Ask what users must accomplish before asking what the page should look like.','audit',[
            ['布局质量来自“任务—内容—空间”的匹配，而不是来自更多阴影或颜色。','Layout quality comes from matching task, content, and space—not from adding shadows or colors.'],
            ['审计时先记录症状：主次不清、边缘不齐、关系含糊、信息溢出。','Begin an audit by recording symptoms: weak hierarchy, broken edges, ambiguous grouping, and overflow.'],
            ['同一个视觉症状可能有不同原因；例如拥挤既可能是间距太小，也可能是内容没有分层。','The same visual symptom can have different causes; crowding may come from tight spacing or missing content hierarchy.'],
            ['修复顺序应先结构、后样式：先改变顺序和面积，再处理颜色与细节。','Repair structure before styling: change order and area before color and detail.']
          ],['好布局首先减少决策摩擦，而不只是让页面“整齐”。','Good layout reduces decision friction; neatness alone is not enough.'],['把个人审美当成问题证据。应把问题连接到任务、误读或操作成本。','Treating personal taste as evidence. Connect issues to tasks, misreading, or interaction cost.']),
          S('1-2','内容盘点与任务地图','Content Inventory and Task Map','没有内容模型，网格只是空架子。','Without a content model, a grid is only an empty frame.','matrix',[
            ['先列出所有模块，再为每个模块标注任务频率与决策影响。','List every module, then rate its task frequency and decision impact.'],
            ['高频且高影响的信息属于核心层，应更早出现并获得更多空间。','High-frequency, high-impact information belongs to the core layer and should appear earlier with more space.'],
            ['低频但高影响的信息适合渐进披露，而不是永久占据首屏。','Low-frequency but high-impact information suits progressive disclosure rather than permanent first-screen space.'],
            ['优先级矩阵是一种讨论工具，不是自动替代产品判断的公式。','A priority matrix is a discussion tool, not a formula that replaces product judgment.']
          ],['业务重要性必须先被显式记录，才能稳定地映射到空间。','Business importance must be explicit before it can be mapped consistently to space.'],['把“数据多”误认为“重要”。数据量与用户决策价值不是一回事。','Mistaking data volume for importance. Volume is not decision value.']),
          S('1-3','建立视觉层级','Build Visual Hierarchy','用尺寸、位置、对比和留白引导第一眼。','Guide the first glance with size, position, contrast, and whitespace.','hierarchy',[
            ['视觉重量由面积、位置、对比、密度共同形成，任何单一变量都不保证重要。','Visual weight emerges from area, position, contrast, and density; no single variable guarantees importance.'],
            ['业务重要性应映射到视觉重量：核心任务先看到，支持信息随后，背景信息最后。','Map business importance to visual weight: core tasks first, support next, context last.'],
            ['层级不是让所有内容都“更大”，而是建立可感知的差异。','Hierarchy is not making everything larger; it is creating perceivable difference.'],
            ['启发式阅读路径只能解释设计意图，不能冒充真实眼动数据。','A heuristic reading path explains design intent; it must not be presented as eye-tracking data.']
          ],['把信息重要性当作数据，再把它映射到面积和位置。','Treat information importance as data, then map it to area and position.'],['同时强调多个模块会抵消层级；如果每个元素都在喊，读者只会听见噪声。','Emphasizing many modules cancels hierarchy; when everything shouts, users hear noise.']),
          S('1-4','验证阅读顺序','Validate Reading Order','设计意图必须能被路径和任务测试验证。','Design intent must be testable through paths and tasks.','path',[
            ['先写出期望顺序，再比较界面实际产生的显著性顺序。','Write the intended order first, then compare it with the salience order produced by the interface.'],
            ['Z 型或 F 型只能描述常见扫描倾向，不能替代具体内容结构。','Z and F patterns describe common scanning tendencies; they do not replace content-specific structure.'],
            ['标题、主数值、趋势和操作入口应形成连续的认知链。','Title, primary value, trend, and action should form a continuous cognitive chain.'],
            ['当路径频繁折返时，应检查是否有冲突的强调或错位的关联。','When the path doubles back repeatedly, inspect competing emphasis and misplaced relationships.']
          ],['阅读路径是对层级假设的可视化检查，而不是装饰箭头。','A reading path is a visual check of a hierarchy hypothesis, not a decorative arrow.'],['套用固定扫描模式而忽略页面任务。工具页面、文章和看板的阅读策略并不相同。','Applying one scan pattern regardless of task. Tools, articles, and dashboards are read differently.'])
        ]
      },
      {
        slug: 'lesson-02', accent: '#6c63ff',
        title: B('网格、对齐与比例', 'Grid, Alignment, and Proportion'),
        desc: B('建立共享空间坐标系，让模块之间的关系稳定、可预测。', 'Build a shared spatial coordinate system so relationships remain stable and predictable.'),
        outcome: B('能设计列、边距、沟槽与内容比例，并解释每个选择。', 'Design columns, margins, gutters, and content proportions—and explain each choice.'),
        case: B('第一章已经确认“每周活跃趋势”是核心任务。现在需要把这项优先级落到可复用的 12 列坐标、共享边缘和稳定栏宽中，避免每张卡片各自寻找位置。', 'Chapter 1 established Weekly Activity as the core task. Now that priority must become a reusable 12-column coordinate system, shared edges, and stable column widths so cards no longer position themselves independently.'),
        tags: [B('网格系统', 'Grid system'), B('共享边缘', 'Shared edges'), B('视觉节奏', 'Visual rhythm')],
        sections: [
          S('2-1','网格是一套空间坐标','A Grid Is a Spatial Coordinate System','列不是装饰线，而是组件共享的定位语言。','Columns are not decorative lines; they are a shared positioning language.','grid',[
            ['Container 定义有效空间，Margin 保护边界，Column 分配空间，Gutter 分隔相邻内容。','The container defines usable space, margins protect edges, columns allocate space, and gutters separate neighbors.'],
            ['列数取决于内容组合的需要，不是因为“12 列看起来专业”。','Column count should follow content combinations, not the idea that twelve columns look professional.'],
            ['用离散列映射连续屏幕空间，能让组件宽度具有可重复的规则。','Mapping discrete columns to continuous screen space gives component widths repeatable rules.'],
            ['当容器变化时，网格应重新计算，而不是缩放所有像素。','When the container changes, recompute the grid rather than scaling every pixel.']
          ],['d3.scaleBand() 不只服务柱状图，它也是离散布局坐标器。','d3.scaleBand() is not only for bars; it is a discrete layout coordinate system.'],['先画 12 列再硬塞内容。应从最常见的组件跨列组合反推列数。','Drawing twelve columns first and forcing content in. Derive the column count from common component spans.']),
          S('2-2','对齐创造关系','Alignment Creates Relationship','共享边缘能降低页面的视觉熵。','Shared edges reduce visual entropy.','alignment',[
            ['共用左边缘会让标题、数值和图表被感知为同一条信息链。','A shared left edge makes titles, values, and charts feel like one information chain.'],
            ['对齐应围绕少数强参考线组织，而不是让每个模块独立居中。','Alignment should use a few strong reference lines, not independent centering for every module.'],
            ['轻微随机偏移看似很小，但会累积为明显的不专业感。','Small random offsets may seem harmless, but they accumulate into visible disorder.'],
            ['吸附不是目的；真正目标是建立可预测的相邻关系。','Snapping is not the goal; predictable relationships are.']
          ],['用“到最近网格线的误差”解释对齐，而不是凭感觉打分。','Explain alignment using distance to the nearest grid line instead of a vague feeling.'],['只对齐外框，却忽略卡片内部标题、数值和图形的基线。','Aligning outer boxes while ignoring internal title, value, and chart baselines.']),
          S('2-3','比例决定主次与可读性','Proportion Shapes Hierarchy and Readability','主栏与侧栏的比例应由任务密度决定。','The main-to-side ratio should follow task density.','ratio',[
            ['主内容需要完成分析任务，通常应获得稳定的连续宽度。','Primary content supports analysis and usually needs stable continuous width.'],
            ['侧栏适合索引、筛选和辅助上下文，不应抢占主要阅读面。','Sidebars suit indexes, filters, and context; they should not dominate the main reading surface.'],
            ['黄金比例可以提供参考，但不是页面布局的普遍答案。','The golden ratio can inspire, but it is not a universal page-layout answer.'],
            ['文本行长、图表纵横比与控件密度要共同决定栏宽。','Line length, chart aspect ratio, and control density should jointly determine column width.']
          ],['比例应由内容约束驱动，并在不同宽度下重新验证。','Proportion should be content-driven and revalidated across widths.'],['为了追求数学上的漂亮比例，牺牲真实内容的可读性。','Sacrificing real content readability for a mathematically attractive ratio.']),
          S('2-4','间距系统与垂直节奏','Spacing System and Vertical Rhythm','重复的间距尺度让页面形成节拍。','A repeated spacing scale gives the page a rhythm.','rhythm',[
            ['间距系统把无数随意数值压缩为少量可解释的层级。','A spacing system reduces arbitrary values to a small, explainable hierarchy.'],
            ['组内距离应小于组间距离；标题到正文和章节到章节不应使用同一间距。','Within-group distance should be smaller than between-group distance; heading-to-body and section-to-section gaps should differ.'],
            ['垂直节奏来自重复基线和段落间隔，不等于机械地使用相同高度。','Vertical rhythm comes from repeated baselines and paragraph gaps; it does not mean identical heights.'],
            ['8 点系统是一种便捷约束，不是必须服从的自然定律。','An eight-point system is a convenient constraint, not a law of nature.']
          ],['用离散间距 token 表达关系强弱，并允许少量语义例外。','Use discrete spacing tokens to encode relationship strength, with limited semantic exceptions.'],['所有 margin 都设成 16px。统一数值会抹掉关系层级。','Setting every margin to 16px. Uniform values erase relational hierarchy.'])
        ]
      },
      {
        slug: 'lesson-03', accent: '#00a88f',
        title: B('空间分组与页面组成', 'Spatial Grouping and Composition'),
        desc: B('用接近、共同区域、留白与布局模式表达内容关系。', 'Use proximity, common region, whitespace, and composition patterns to express relationships.'),
        outcome: B('能让读者无需边框也理解哪些信息属于一组。', 'Help readers understand grouping without relying on borders everywhere.'),
        case: B('网格已经让边缘整齐，但六个模块仍像彼此无关的盒子。需要让活跃与完成率形成 KPI 组，让排行成为辅助上下文，并用组内、组间距离解释这种关系。', 'The grid has aligned the edges, yet the six modules still feel like unrelated boxes. Activity and completion must form a KPI group, ranking must read as supporting context, and within- versus between-group gaps must explain those relationships.'),
        tags: [B('格式塔', 'Gestalt'), B('留白', 'Whitespace'), B('页面模式', 'Page patterns')],
        sections: [
          S('3-1','接近原则：距离就是关系','Proximity: Distance Is Relationship','同组靠近，异组拉开。','Keep related items close and separate different groups.','proximity',[
            ['接近原则说明：距离较近的对象更容易被感知为一组。','The principle of proximity says nearby objects are more likely to be perceived as a group.'],
            ['间距不是孤立数值，而是在编码关系强弱。','Spacing is not an isolated number; it encodes relationship strength.'],
            ['组内与组间距离需要形成明显比值，微小差异往往不足以被感知。','Within- and between-group gaps need a clear ratio; tiny differences may not be perceived.'],
            ['先用距离建立分组，再决定是否还需要边框。','Establish grouping with distance first, then decide whether a border is still needed.']
          ],['Whitespace is information：留白本身就在表达关系。','Whitespace is information: empty space actively expresses relationships.'],['用等距网格排列所有对象，却期望读者自动理解分组。','Using equal gaps everywhere while expecting users to infer groups.']),
          S('3-2','共同区域与相似性','Common Region and Similarity','容器、颜色与形状都能强化分组，但不能互相冲突。','Containers, color, and shape can reinforce grouping, but they must not conflict.','region',[
            ['共同区域通常比单纯相似性更强：同一容器会立即建立边界。','Common region is often stronger than similarity: one container creates an immediate boundary.'],
            ['相似性适合表达同类角色，但颜色同时承担数据编码时要谨慎。','Similarity works for shared roles, but use color carefully when it also encodes data.'],
            ['边框应只出现在边界确实有意义的地方。','Borders should appear only where the boundary has meaning.'],
            ['多个分组线索一致时理解最快；线索冲突时会产生歧义。','Understanding is fastest when grouping cues agree; conflicting cues create ambiguity.']
          ],['把距离、区域和样式看作可叠加的分组证据。','Treat distance, region, and style as cumulative grouping evidence.'],['每张卡片都套一层边框，结果页面充满“盒子噪声”。','Wrapping every item in a border until the page becomes box noise.']),
          S('3-3','密度与留白的平衡','Balance Density and Whitespace','留白过少会拥挤，过多也会割裂。','Too little space crowds; too much space fragments.','density',[
            ['信息密度应根据任务频率和阅读时长调节。','Information density should follow task frequency and reading duration.'],
            ['操作型看板可以更紧凑，解释型内容需要更长呼吸。','Operational dashboards can be denser; explanatory content needs more breathing room.'],
            ['有效留白优先服务分组、焦点和可点击区域。','Useful whitespace serves grouping, focus, and clickable areas first.'],
            ['密度不是“每屏越多越好”，而是单位注意力获得多少有效信息。','Density is not about maximizing items per screen; it is useful information per unit of attention.']
          ],['同时观察拥挤、扫描距离和首屏覆盖率，避免只优化一个指标。','Observe crowding, scan distance, and first-screen coverage together.'],['把留白当成高级感装饰，导致关键内容被拉得过远。','Treating whitespace as a luxury effect and pulling related content too far apart.']),
          S('3-4','选择合适的页面组成','Choose a Page Composition','文章、表单与看板不应共享同一种骨架。','Articles, forms, and dashboards should not share one skeleton.','composition',[
            ['布局模式应从主要任务出发：阅读、比较、监控、编辑各有不同。','Composition should follow the primary task: reading, comparing, monitoring, and editing differ.'],
            ['侧栏用于稳定索引；上下文较少时，不要为了“完整”强行加入。','Sidebars support stable indexes; do not add one merely to look complete.'],
            ['卡片网格适合可独立扫描的模块，不适合连续论证。','Card grids suit independently scannable modules, not continuous arguments.'],
            ['一个页面可以组合模式，但必须有明确主模式。','A page may combine patterns, but it still needs one dominant mode.']
          ],['先确定主要动作，再选择页面骨架，而不是从模板反推需求。','Choose the page skeleton after defining the primary action, not by reverse-engineering a template.'],['所有项目都套“顶部 Hero + 三列卡片”，忽略真实内容流程。','Forcing every project into a hero and three-card grid regardless of content flow.'])
        ]
      },
      {
        slug: 'lesson-04', accent: '#f0a202',
        title: B('响应式与可访问布局', 'Responsive and Accessible Layout'),
        desc: B('让结构在屏幕、文字和输入方式变化时仍然成立。', 'Keep structure meaningful as screens, text size, and input methods change.'),
        outcome: B('能用内容约束确定断点，并保证视觉顺序与 DOM 顺序一致。', 'Set content-driven breakpoints and keep visual order aligned with DOM order.'),
        case: B('桌面版的层级和分组已经清楚，但在 768px、375px 与 200% 文字缩放下，主图会变窄、卡片固定高度失效、触控目标变小。断点必须由这些内容约束触发。', 'Hierarchy and grouping are clear on desktop, but at 768px, 375px, and 200% text zoom the main chart narrows, fixed card heights fail, and touch targets shrink. Those content constraints must trigger the breakpoints.'),
        tags: [B('重排', 'Reflow'), B('内容优先级', 'Content priority'), B('可访问性', 'Accessibility')],
        sections: [
          S('4-1','响应式不是等比缩小','Responsive Is Not Scale-Down','结构要重排，而不是把桌面压成邮票。','Structure must reflow, not shrink into a desktop postage stamp.','responsive',[
            ['响应式布局由 Reflow、Breakpoint 与 Priority 共同组成。','Responsive layout combines reflow, breakpoints, and priority.'],
            ['当一行内容无法保持最低可读宽度时，结构就应改变。','When a row cannot preserve minimum readable widths, the structure should change.'],
            ['移动端不是桌面端的删减版，而是按任务优先级重新排序的版本。','Mobile is not a reduced desktop; it is reordered by task priority.'],
            ['动画可以帮助理解重排，但不能掩盖跳跃或内容丢失。','Animation can clarify reflow, but it must not hide jumps or lost content.']
          ],['断点来自内容发生碰撞的时刻，而不是设备品牌。','Breakpoints come from content collisions, not device brands.'],['只写 768px 和 1024px，却不验证这些点是否对应真实内容约束。','Using 768px and 1024px without checking whether they match content constraints.']),
          S('4-2','优先级驱动重排','Priority-Driven Reflow','空间不足时，最重要的信息先留下。','When space tightens, the most important information remains first.','priority',[
            ['核心信息应在窄屏更早出现，而不是简单沿桌面列顺序堆叠。','Core information should appear earlier on narrow screens, not merely stack in desktop column order.'],
            ['隐藏内容前，应判断它是次要、可延后，还是必须通过折叠保留。','Before hiding content, decide whether it is secondary, deferrable, or must remain via disclosure.'],
            ['视觉顺序与 DOM 顺序不一致会给键盘和读屏用户制造障碍。','A mismatch between visual and DOM order creates barriers for keyboard and screen-reader users.'],
            ['同一优先级模型应连接桌面层级与移动端顺序。','One priority model should connect desktop hierarchy to mobile ordering.']
          ],['把第 1 章的任务优先级直接用于窄屏排序，案例才能真正连续。','Reuse Chapter 1 task priority for narrow-screen ordering so the case truly continues.'],['用 CSS order 大幅改变视觉顺序，却没有同步 DOM 与焦点顺序。','Radically changing visual order with CSS order while leaving DOM and focus order behind.']),
          S('4-3','文字缩放与触控空间','Text Zoom and Touch Space','200% 文字和手指操作会暴露脆弱布局。','Two-hundred-percent text and touch input expose fragile layouts.','accessibility',[
            ['文字放大后，组件需要增长或重排，固定高度常会截断内容。','As text grows, components must grow or reflow; fixed heights often clip content.'],
            ['触控目标需要足够尺寸与间隔，不能只扩大图标而不扩大命中区域。','Touch targets need sufficient size and spacing; enlarging only the icon is not enough.'],
            ['长英文、中文换行、数字和单位都要进入压力测试。','Long English, Chinese wrapping, numbers, and units all belong in stress tests.'],
            ['可访问布局不是最后检查项，而是结构稳健性的试金石。','Accessible layout is not a final checkbox; it is a stress test for structural robustness.']
          ],['用文字缩放和触控尺寸同时测试组件，而不是只缩浏览器窗口。','Test text zoom and target size together, not only browser width.'],['用 overflow:hidden 掩盖问题；被裁掉的内容对用户来说就是缺失。','Hiding the problem with overflow:hidden; clipped content is missing content.']),
          S('4-4','内容驱动的断点','Content-Driven Breakpoints','观察碰撞、行长和最小图表宽度来决定切换点。','Use collisions, line length, and minimum chart width to choose breakpoints.','breakpoint',[
            ['断点是布局模式失效的阈值，不是设备分类标签。','A breakpoint is the threshold where a layout mode fails, not a device category label.'],
            ['图表、表格和导航各有最低可用宽度，页面断点要协调这些约束。','Charts, tables, and navigation each have minimum usable widths; page breakpoints coordinate them.'],
            ['在阈值附近来回拖动，能发现抖动、溢出与不稳定换行。','Dragging around the threshold reveals jitter, overflow, and unstable wrapping.'],
            ['优先选择更少、更有解释力的断点。','Prefer fewer, more explainable breakpoints.']
          ],['让数据告诉你布局何时失效，再记录断点。','Let observed failure tell you when to switch layouts, then record the breakpoint.'],['先按常见设备宽度写断点，再用内容勉强适配。','Starting from popular device widths and forcing content to comply.'])
        ]
      },
      {
        slug: 'lesson-05', accent: '#2f6fed',
        title: B('Campus Pulse 综合重构', 'Campus Pulse Capstone'),
        desc: B('把前四章的决策合成一个可拖拽、可审计、可解释的最终方案。', 'Combine the first four chapters into a draggable, auditable, explainable final solution.'),
        outcome: B('能完成从问题诊断到多屏验证的完整布局工作流。', 'Complete a full layout workflow from diagnosis to multi-screen validation.'),
        case: B('前四章已经形成任务优先级、网格、分组距离和断点规则。最终评审要求回放每一步只解决什么问题，并交付可拖拽审计、误差显影和多屏设计说明。', 'The first four chapters produced task priorities, a grid, grouping gaps, and breakpoint rules. The final review requires evidence of what each step fixes, plus a draggable audit, visible error annotations, and a multi-screen rationale.'),
        tags: [B('前后对比', 'Before/after'), B('布局实验室', 'Layout lab'), B('X-Ray 审计', 'X-Ray audit')],
        sections: [
          S('5-1','回放完整重构','Replay the Full Redesign','拖动时间线，看同一个看板如何逐步变好。','Scrub the timeline to see one dashboard improve step by step.','beforeafter',[
            ['阶段 0 保留所有原始问题，后续阶段一次只修复一个设计变量。','Stage 0 preserves every original problem; later stages repair one variable at a time.'],
            ['对象恒常性让学习者能追踪“同一个模块发生了什么”。','Object constancy lets learners track what happened to the same module.'],
            ['前后对比应解释原因，而不只是展示漂亮结果。','Before-and-after comparison should explain causes, not only show a polished result.'],
            ['每一步都应能回到任务目标：更快找到核心趋势并完成判断。','Every step should return to the task goal: find the core trend and decide faster.']
          ],['使用同一数据键和 D3 transition，保持模块身份不变。','Use stable data keys and D3 transitions to preserve module identity.'],['同时替换所有内容和样式，导致学习者无法判断是哪一步产生效果。','Changing content and style at once so learners cannot identify what made the difference.']),
          S('5-2','拖拽布局实验室','Drag-and-Drop Layout Lab','亲手安排模块，并让网格提供可解释反馈。','Arrange modules yourself and let the grid provide explainable feedback.','lab',[
            ['拖拽允许探索，吸附把探索结果约束到可复用的系统。','Dragging supports exploration; snapping constrains results to a reusable system.'],
            ['反馈应分解为对齐、层级、间距和溢出，而不是只给总分。','Feedback should separate alignment, hierarchy, spacing, and overflow rather than only show a total.'],
            ['评分只反映课程中的已声明规则，不代表普遍审美。','The score reflects declared course rules only; it is not universal taste.'],
            ['最有价值的反馈是指出下一步该改什么。','The most useful feedback says what to change next.']
          ],['d3.drag()、网格吸附和实时度量共同构成探索闭环。','d3.drag(), grid snapping, and live metrics form an exploration loop.'],['追求高分而机械堆叠卡片。规则用于解释取舍，不是替代判断。','Mechanically stacking cards to chase a score. Rules explain trade-offs; they do not replace judgment.']),
          S('5-3','打开 Layout X-Ray','Turn On Layout X-Ray','把隐藏的列、间距、对齐误差与溢出全部显影。','Reveal hidden columns, gaps, alignment errors, and overflow.','xray',[
            ['X-Ray 把视觉感觉翻译成可讨论的几何证据。','X-Ray translates visual feelings into discussable geometric evidence.'],
            ['辅助线只在检查时出现，成品界面不需要永远展示它们。','Guides appear during inspection; the finished interface does not need them permanently.'],
            ['尺寸标注应服务诊断，避免把工程图效果当成装饰。','Measurements should support diagnosis, not turn blueprint styling into decoration.'],
            ['错误覆盖层要说明误差来源和修复动作。','Error overlays should identify both the source and the repair action.']
          ],['将对齐误差、间距偏差和边界碰撞绑定到可视化标注。','Bind alignment error, spacing deviation, and boundary collision to visible annotations.'],['只画很多网格线，却不告诉学生哪条线与哪个问题有关。','Drawing many guides without showing which one relates to which issue.']),
          S('5-4','多屏验证与设计说明','Multi-Screen Validation and Rationale','同时验证桌面、平板、手机和文字放大。','Validate desktop, tablet, mobile, and text zoom together.','multiscreen',[
            ['最终验证应覆盖结构变化，而不只是检查有没有横向滚动。','Final validation should cover structural change, not only horizontal scrolling.'],
            ['每个断点都要说明保留、移动、折叠或隐藏了什么。','At every breakpoint, explain what stays, moves, collapses, or hides.'],
            ['设计说明应连接用户任务、布局规则和观察结果。','A rationale should connect user tasks, layout rules, and observed results.'],
            ['桌面成功不代表课程完成；窄屏和 200% 文字是同等重要的证据。','Desktop success does not finish the course; narrow screens and 200% text are equally important evidence.']
          ],['用同一布局模型生成三种视图，验证规则是否真正可迁移。','Generate three views from one layout model to verify that rules really transfer.'],['为每个设备手工画一套互不关联的页面，导致后续维护失控。','Handcrafting unrelated pages for every device until maintenance collapses.'])
        ]
      }
    ],
    how: [
      B('先看案例问题：每节都从 Campus Pulse 的一个真实症状开始。', 'Start with the case problem: every section begins with a real Campus Pulse symptom.'),
      B('再读判断规则：理解为什么改，而不是只记某个 CSS 属性。', 'Read the decision rules: understand why to change, not just which CSS property to remember.'),
      B('最后操作 D3 演示：改变参数，观察结构与反馈如何一起变化。', 'Operate the D3 demo: change parameters and observe structure and feedback together.')
    ],
    sources: [
      'Gestalt principles · proximity, similarity, common region',
      'Edward Tufte · visual hierarchy and information density',
      'Stephen Few · dashboard information design',
      'W3C WCAG · reflow, text resizing, target spacing',
      'Mike Bostock · D3 scales, transitions, drag, data join'
    ]
  };
})();
