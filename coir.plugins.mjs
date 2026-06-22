// coir.plugins.mjs — PORTABLE example config (loaded by EVERY host: browser + node).
//
// A browser config MUST be self-contained:
//   • NO relative `import`s — the browser blob-imports this file and can't resolve
//     them (`import './audio-call.mjs'` → fails). Those go in coir.plugins.node.mjs.
//   • NO node APIs (`fs`, `child_process`, …) — they don't exist in the browser.
//   • Only pure-graph fields take effect here: edges / colors / messages /
//     importerTypes / typeByExt / jsonSourceExts / rootTypes / reports.
//     `commands` (CLI/MCP), `assetMenus` (editor) and `rules` (coir check) do
//     NOTHING in the browser — coir warns if it sees them in a browser config.
//
// The edge plugins in this repo (audio-call / i18n-label / resources-load /
// resources-sprite) are all ZERO-import, so to use one in the BROWSER, paste its
// `export default {…}` body straight into the array below (self-contained). For
// NODE-only / headless use you can instead `import` them in coir.plugins.node.mjs.
// anim/skel are node-only (commands + binary reads) → they do NOT belong here.
//
// Below is a minimal self-contained plugin as a template — replace it / add to it.

/** @type {import('coir').Plugin} */
const example = {
  name: 'example-portable',
  // Presentation-only fields are always portable:
  colors: { /* myType: '#88c0d0' */ },
  messages: { /* 'type.myType': { 'zh-Hant': '我的型別', en: 'My Type' } */ },
  // Pure-graph edges over `ctx` — no imports, no fs. `ctx` gives you the asset
  // index, addEdge/addNode/resolveUuid, files/readText, scripts, env, bundles,
  // and (when a node host supplies them) projectDir + cocosVersion.
  async edges(ctx) {
    // e.g. walk ctx.scripts / ctx.files and ctx.addEdge(from, to, 'my-kind').
    // See audio-call.mjs / resources-load.mjs for real, paste-able bodies.
    void ctx;
  },
};

export default [example];
