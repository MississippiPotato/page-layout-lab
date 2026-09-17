/**
 * snippets.js —— 「关键代码」标签页的源码自抽取。
 *
 * 旧版把 40 段代码手写在一张 CODE 表里，结果与真正运行的实现逐渐脱节：
 * 代码页声称 `d3.scaleBand()`，实现却是手算 `inner / columns`；
 * 声称 `d3.group()`，实现用的是 `Set`。对一门以「关键代码」为卖点的课，
 * 这是最严重的信誉问题——讲解可以简化，但不能与事实不符。
 *
 * 这里改为**从正在运行的源码里抽**：模块用 `// #region snippet:<名字>`
 * 与 `// #endregion` 标出片段，本模块 fetch 该文件、按标记截取。
 * 于是代码页永远等于实现，不存在"忘记同步"这种失败模式。
 *
 * 代价：需要一个 http server（本课本来就要求），且多一次同源请求（已缓存）。
 */

const cache = new Map();

/** 读取并缓存一个源码文件。失败时返回 null，由调用方降级处理。 */
async function loadSource(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url, { cache: 'force-cache' })
    .then(r => (r.ok ? r.text() : null))
    .catch(() => null);
  cache.set(url, p);
  return p;
}

/**
 * 双语注释。
 *
 * 课程要求中英内容一致，而「关键代码」里最有价值的往往是注释本身。
 * 为此约定一种**单行**写法，让源码保持可读、不必把每条注释写两遍：
 *
 *   // 组内更近、组间更远 ←→ closer within, farther between
 *
 * 抽取时按当前语言只保留一侧，并补回原来的缩进与注释前缀。
 * 没有分隔符的行原样输出（代码行、纯符号注释等）。
 */
const SEP = ' ←→ ';
function localizeComments(code, lang) {
  return code.split('\n').map(line => {
    const i = line.indexOf(SEP);
    if (i < 0) return line;

    // 单行块注释 /** … */ 的结束符总在行尾，它属于两种语言共有的部分，
    // 必须先摘下来、选完语言再接回去，否则中文那一侧会丢掉 */ 而语法出错。
    const close = /\s*\*\/\s*$/.exec(line);
    const body = close ? line.slice(0, close.index) : line;
    const tail = close ? close[0].replace(/\s+$/, '') : '';

    const cut = body.indexOf(SEP);
    if (cut < 0) return line;
    const zhSide = body.slice(0, cut);
    if (lang !== 'en') return zhSide + tail;

    const enSide = body.slice(cut + SEP.length);
    const prefix = zhSide.match(/^(\s*(?:\/\/|\*|\/\*\*?)\s?)/);
    return (prefix ? prefix[1] : '') + enSide + tail;
  }).join('\n');
}

/** 去掉整段共同的缩进，让片段单独看也是齐的。 */
function dedent(text) {
  const lines = text.replace(/\t/g, '  ').split('\n');
  const indents = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map(l => l.slice(cut)).join('\n').trim();
}

/**
 * 从 url 指向的源码里抽出名为 name 的片段。
 *
 * @param {string} lang 'zh' | 'en'——决定双语注释保留哪一侧
 * @returns {Promise<{code:string, url:string, lines:[number,number]}|null>}
 *          lines 为该片段在源文件中的真实行号，用于在页面上注明出处。
 */
export async function extract(url, name, lang = 'zh') {
  const src = await loadSource(url);
  if (!src) return null;

  const lines = src.split('\n');
  const startIdx = lines.findIndex(l => l.includes(`#region snippet:${name}`));
  if (startIdx < 0) return null;

  // 支持嵌套：整个函数是一个 region，其内部还能再标出几行教学重点。
  // 因此必须按深度配对，不能遇到第一个 #endregion 就收手。
  let depth = 1, endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes('#region ')) depth++;
    else if (lines[i].includes('#endregion') && --depth === 0) { endIdx = i; break; }
  }
  if (endIdx < 0) return null;

  // 内层标记只给抽取器看，不该出现在展示给学生的代码里
  const body = lines.slice(startIdx + 1, endIdx)
    .filter(l => !/#(region|endregion)\b/.test(l))
    .join('\n');
  return {
    code: dedent(localizeComments(body, lang)),
    url,
    // +2：跳过 #region 那一行，并从 1 开始计数
    lines: [startIdx + 2, endIdx]
  };
}

/** 一次抽多个片段，保持给定顺序；抽不到的条目为 null。 */
export async function extractAll(specs, lang = 'zh') {
  return Promise.all(specs.map(s => extract(s.url, s.name, lang)));
}

/* ── 语法高亮 ──────────────────────────────────────────────────────────── */

const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * 轻量高亮。旧版把所有关键字都标成 .fn，这里按真实词类分开：
 * 注释 / 字符串 / 数字 / 关键字 / 函数名 / d3 链式方法。
 * 不引第三方高亮库——课程要求断网可跑。
 */
export function highlight(code) {
  const token = new RegExp([
    /\/\*[\s\S]*?\*\//.source,                 // 块注释
    /\/\/[^\n]*/.source,                       // 行注释
    /`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`/.source, // 模板串
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/.source, // 字符串
    /\b(?:const|let|var|function|return|if|else|for|of|in|new|class|export|import|from|await|async|this|null|true|false)\b/.source,
    /\.[a-zA-Z_$][\w$]*(?=\s*\()/.source,      // .method(
    /\b[a-zA-Z_$][\w$]*(?=\s*\()/.source,      // fn(
    /\b\d+(?:\.\d+)?\b/.source                 // 数字
  ].join('|'), 'g');

  let out = '', last = 0, m;
  while ((m = token.exec(code)) !== null) {
    out += esc(code.slice(last, m.index));
    const t = m[0];
    const cls =
      t.startsWith('//') || t.startsWith('/*') ? 'cmt' :
      /^[`'"]/.test(t) ? 'str' :
      /^\d/.test(t) ? 'num' :
      /^\./.test(t) ? 'mth' :
      /^(const|let|var|function|return|if|else|for|of|in|new|class|export|import|from|await|async|this|null|true|false)$/.test(t) ? 'kw' :
      'fn';
    out += `<span class="${cls}">${esc(t)}</span>`;
    last = m.index + t.length;
  }
  return out + esc(code.slice(last));
}
