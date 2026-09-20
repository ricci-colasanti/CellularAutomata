# Option A — skeleton with dummy functions

## Files

```
index.html
main.js
sim-worker.js
```

## `index.html`

```html
<canvas id="c" width="1000" height="100"></canvas>
<script src="main.js" type="module"></script>
```

## `main.js` (main thread — coordination only)

```js
const canvas = document.getElementById('c');
const offscreen = canvas.transferControlToOffscreen();

const worker = new Worker('sim-worker.js');
worker.onerror = (e) => console.error('[sim-worker]', e.message, e);

// one-shot request helper (only one in flight at a time by design)
function request(msg, transfer = []) {
  return new Promise((resolve) => {
    const handler = (e) => {
      worker.removeEventListener('message', handler);
      resolve(e.data);
    };
    worker.addEventListener('message', handler);
    worker.postMessage(msg, transfer);
  });
}

async function boot() {
  // init: hand over the canvas + dims, wait for GL to be ready
  await request(
    { type: 'init', canvas: offscreen, w: canvas.width, h: canvas.height },
    [offscreen]
  );

  // main loop: one tick in flight at a time, paced by rAF
  let running = true;
  let inFlight = false;

  function frame() {
    if (!running) return;

    if (!inFlight) {
      inFlight = true;
      worker.postMessage({ type: 'tick' });
    }

    requestAnimationFrame(frame);
  }

  worker.addEventListener('message', (e) => {
    if (e.data.type === 'ticked') {
      inFlight = false;   // next rAF may send another tick
    }
  });

  requestAnimationFrame(frame);

  // resize handling
  window.addEventListener('resize', () => {
    // whatever sizing policy you want — here: match the element
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    worker.postMessage({ type: 'resize', w, h });
  });
}

boot();
```

Notes:
- `request()` is only used for `init` here. The steady-state loop uses the raw `inFlight` flag + listener, because `request()` would attach/detach a listener 60×/sec.
- One tick in flight at a time. If a step overruns a frame, `inFlight` stays true and the next rAF just skips — that's the natural drop.

## `sim-worker.js` (owns grid + WebGL)

```js
// ---- state (module-level, survives across messages) ----
let canvas, gl;
let w, h, cellCount;

let grid;      // Uint8Array(w*h) — current generation
let scratch;   // Uint8Array(w*h) — next generation

// GL objects — created once in initGL, reused every frame
let program, vao, vbo, texture;
let uGridLoc;

// ---- message dispatch ----
self.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === 'init') {
    canvas = msg.canvas;
    w = msg.w; h = msg.h; cellCount = w * h;

    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    grid    = new Uint8Array(cellCount);
    scratch = new Uint8Array(cellCount);
    seedGrid(grid);

    initGL();                   // one time only
    postMessage({ type: 'ready' });
    return;
  }

  if (msg.type === 'tick') {
    gol_iterate(grid, scratch); // compute next gen into scratch
    [grid, scratch] = [scratch, grid]; // swap

    draw(grid);                 // render the same buffer we just computed

    postMessage({ type: 'ticked' });
    return;
  }

  if (msg.type === 'resize') {
    resize(msg.w, msg.h);
    return;
  }
};

// ---- one-time GL setup ----
function initGL() {
  // compile vertex + fragment shader, link program, useProgram
  // create VAO + fullscreen quad VBO
  // create R8 texture of size w×h, NEAREST filtering
  // cache uniform locations (uGridLoc = ...)
  // gl.viewport(0, 0, w, h)
  // DUMMY
}

// ---- per-frame draw ----
function draw(currentGrid) {
  // gl.bindTexture + gl.texSubImage2D(..., currentGrid)
  // gl.useProgram(program); gl.bindVertexArray(vao);
  // gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // DUMMY
}

// ---- resize ----
function resize(nw, nh) {
  w = nw; h = nh; cellCount = w * h;
  canvas.width = w; canvas.height = h;
  gl.viewport(0, 0, w, h);

  // reallocate grid buffers (or reallocate texture — your call)
  grid    = new Uint8Array(cellCount);
  scratch = new Uint8Array(cellCount);

  // recreate R8 texture at new size; do NOT recompile shaders
  // DUMMY
}

// ---- simulation ----
function gol_iterate(cur, next) {
  // interior fast path with flat index math:
  //   i-1, i+1, i-W, i+W, i-W-1, i-W+1, i+W-1, i+W+1
  // edges handled separately
  // write 0/1 into next
  // DUMMY
}

// ---- seed ----
function seedGrid(g) {
  // random or glider gun or whatever
  // DUMMY
}
```

## Message flow

```
main → worker   { type:'init', canvas, w, h }        [transfer offscreen]
worker → main   { type:'ready' }

loop:
  main → worker { type:'tick' }
  worker: gol_iterate(grid, scratch); swap; draw(grid)
  worker → main { type:'ticked' }

main → worker   { type:'resize', w, h }   (on window resize)
```

## Why this is "in step" by construction

- There is exactly one thread touching `grid` and `gl`.
- `gol_iterate` completes fully before `draw` is called, on the same buffer.
- `draw` finishes queuing before the worker posts `ticked`.
- The main thread won't send the next `tick` until it sees `ticked`, so nothing overlaps.
- There is no path by which the screen shows generation N+1 while generation N is still being computed, or vice versa.

