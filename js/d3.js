/**
 * D3 的 ESM 适配层。
 *
 * 为什么不直接 `import * as d3 from 'd3'`：
 * 官方 dist 是 UMD（自包含，280KB），而 jsDelivr 的 `+esm` 只是一层转出壳，
 * 它会再向 CDN 请求约 30 个子包——离线即失效。本课要求断网也能完整演示
 * （答辩现场不一定有网），所以选择：UMD 由 <script> 先行加载，此处只转出全局。
 *
 * 各页面必须在任何 type="module" 脚本之前引入：
 *   <script src="../vendor/d3.v7.min.js"></script>
 */
const d3 = globalThis.d3;

if (!d3) {
  throw new Error(
    'D3 未加载。请确认 vendor/d3.v7.min.js 的 <script> 标签位于模块脚本之前。'
  );
}

export default d3;
