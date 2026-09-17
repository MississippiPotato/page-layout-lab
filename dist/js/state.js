/**
 * state.js —— 跨章布局状态。
 *
 * 旧版的"案例路线"只存在于叙事里：第 5 章的实验室从一份写死的乱稿开始，
 * 前四章学习者做的任何调整都不会带过去。于是"同一个案例贯穿五章"这句话
 * 在机制上是假的。
 *
 * 这里把它做成真的：每一章的决定都写进同一份状态，第 5 章审计的是
 * **学习者自己的布局**，第 5-4 节复测的是**学习者自己第 1 章留下的基线**。
 *
 * 存储用 localStorage，因此刷新、关页、隔天再来都还在。
 * 读写必须经由本模块，不要在别处直接碰 localStorage。
 */

const KEY = 'campus-layout-state';
const VERSION = 1;

/** 初始状态即"混乱初稿"：第 1 章要诊断的就是它。 */
function initial() {
  return {
    version: VERSION,
    /** 第 1-1 节限时任务基线：{ taskId, ms, misclicks, correct, at } */
    baseline: null,
    /** 第 5-4 节复测结果，结构同上 */
    retest: null,
    /** 第 1-2 节任务地图产出的模块优先级（id 数组，最重要在前） */
    priority: null,
    /** 第 2 章的栅格决定 */
    grid: { columns: 12, margin: 24, gutter: 16 },
    /** 第 3 章的分组决定：模块 id -> 组号 */
    groups: null,
    /** 第 4 章算出的断点（px 数组） */
    breakpoints: null,
    /** 第 5-2 节实验室里的卡片几何：id -> {x,y,w,h} */
    layout: null,
    /** 学习者走过哪些小节，用于门户进度显示 */
    visited: []
  };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw);
    // 版本不符就重来，不做迁移：这是教学状态，丢了没有代价
    if (!parsed || parsed.version !== VERSION) return initial();
    return { ...initial(), ...parsed };
  } catch {
    // 隐私模式 / 禁用站点数据 / JSON 损坏——一律退回初始态，页面必须照常能用
    return initial();
  }
}

let current = read();

/** 取当前状态的只读副本。 */
export function readState() {
  return structuredClone(current);
}

/**
 * 合并式更新。只写你关心的字段，其余保持不变。
 * 写入后派发 `layoutstatechange`，体检卡与各演示据此刷新。
 */
export function patchState(patch) {
  current = { ...current, ...patch, version: VERSION };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // 写不进去也不能让演示崩：本次会话内存里的状态仍然有效
  }
  window.dispatchEvent(new CustomEvent('layoutstatechange', { detail: readState() }));
  return readState();
}

/** 回到混乱初稿。第 1 章与第 5 章都提供这个入口。 */
export function resetState() {
  current = initial();
  try { localStorage.removeItem(KEY); } catch { /* 同上 */ }
  window.dispatchEvent(new CustomEvent('layoutstatechange', { detail: readState() }));
  return readState();
}

/** 记录学习者到过某小节，供门户显示进度。 */
export function markVisited(sectionId) {
  const visited = current.visited || [];
  if (visited.includes(sectionId)) return readState();
  return patchState({ visited: [...visited, sectionId] });
}

/** 订阅状态变化，返回退订函数。 */
export function onStateChange(fn) {
  const h = (e) => fn(e.detail);
  window.addEventListener('layoutstatechange', h);
  return () => window.removeEventListener('layoutstatechange', h);
}

/**
 * 第 1 章基线与第 5 章复测的对照。
 *
 * **诚实声明**：这是 n=1、非受控的一次自测，受熟悉度、练习效应、 ←→ Be honest about this: it is a single uncontrolled self-test (n=1), affected by familiarity,
 * 当天状态影响。它演示的是"布局影响视觉搜索"这一机制， ←→ practice effects and the day's form. It demonstrates the mechanism that layout affects visual search —
 * 不是一个实验结论。界面上必须同时呈现这句话。 ←→ it is not an experimental result, and the interface must always say so alongside the number.
 */
// #region snippet:compare
export function compareRuns() {
  const { baseline, retest } = current;
  if (!baseline || !retest) return null;
  const delta = baseline.ms - retest.ms;
  return {
    baseline, retest, delta,
    ratio: baseline.ms ? retest.ms / baseline.ms : null,
    faster: delta > 0,
    /** 提醒调用方：任何结论都必须带上这个限定 ←→ reminds the caller that every conclusion must carry this qualifier */
    caveat: {
      zh: '单次自测（n=1），且第二次已熟悉数据，存在练习效应；这演示的是机制，不是实验结论。',
      en: 'A single self-test (n=1) with a practice effect on the second run — this demonstrates a mechanism, not an experimental result.'
    }
  };
}
// #endregion
