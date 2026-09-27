/**
 * 生成 dist/data/campus.js。固定种子，可复现。
 * 用法：node tools/gen-campus-data.js > dist/data/campus.js
 */
let s = 20260916;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const courses = [
  { id:'viz',  zh:'数据可视化',   en:'Data Visualization',         completion:0.91, base:980,  trend: 1.00 },
  { id:'hci',  zh:'人机交互',     en:'Human-Computer Interaction', completion:0.84, base:820,  trend: 0.62 },
  { id:'ml',   zh:'机器学习',     en:'Machine Learning',           completion:0.79, base:1140, trend: 1.35 },
  { id:'db',   zh:'数据库原理',   en:'Database Systems',           completion:0.73, base:760,  trend: 0.15 },
  { id:'ds',   zh:'数据结构',     en:'Data Structures',            completion:0.68, base:1040, trend:-0.40 },
  { id:'cg',   zh:'计算机图形学', en:'Computer Graphics',          completion:0.61, base:540,  trend: 0.30 },
  { id:'os',   zh:'操作系统',     en:'Operating Systems',          completion:0.55, base:700,  trend:-0.75 },
  { id:'comp', zh:'编译原理',     en:'Compilers',                  completion:0.42, base:430,  trend:-1.10 },
];

// 12 教学周：第 7 周期中低谷，第 11–12 周期末冲刺
const shape = [1.00,1.06,1.10,1.12,1.08,1.02,0.82,0.94,1.04,1.09,1.22,1.31];
for (const c of courses) {
  c.active = shape.map((f,i) => Math.round(c.base * f + c.trend * i * 14 + (rnd()-0.5) * 46));
  c.hours  = +(2.1 + c.completion * 3.4 + (rnd()-0.5) * 0.5).toFixed(1);
}

// 7 天 × 12 个整点时段（09:00–20:00），工作日与晚间为高峰
const dayW  = [1.08,1.12,1.05,1.10,0.92,0.66,0.74];
const slotW = [.42,.55,.68,.60,.34,.46,.72,.86,1.00,.94,.71,.45];
const heat  = dayW.map(dw => slotW.map(sw => Math.round(dw * sw * 420 + (rnd()-0.5) * 40)));

// 每周设备占比，归一化到恰好 100
const devices = shape.map((_, i) => {
  const desktop = Math.round(54 - i * 0.9 + (rnd()-0.5) * 3);
  const tablet  = Math.round(17 + (rnd()-0.5) * 2.5);
  return { week:i+1, desktop, tablet, mobile: 100 - desktop - tablet };
});

const J = v => JSON.stringify(v);
const byCompletion = [...courses].sort((a,b) => b.completion - a.completion);
const best  = byCompletion[0];
const worst = byCompletion[byCompletion.length - 1];
const weekTotals = shape.map((_, w) => courses.reduce((a,c) => a + c.active[w], 0));
const peakWeek = weekTotals.indexOf(Math.max(...weekTotals)) + 1;

process.stdout.write(`/**
 * Campus Pulse —— 课程学习看板数据集 / course-activity dataset
 *
 * 本文件由 tools/gen-campus-data.js 以固定种子生成，请勿手工编辑。
 * 数据是自洽的：完成率唯一最高者为「${best.zh}」，唯一最低者为「${worst.zh}」。
 * 第 1 章与第 5 章的限时任务依赖这一唯一性，重新生成数据时必须保持。
 */

/** 12 个教学周。 */
export const weeks = ${J(courses[0].active.map((_,i)=>i+1))};

/** 热力图的行坐标：星期。 */
export const days = [
${['一','二','三','四','五','六','日'].map((d,i)=>`  { id:'d${i}', zh:'周${d}', en:${J(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i])} }`).join(',\n')}
];

/** 热力图的列坐标：整点时段。 */
export const slots = ${J(slotW.map((_,i)=>`${String(i+9).padStart(2,'0')}:00`))};

/** 8 门课程。active[] 与 weeks 等长；completion 为 0–1；hours 为周均学习时长（小时）。 */
export const courses = [
${courses.map(c => `  { id:${J(c.id)}, zh:${J(c.zh)}, en:${J(c.en)}, completion:${c.completion}, hours:${c.hours},\n    active:${J(c.active)} }`).join(',\n')}
];

/** 7×12 学习热力矩阵，heat[day][slot]。 */
export const heat = [
${heat.map(r => '  ' + J(r)).join(',\n')}
];

/** 每周设备占比，三段之和恒为 100。 */
export const devices = [
${devices.map(d => '  ' + J(d)).join(',\n')}
];

/** 看板说明文本——第 2-3 节用它实测每行字符数，故中英长度需接近。 */
export const blurb = {
  zh: '本看板汇总 8 门课程在 12 个教学周内的学习活跃度、完成率与设备来源。教务人员每天先判断整体活跃趋势是否异常，再定位完成率偏低的课程，最后核对具体时段。',
  en: 'This board aggregates activity, completion, and device mix for 8 courses across 12 teaching weeks. Staff first check whether the overall trend looks abnormal, then locate the courses falling behind, and finally inspect the hourly detail.'
};

/**
 * 教务系统里的**录入顺序**——乱稿的排行榜按它显示。
 *
 * 这是一个固定但与完成率无关的顺序，作用是让"找出完成率最低的课程"
 * 在未排序时必须逐行读数字。答案刻意落在中间位置，既不在首行也不在末行，
 * 且中英两种语言下难度一致（不用按名称排序，否则两种语言难度会不同）。
 */
export const entryOrder = ['ds', 'viz', 'os', 'hci', 'comp', 'db', 'ml', 'cg'];

/** 派生量：全部由上面的原始数据算出，不另行硬编码。 */
export const totals = {
  activeThisWeek: ${courses.reduce((a,c)=>a+c.active[c.active.length-1],0)},
  avgCompletion: ${+(courses.reduce((a,c)=>a+c.completion,0)/courses.length).toFixed(3)},
  bestCourse: ${J(best.id)},
  worstCourse: ${J(worst.id)},
  peakWeek: ${peakWeek}
};

/**
 * 第 1 章 / 第 5 章限时任务题库。
 * answer 必须在数据中唯一，否则计时实验无法判对错。
 */
export const taskBank = [
  { id:'worst-completion', target:'ranking', answer:${J(worst.id)},
    zh:'找出完成率最低的课程', en:'Find the course with the lowest completion' },
  { id:'best-completion',  target:'ranking', answer:${J(best.id)},
    zh:'找出完成率最高的课程', en:'Find the course with the highest completion' },
  { id:'peak-week',        target:'trend',   answer:${J(String(peakWeek))},
    zh:'找出整体活跃人数最高的教学周', en:'Find the week with the highest overall activity' }
];
`);
