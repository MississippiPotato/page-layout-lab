/**
 * strings.js —— 演示层的全部界面文案。
 *
 * 旧实现把这些写成 150 多处内联三元表达式，散落在 lesson.js 各处。
 * 集中到这里之后，翻译只需要改一个文件，也便于检查中英是否一一对应。
 *
 * 约定：值一律是 {zh, en}；需要插值的写成函数，返回 {zh, en}。
 * 取值统一走 i18n.js 的 t()。
 */

const B = (zh, en) => ({ zh, en });

export const S = {
  /* ── 通用控件 ──────────────────────────────────────────────────────── */
  controls:      B('实验参数', 'Lab controls'),
  reset:         B('重置', 'Reset'),
  resetAll:      B('重置全部进度', 'Reset all progress'),
  apply:         B('应用', 'Apply'),
  start:         B('开始', 'Start'),
  retry:         B('再试一次', 'Try again'),
  showGrid:      B('显示栅格', 'Show grid'),
  showBaseline:  B('显示基线', 'Show baseline'),
  showRegion:    B('显示共同区域', 'Show common region'),
  snapToGrid:    B('吸附到栅格', 'Snap to grid'),
  breakGrid:     B('打乱布局', 'Scatter layout'),
  xray:          B('Layout X-Ray', 'Layout X-Ray'),

  /* ── 栅格参数（第 2 章） ───────────────────────────────────────────── */
  columns:       B('列数 columns', 'Columns'),
  gutter:        B('列间距 gutter', 'Gutter'),
  margin:        B('容器边距 margin', 'Container margin'),
  mainSpan:      B('主图占几列', 'Main chart spans'),
  textSpan:      B('文本栏占几列', 'Text column spans'),
  colUnit:       B(' 列', ' col'),

  /* ── 实测指标 ──────────────────────────────────────────────────────── */
  metrics: {
    collisions:  B('轴标签碰撞', 'Axis label collisions'),
    alignment:   B('对齐误差均值', 'Mean alignment error'),
    cpl:         B('每行字符数', 'Characters per line'),
    overflow:    B('越界模块', 'Overflowing modules'),
    violations:  B('约束违反', 'Constraint violations'),
    cellSize:    B('热力图单元格', 'Heatmap cell'),
    rowHeight:   B('排行行高', 'Ranking row height'),
    bandwidth:   B('列宽 bandwidth', 'Column width'),
    step:        B('列距 step', 'Column step')
  },

  /* ── 体检卡 ────────────────────────────────────────────────────────── */
  health:        B('布局体检卡', 'Layout health'),
  healthOk:      B('当前检查的指标没有报出问题。', 'The checks shown here found no issue.'),
  nextFix:       B('下一步先修：', 'Fix next:'),
  measuredNote:  B('这里列出各项检查结果，不合成总分；部分阈值是课程设定的。',
                   'These checks are shown separately, with no overall score; some thresholds are course choices.'),

  /* ── 限时任务（第 1 章 / 第 5 章） ─────────────────────────────────── */
  task: {
    title:       B('限时任务', 'Timed task'),
    prompt:      B('准备好后点「开始」，然后尽快在看板上点出答案。',
                   'Press Start, then click the answer on the board as fast as you can.'),
    running:     B('计时中——点击你认为正确的模块或条目。',
                   'Timing — click the module or row you believe is the answer.'),
    correct:     B('答对了', 'Correct'),
    wrong:       B('点错了，继续找', 'Not that one — keep looking'),
    elapsed:     B('用时', 'Time'),
    misclicks:   B('误点', 'Misclicks'),
    baseline:    B('第 1 章基线', 'Chapter 1 baseline'),
    retest:      B('重构后复测', 'After the rebuild'),
    faster:      (pct) => B(`快了 ${pct}%`, `${pct}% faster`),
    slower:      (pct) => B(`慢了 ${pct}%`, `${pct}% slower`),
    noBaseline:  B('还没有基线。请先回到第 1.1 节完成一次限时任务。',
                   'No baseline yet — complete the timed task in section 1.1 first.'),
    /** 这条必须始终可见，不能折叠隐藏 */
    caveat:      B('单次自测（n=1），第二次已熟悉数据，存在练习效应。这演示的是机制，不是实验结论。',
                   'A single self-test (n=1); the second run benefits from practice. This shows a mechanism, not an experimental result.')
  },

  /* ── 结论句式 ──────────────────────────────────────────────────────── */
  verdict: {
    tooNarrow:   B('太窄', 'Too narrow'),
    tooWide:     B('太宽', 'Too wide'),
    ok:          B('合适', 'In range'),
    stack:       B('改为上下堆叠', 'Stack vertically'),
    columns:     B('保持分栏', 'Keep columns')
  },

  /* ── X-Ray ─────────────────────────────────────────────────────────── */
  xraySite:      B('审视本站', 'X-ray this site'),
  xraySiteOn:    B('正在透视本教学网站自己的栅格与对齐。',
                   'Now inspecting this teaching site’s own grid and alignment.'),
  xraySiteOff:   B('已关闭透视。', 'Inspection off.'),

  /* ── 通用提示 ──────────────────────────────────────────────────────── */
  dragHint:      B('可拖动卡片；也可用 Tab 选中后按方向键移动。',
                   'Drag a card, or Tab to it and use the arrow keys.'),
  sourceNote:    (file, from, to) =>
    B(`代码直接取自运行中的 ${file}（第 ${from}–${to} 行）`,
      `Taken directly from the running ${file} (lines ${from}–${to})`)
};

/** 模块名（六个看板模块的显示名，与 charts.js 的 MODULES.title 保持一致）。 */
export const MODULE_NAMES = {
  trend:      B('每周活跃趋势', 'Weekly activity'),
  heat:       B('学习时段热力图', 'Study-time heatmap'),
  ranking:    B('课程完成率排行', 'Completion ranking'),
  completion: B('平均完成率', 'Avg. completion'),
  devices:    B('设备分布', 'Device mix'),
  blurb:      B('看板说明', 'About this board')
};
