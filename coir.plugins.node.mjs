// coir.plugins.node.mjs — NODE-only example config (CLI / MCP / Cocos editor).
//
// This file `import`s sibling plugin files, so it is NOT browser-portable: the
// browser blob-imports a config and can't resolve relative imports. That is
// exactly why it is the `.node.mjs` variant — coir's NODE hosts load it; the
// browser skips it (and loads only the self-contained `coir.plugins.mjs`). It is
// also the right home for the command plugins (anim/skel), whose `commands` /
// `assetMenus` only take effect under node anyway.
//
// Use it from your project's (or coir-root's) own coir.plugins.node.mjs, e.g.
//   export { default } from '/abs/path/to/coir-plugins/coir.plugins.node.mjs';
// or copy this file and fix the relative paths to wherever coir-plugins lives.

import audioCall from './audio-call.mjs';          // portable edge plugins — they ALSO
import i18nLabel from './i18n-label.mjs';          // work in the browser, but only via a
import resourcesLoad from './resources-load.mjs';  // self-contained coir.plugins.mjs;
import resourcesSprite from './resources-sprite.mjs'; // importing them here is node-only.
import anim from './anim.mjs';                      // node-only: commands + assetMenus
import skel from './skel.mjs';                      // node-only: commands + node:fs + vendor

// Node hosts get everything from this one file (the edge plugins too, since node
// loads this AND coir.plugins.mjs). Edit each plugin's `── configure ──` block to
// match your project, or drop the ones you don't want.
export default [audioCall, i18nLabel, resourcesLoad, resourcesSprite, anim, skel];
