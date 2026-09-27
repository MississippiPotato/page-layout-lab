/**
 * registry.js —— 演示注册表。
 *
 * 外壳（shell.js）不认识任何具体演示，只按 section.demo 这个键到这里查。
 * 每个条目提供：
 *   render(mount, ctx)  渲染演示
 *   snippets[]          「关键代码」要展示哪几段——由 snippets.js 从源码现抽
 *
 * 各章一个模块，画布形态与交互原型由各章自行决定，
 * 以此避免旧版"二十个演示共用一个 720×430 灰卡片画布"的单调。
 */

import { DEMOS as CH1 } from './demos/ch1.js';
import { DEMOS as CH2 } from './demos/ch2.js';
import { DEMOS as CH3 } from './demos/ch3.js';
import { DEMOS as CH4 } from './demos/ch4.js';
import { DEMOS as CH5 } from './demos/ch5.js';

const REGISTRY = {
  ...CH1,
  ...CH2,
  ...CH3,
  ...CH4,
  ...CH5
};

/** 查不到就返回 null，由外壳显示占位提示，不抛错。 */
export const getDemo = (key) => REGISTRY[key] ?? null;

export const registeredKeys = () => Object.keys(REGISTRY);