## What you fill in later (no structural change)

- `initGL`: shader source, quad geometry, texture setup
- `draw`: the actual `texSubImage2D` + `drawArrays`
- `gol_iterate`: the tight kernel with interior fast path
- `resize`: texture reallocation at the new size
- `seedGrid`: your initial pattern

Everything else — the message plumbing, the in-flight flag, the swap — stays exactly as written.


# You can absolutely refactor it

The "one worker file" constraint is about *which thread it runs on*, not about how many source files you write. A worker can `import` other modules just like any other JS.

## Two ways to split it

### 1. ES modules in the worker (`type: 'module'`)

```js
// main.js
const worker = new Worker('sim-worker.js', { type: 'module' });
```

```js
// sim-worker.js
import { initGL, draw, resize } from './gl.js';
import { gol_iterate, seedGrid }      from './gol.js';

// ...the message dispatch / state / swap logic stays here...
```

- Clean, standard, supported in every modern browser.
- The worker file stays the "orchestrator"; the heavy logic lives in imported modules.
- Note: `type: 'module'` workers can't be created from a `file://` URL in some browsers — you'll need to serve over HTTP. If you're already running a dev server, non-issue.

### 2. Classic worker + `importScripts` (no `type: 'module'`)

```js
// sim-worker.js
importScripts('gl.js', 'gol.js');
```

- Works with plain `<script>`-style workers, no module flag.
- `gl.js` and `gol.js` must attach their exports to `self` (or just declare top-level functions/globals — same effect).
- Older, uglier, but compatible with everything.

Use `type: 'module'`. It's 2024.

## Suggested file split

```
main.js              // coordinator, rAF loop, resize
sim-worker.js        // message dispatch, state, swap — the orchestrator

sim/
  gol.js             // gol_iterate, seedGrid — pure, no DOM, no GL
  gl.js              // initGL, draw, resize — GL objects + shaders
  shaders.js         // vertex/fragment source strings (optional)
```

Rules of thumb:
- **`gol.js` should not import anything from `gl.js`** and vice versa. Keeps them testable in isolation — you can run `gol_iterate` in Node with a fake `Uint8Array`.
- **`gl.js` receives the grid buffer as an argument** to `draw()`. It doesn't know where it came from.
- **`sim-worker.js` holds the only mutable state** (`grid`, `scratch`, `w`, `h`) and wires the two modules together. It's the only file that knows both gol and GL exist.

## What the split looks like

```js
// sim/gol.js
export function gol_iterate(cur, next, w, h) { /* ... */ }
export function seedGrid(grid, w, h)         { /* ... */ }
```

```js
// sim/gl.js
let gl, program, vao, vbo, texture, uGridLoc;

export function initGL(canvas, w, h) { /* ... */ }
export function draw(grid, w, h)     { /* ... */ }
export function resizeGL(w, h)       { /* ... */ }
```

```js
// sim-worker.js
import { initGL, draw, resizeGL } from './sim/gl.js';
import { gol_iterate, seedGrid }  from './sim/gol.js';

let w, h, grid, scratch;

self.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === 'init') {
    w = msg.w; h = msg.h;
    grid    = new Uint8Array(w * h);
    scratch = new Uint8Array(w * h);
    seedGrid(grid, w, h);

    initGL(msg.canvas, w, h);
    postMessage({ type: 'ready' });
  }

  if (msg.type === 'tick') {
    gol_iterate(grid, scratch, w, h);
    [grid, scratch] = [scratch, grid];
    draw(grid, w, h);
    postMessage({ type: 'ticked' });
  }

  if (msg.type === 'resize') {
    w = msg.w; h = msg.h;
    grid    = new Uint8Array(w * h);
    scratch = new Uint8Array(w * h);
    resizeGL(w, h);
  }
};
```

That's the whole worker — barely 30 lines of orchestration. Everything else is in `gol.js` / `gl.js`.

## Things to watch

- **State placement.** GL state (context, program, buffers) belongs inside `gl.js` as module-level `let`s. Grid state belongs in `sim-worker.js`. Don't let `gl.js` reach into the worker's `grid` — pass it in.
- **No DOM in any of these.** `gl.js` gets an `OffscreenCanvas`, not a `<canvas>`. If you accidentally reference `document` you'll get a silent failure (worker errors don't surface by default — keep `worker.onerror` wired up).
- **`self` in a module worker.** You still use `self.onmessage` / `self.postMessage`. `type: 'module'` doesn't change that.
- **Bundlers.** If you're using Vite/esbuild/webpack, `new Worker('...', {type:'module'})` usually "just works" but check your tool's worker syntax (`new Worker(new URL('./sim-worker.js', import.meta.url), {type:'module'})` is the Vite-safe form).
- **Shared shader source strings** can live in `shaders.js` and be imported by `gl.js` only — keeps `gol.js` free of GL-adjacent stuff.

## Bottom line

Refactor freely. Keep `sim-worker.js` as a thin orchestrator, push gol logic into one module and GL logic into another. The "one worker" decision was about *threading*, not about *file count* — you can have as many files as you want inside that thread.