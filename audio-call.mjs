// audio-call — link a component script to the audio assets it plays BY NAME.
//
// Example: a component calls   playAudio('bgm_title')   in its source, and the
// project has  audio/bgm_title.mp3  (and/or .ogg). This plugin adds an edge
//   <that script>  ->  audio/bgm_title.*
// so the audio shows up as "used" and the call site appears in the usage popup.
//
// The string is matched against an audio asset's basename (without extension),
// so .mp3 / .ogg both resolve, and a path-ish arg ('audio/bgm_title') uses its
// last segment.
//
// Limitations (by design):
//   • Only COMPONENT scripts are visible — a plain util/manager module that is
//     not a Cocos component is pruned from the index before edges run, so a call
//     from there produces no edge.
//   • Only STRING-LITERAL args resolve; playAudio(this.bgm) / an enum can't be
//     followed by a regex.
//   • A bare name colliding across folders links to EVERY match.
//
// ── configure ────────────────────────────────────────────────────────────────
// The play-audio function name(s) used in your codebase. Add yours here.
const FUNCS = ['playAudio'];
// ─────────────────────────────────────────────────────────────────────────────

const CALL_RE = new RegExp(String.raw`\b(?:${FUNCS.join('|')})\s*\(\s*['"\`]([^'"\`]+)['"\`]`, 'g');

/** @type {import('coir').Plugin} */
const audioCall = {
  name: 'audio-call',

  async edges(ctx) {
    const { assets, addEdge, scripts } = ctx;

    // basename-without-extension -> [audio asset], built once.
    const byName = new Map();
    for (const a of assets.values()) {
      if (a.type !== 'audio') continue;
      const name = a.path.slice(a.path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(a);
    }
    if (!byName.size) return;

    for (const a of assets.values()) {
      if (a.type !== 'script') continue; // ctx.assets holds only component scripts
      const text = scripts.text.get(a.uuid);
      if (!text) continue;
      for (const m of text.matchAll(CALL_RE)) {
        const arg = m[1];
        const name = arg.slice(arg.lastIndexOf('/') + 1); // 'audio/bgm_title' -> 'bgm_title'
        for (const audio of byName.get(name) || []) {
          addEdge(a.uuid, audio.uuid, 'audio', { nodePath: null, component: null, property: `${FUNCS[0]}("${arg}")` });
        }
      }
    }
  },
};

export default audioCall;
