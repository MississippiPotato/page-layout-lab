/**
 * Campus Pulse —— 课程学习看板数据集 / course-activity dataset
 *
 * 本文件由 tools/gen-campus-data.js 以固定种子生成，请勿手工编辑。
 * 数据是自洽的：完成率唯一最高者为「数据可视化」，唯一最低者为「编译原理」。
 * 第 1 章与第 5 章的限时任务依赖这一唯一性，重新生成数据时必须保持。
 */

/** 12 个教学周。 */
export const weeks = [1,2,3,4,5,6,7,8,9,10,11,12];

/** 热力图的行坐标：星期。 */
export const days = [
  { id:'d0', zh:'周一', en:"Mon" },
  { id:'d1', zh:'周二', en:"Tue" },
  { id:'d2', zh:'周三', en:"Wed" },
  { id:'d3', zh:'周四', en:"Thu" },
  { id:'d4', zh:'周五', en:"Fri" },
  { id:'d5', zh:'周六', en:"Sat" },
  { id:'d6', zh:'周日', en:"Sun" }
];

/** 热力图的列坐标：整点时段。 */
export const slots = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

/** 8 门课程。active[] 与 weeks 等长；completion 为 0–1；hours 为周均学习时长（小时）。 */
export const courses = [
  { id:"viz", zh:"数据可视化", en:"Data Visualization", completion:0.91, hours:5,
    active:[958,1066,1100,1136,1106,1051,884,997,1115,1174,1344,1455] },
  { id:"hci", zh:"人机交互", en:"Human-Computer Interaction", completion:0.84, hours:4.9,
    active:[829,897,937,930,919,871,716,835,933,993,1091,1166] },
  { id:"ml", zh:"机器学习", en:"Machine Learning", completion:0.79, hours:4.7,
    active:[1134,1236,1270,1355,1300,1270,1061,1200,1353,1411,1592,1693] },
  { id:"db", zh:"数据库原理", en:"Database Systems", completion:0.73, hours:4.7,
    active:[743,803,829,850,849,808,620,742,828,868,931,1018] },
  { id:"ds", zh:"数据结构", en:"Data Structures", completion:0.68, hours:4.3,
    active:[1033,1077,1124,1165,1087,1054,809,945,1057,1096,1191,1290] },
  { id:"cg", zh:"计算机图形学", en:"Computer Graphics", completion:0.61, hours:4,
    active:[518,596,619,614,616,577,456,556,576,638,689,735] },
  { id:"os", zh:"操作系统", en:"Operating Systems", completion:0.55, hours:3.8,
    active:[687,744,759,748,728,670,523,588,659,679,735,795] },
  { id:"comp", zh:"编译原理", en:"Compilers", completion:0.42, hours:3.5,
    active:[440,430,439,415,422,372,257,287,319,345,376,411] }
];

/** 7×12 学习热力矩阵，heat[day][slot]。 */
export const heat = [
  [188,260,297,265,169,212,326,371,452,437,338,216],
  [210,242,312,302,140,231,342,413,477,425,343,213],
  [171,229,296,282,145,209,325,360,456,395,314,203],
  [187,252,330,275,139,231,321,407,457,443,309,200],
  [160,225,277,216,133,176,276,314,380,364,263,190],
  [118,146,202,174,89,115,209,247,291,248,191,125],
  [124,168,220,171,99,140,219,278,308,286,213,121]
];

/** 每周设备占比，三段之和恒为 100。 */
export const devices = [
  {"week":1,"desktop":55,"tablet":16,"mobile":29},
  {"week":2,"desktop":54,"tablet":17,"mobile":29},
  {"week":3,"desktop":51,"tablet":16,"mobile":33},
  {"week":4,"desktop":51,"tablet":18,"mobile":31},
  {"week":5,"desktop":49,"tablet":18,"mobile":33},
  {"week":6,"desktop":49,"tablet":18,"mobile":33},
  {"week":7,"desktop":49,"tablet":17,"mobile":34},
  {"week":8,"desktop":48,"tablet":17,"mobile":35},
  {"week":9,"desktop":47,"tablet":16,"mobile":37},
  {"week":10,"desktop":47,"tablet":17,"mobile":36},
  {"week":11,"desktop":45,"tablet":18,"mobile":37},
  {"week":12,"desktop":43,"tablet":16,"mobile":41}
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
  activeThisWeek: 8563,
  avgCompletion: 0.691,
  bestCourse: "viz",
  worstCourse: "comp",
  peakWeek: 12
};

/**
 * 第 1 章 / 第 5 章限时任务题库。
 * answer 必须在数据中唯一，否则计时实验无法判对错。
 */
export const taskBank = [
  { id:'worst-completion', target:'ranking', answer:"comp",
    zh:'找出完成率最低的课程', en:'Find the course with the lowest completion' },
  { id:'best-completion',  target:'ranking', answer:"viz",
    zh:'找出完成率最高的课程', en:'Find the course with the highest completion' },
  { id:'peak-week',        target:'trend',   answer:"12",
    zh:'找出整体活跃人数最高的教学周', en:'Find the week with the highest overall activity' }
];
