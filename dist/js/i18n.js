/**
 * i18n.js —— 语言状态与文案取值。
 *
 * 旧实现把语言判断散在演示代码里，写成 150 多处 `lang === 'zh' ? '列数' : 'Columns'`，
 * 与 README 宣称的"内容集中在一份数据里"自相矛盾，翻译时要改两个文件。
 * 现在：语言状态只由本模块持有，演示层通过 t() 取词，词条集中在 strings.js。
 *
 * 语言优先级：URL 的 ?lang= > localStorage > 'zh'。
 * 选择会写回 URL 与 localStorage，因此在页面之间、刷新之后都保持一致。
 */

const KEY = 'layout-course-lang';
const SUPPORTED = ['zh', 'en'];

function resolve() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (SUPPORTED.includes(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(KEY);
    if (SUPPORTED.includes(stored)) return stored;
  } catch { /* 隐私模式下读不到，退回默认 */ }
  return 'zh';
}

let lang = resolve();

export const getLang = () => lang;

/**
 * 取双语值。接受 {zh,en} 对象，也接受已经是字符串的值（原样返回），
 * 后者让调用方不必关心某个字段是否需要翻译。
 */
export const t = (value) =>
  value == null ? '' :
  typeof value === 'string' ? value :
  value[lang] ?? value.zh ?? '';

/** 按当前语言二选一，供少量就地文案使用。 */
export const pick = (zh, en) => (lang === 'zh' ? zh : en);

/** 给站内链接带上语言参数，使切换后的选择在跳转中不丢失。 */
export const linkFor = (href) =>
  `${href}${href.includes('?') ? '&' : '?'}lang=${lang}`;

/** HTML 转义。凡是把课程文案拼进 innerHTML 的地方都要过一遍。 */
export const esc = (text) =>
  String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * 切换语言：写存储、写 URL、更新 <html lang>，并派发 `langchange`。
 * 不直接重渲染——由页面决定何时重绘，避免本模块反向依赖视图层。
 */
export function setLang(next) {
  if (!SUPPORTED.includes(next) || next === lang) return lang;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch { /* 同上 */ }
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(history.state, '', url);
  applyDocumentLang();
  window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  return lang;
}

/** 同步 <html lang>，供屏幕阅读器选择正确的发音。 */
export function applyDocumentLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}

export function onLangChange(fn) {
  const h = (e) => fn(e.detail);
  window.addEventListener('langchange', h);
  return () => window.removeEventListener('langchange', h);
}
