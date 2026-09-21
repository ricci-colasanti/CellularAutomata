Here's the updated walkthrough, reflecting everything we ended up with: `requestAnimationFrame`, `deltaTime`, split lifecycle messages, and start/stop buttons.

---

# Web Worker + OffscreenCanvas — Walkthrough

## 🎯 The Big Picture

We have a **three-file system** that demonstrates:

1. A **Web Worker** running an animation + counter loop off the main thread.
2. An **`OffscreenCanvas`** transferred to the worker so it can draw directly.
3. A **class in a separate file** (`Ball`) loaded via `importScripts()`.
4. **Two-way messaging** between the main page and the worker.
5. **Explicit lifecycle control** — `start` / `stop` as first-class commands.

The whole thing renders a bouncing red ball and a rising counter, while the main page stays responsive. Let's trace each piece.

---

## 📁 File 1: `ball.js` — The Class

```js
class Ball {
  constructor(x, y, dx, dy, radius) { ... }
  update(W, H, dt) { ... }
  draw(ctx) { ... }
}
```

**What it does:**

- **`constructor`** stores the ball's position (`x`, `y`), velocity (`dx`, `dy`), and size (`radius`). Velocity is in **pixels per second**, not pixels per frame.
- **`update(W, H, dt)`** moves the ball by `velocity * dt` (where `dt` is the seconds elapsed since the last frame), then checks if it hit any wall. If `x - radius < 0` or `x + radius > W`, it flips `dx`. Same for `dy` and the top/bottom. This is the entire physics engine — just reflection, scaled by time.
- **`draw(ctx)`** renders the ball as a circle on whatever 2D context you hand it.

**Why a class?** It bundles the ball's *state* and *behavior* together. The worker doesn't need to know how bouncing works — it just calls `ball.update()` and `ball.draw()`. If you wanted 20 balls, you'd create 20 instances and loop over them. That's the abstraction payoff.

**Why a separate file?** Reusability and separation of concerns. The `Ball` class has no idea it's in a worker, or that a canvas exists — it just responds to `update()` and `draw()` calls. You could use the exact same file on the main thread, in another worker, or in a Node canvas library (with a compatible context).

**Why `dt`?** Because with `requestAnimationFrame`, frames don't arrive at a fixed interval — they arrive at whatever rate the display refreshes. Multiplying velocity by `dt` makes motion **frame-rate independent**: the ball travels the same distance per second at 60Hz, 120Hz, or 144Hz.

---

## 📁 File 2: `demo_worker.js` — The Worker

```js
importScripts("ball.js");

var i = 0;
var step = 1;

var canvas = null;
var ctx = null;
var W = 0, H = 0;
var ball = null;

var lastTime = 0;
var animationId = null;

function loop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  var dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  i += step;
  postMessage({ type: "count", value: i });

  if (ctx) {
    ctx.clearRect(0, 0, W, H);
    ball.update(W, H, dt);
    ball.draw(ctx);
  }

  animationId = self.requestAnimationFrame(loop);
}

onmessage = function (e) {
  switch (e.data.type) {
    case "initCanvas":
      canvas = e.data.canvas;
      ctx = canvas.getContext("2d");
      W = canvas.width;
      H = canvas.height;
      ball = new Ball(W / 2, H / 2, 180, 120, 15);
      break;

    case "start":
      if (animationId === null) {
        lastTime = 0;
        animationId = self.requestAnimationFrame(loop);
      }
      break;

    case "stop":
      if (animationId !== null) {
        self.cancelAnimationFrame(animationId);
        animationId = null;
      }
      break;

    case "setStep":
      step = e.data.value;
      break;

    case "getStep":
      postMessage({ type: "step", value: step });
      break;

    case "incStep":
      step++;
      postMessage({ type: "step", value: step });
      break;
  }
};
```

Let's go line by line, because *everything here is deliberate*.

### `importScripts("ball.js")`

This is the bridge to File 1. `importScripts` is a **synchronous** function that:

- Fetches `ball.js` relative to the worker's own URL.
- Executes it **in the worker's global scope**.
- Makes `Ball` available as if you'd typed the class right here.

It **must** be called at the top level (not inside a function), and it must run *before* you try to use `Ball`. That's why it's the very first line.

> **Why not ES modules?** Because we created the worker with `new Worker("demo_worker.js")` — a **classic** worker. Classic workers use `importScripts`. ES module `import` only works in workers created with `{ type: "module" }`. For this exercise, classic + `importScripts` is the simplest possible path.

### The module-level state

```js
var i = 0, step = 1;
var canvas = null, ctx = null;
var W = 0, H = 0;
var ball = null;
var lastTime = 0;
var animationId = null;
```

This is the worker's **private memory**. The main thread cannot see or touch any of these directly. They live and die inside the worker's own thread. That isolation is the whole point of a worker — no shared mutable state, no race conditions, no locking.

Two of these exist purely for the animation loop:

- **`lastTime`** — the timestamp of the previous frame, used to compute `dt`.
- **`animationId`** — the handle returned by `requestAnimationFrame`, used to cancel the loop on `stop`.

### `loop(timestamp)` — The Animation Loop

```js
function loop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  var dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  i += step;
  postMessage({ type: "count", value: i });

  if (ctx) {
    ctx.clearRect(0, 0, W, H);
    ball.update(W, H, dt);
    ball.draw(ctx);
  }

  animationId = self.requestAnimationFrame(loop);
}
```

Each frame does four things:

1. **Compute `dt`.** The browser passes a high-resolution `timestamp` into every rAF callback. Subtracting the previous timestamp gives the elapsed time in milliseconds; dividing by 1000 converts to seconds. On the very first frame, `lastTime` is 0, so we seed it — this gives `dt = 0` for frame one and avoids a giant jump.

2. **Update the counter** and send it to the main thread via `postMessage`. The message is a tagged object `{ type: "count", value: i }` so the main thread can tell it apart from other message types.

3. **Draw a frame** — but only if the canvas has been initialized (`if (ctx)`). The guard protects against drawing before `initCanvas` has been received.
   - `clearRect` wipes the previous frame.
   - `ball.update(W, H, dt)` moves the ball and handles wall bouncing.
   - `ball.draw(ctx)` paints the new position.

4. **Schedule the next frame** with `self.requestAnimationFrame(loop)` and store the handle in `animationId` so `stop` can cancel it.

> **Why `self.requestAnimationFrame` and not just `requestAnimationFrame`?** Inside a worker there is no `window` — the global object is `self`. rAF *is* available in dedicated workers whose owner is a `Window`, but it must be reached via `self`.

> **Why doesn't the loop restart itself on the first line?** It does — the `requestAnimationFrame(loop)` call at the *end* is what schedules the next frame. rAF is one-shot: you re-arm it every frame.

### `onmessage` — The Command Dispatcher

```js
onmessage = function (e) {
  switch (e.data.type) { ... }
};
```

`onmessage` is the worker's **receive port**. Every time the main thread calls `worker.postMessage(...)`, this function runs in the worker with `e.data` set to the payload. The `switch` on `e.data.type` is the standard **tagged-message pattern** — it lets one handler deal with many kinds of messages cleanly.

Six commands, in two groups:

**Lifecycle:**

- **`"initCanvas"`** — stores the transferred `OffscreenCanvas`, gets a 2D context from it, records the dimensions, and creates the `Ball` in the middle of the canvas with velocity `(180, 120)` px/sec. It does **not** start the loop. Setup and activation are separate concerns.
- **`"start"`** — kicks off the rAF loop. Guarded by `if (animationId === null)` so double-clicking "start" doesn't spawn two loops. Resets `lastTime` to 0 so the first frame gets `dt = 0`.
- **`"stop"`** — cancels the pending frame with `cancelAnimationFrame` and clears `animationId`. Guarded by `if (animationId !== null)` so double-clicking "stop" is harmless.

**State:**

- **`"setStep"`** — the main page tells the worker "change the increment amount to this." The worker stores it in `step`, and the next loop tick uses it.
- **`"getStep"`** — the main page asks "what's the current step?" The worker replies with `postMessage({ type: "step", value: step })`.
- **`"incStep"`** — the worker increments its own `step` and reports the new value back. The main page never mutates the worker's state directly — it *asks*.

> **Why split `initCanvas` and `start`?** Because they're different concerns. Setup is configuration; activation is lifecycle. Once they're separate, adding `stop`, `pause`, `resume`, or a future `restart` all slot in naturally as siblings. It also makes the main thread the unambiguous authority on when the worker runs.

> **Is there a race between `initCanvas` and `start`?** No. `postMessage` is **strictly ordered** — messages are delivered in the exact order they were sent. If the main page sends `initCanvas` then `start`, the worker finishes handling `initCanvas` before `start` runs. That's a spec guarantee, not a happy accident.

---

## 📁 File 3: `index.html` — The Main Page

Ignoring the HTML chrome, the script does this:

### Setup

```js
const canvas = document.getElementById("testCanvas");
canvas.width = 400;
canvas.height = 300;

const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker("demo_worker.js");

worker.postMessage({ type: "initCanvas", canvas: offscreen }, [offscreen]);
worker.postMessage({ type: "start" });
```

This is the **canvas handoff ritual**, and the order matters:

1. **Set the canvas dimensions before transferring.** Once transferred, the main thread can't resize it — the worker owns it. Set `width`/`height` first.
2. **`transferControlToOffscreen()`** creates an `OffscreenCanvas` bound to this DOM element. From this moment, the main thread can no longer draw on `#testCanvas` — only the worker can, through the offscreen handle.
3. **Create the worker.**
4. **Send the offscreen canvas as a *transferable*.** The second argument `[offscreen]` is the transfer list. This is what makes it work:
   - Normal `postMessage` **copies** data (structured clone).
   - A transferable is **moved**, not copied. The main thread's `offscreen` variable becomes a detached husk — it can't be used again. The worker gets the real, live object.
   - This is why you must pass `offscreen` in the transfer array; without it, the send throws because `OffscreenCanvas` isn't cloneable.
5. **Send `start`.** Because messages are ordered, the worker will have finished `initCanvas` before `start` runs. The loop begins.

### Receiving

```js
worker.onmessage = function (e) {
  switch (e.data.type) {
    case "count": output.innerHTML = e.data.value; break;
    case "step":  step = e.data.value;             break;
  }
};
```

This mirrors the worker's `onmessage`. Every `postMessage` from the worker lands here. The `switch` on `e.data.type` is the same tagging convention used in the other direction.

- `"count"` updates the page's `<output>` with the current counter.
- `"step"` updates the main page's local mirror of the step value.

### Sending — the buttons

```js
function startWorker() { worker.postMessage({ type: "start" }); }
function stopWorker()  { worker.postMessage({ type: "stop" }); }
function incStep()     { worker.postMessage({ type: "incStep" }); }
```

Each button sends exactly one command. The main page never mutates the worker's state directly — it *asks*. The worker owns its own state, applies the change, and (where relevant) reports back.

Three buttons on the page:

```html
<button onclick="startWorker()">start</button>
<button onclick="stopWorker()">stop</button>
<button onclick="incStep()">inc step</button>
```

---

## 🔄 The Full Round Trip

Here's the flow of one complete interaction:

```
Main thread                          Worker thread
-----------                          -------------
canvas.transferControlToOffscreen()
  │
  └── postMessage({initCanvas}, [offscreen])
                                     │
                                     ├─ ctx = canvas.getContext("2d")
                                     └─ ball = new Ball(...)
  ┌── postMessage({start}) ──────────►
                                     │
                                     └─ animationId = rAF(loop)
                                          │
                                          ├─ dt = (t - lastTime) / 1000
                                          ├─ i += step
                                          ├─ postMessage({count, i}) ──┐
                                          ├─ clearRect                  │
                                          ├─ ball.update(W, H, dt)      │
                                          ├─ ball.draw(ctx)             │
                                          └─ animationId = rAF(loop) ─┐ │
                                                                      │ │
                          ┌───────────────────────────────────────────┘ │
                          │                                             │
  output.innerHTML = i  ◄─┘  (via worker.onmessage)                    │
                          │                                             │
  [user clicks start]     │                                             │
  worker.postMessage({start}) ──► onmessage ──► rAF(loop)              │
                          │                                             │
  [user clicks stop]      │                                             │
  worker.postMessage({stop}) ──► onmessage ──► cancelAnimationFrame    │
                          │                                             │
  [user clicks incStep]   │                                             │
  worker.postMessage({incStep}) ──► onmessage ──► step++               │
                                     └─ postMessage({step, value}) ──┐  │
                                                                     │  │
  step = value (local mirror) ◄─────────────────────────────────────┘  │
                                                                        │
  ...next rAF frame ◄───────────────────────────────────────────────────┘
```

The main thread and worker never share memory. They only exchange **immutable message objects**. That's the defining constraint (and safety property) of Web Workers.

---

## 🧩 Concepts You've Now Touched

| Concept | Where it shows up |
|---|---|
| Worker isolation | Separate global scope, no shared vars |
| Classic worker + `importScripts` | `demo_worker.js` line 1 |
| `OffscreenCanvas` transfer | `transferControlToOffscreen()` + transfer list |
| Transferable objects | `[offscreen]` second arg to `postMessage` |
| Tagged messages | `{ type: "...", value: ... }` everywhere |
| Two-way messaging | `worker.onmessage` and `onmessage` |
| Message ordering guarantee | `initCanvas` then `start` |
| `requestAnimationFrame` in a worker | `self.requestAnimationFrame(loop)` |
| Frame-rate independent motion | `velocity * dt` in `Ball.update` |
| Loop lifecycle control | `animationId` + `cancelAnimationFrame` |
| Class abstraction | `Ball` in its own file |
| Main-thread as command authority | Buttons send, worker applies |

---

## ⚠️ Remaining Simplifications (By Design)

We've now handled the big ones — rAF, `deltaTime`, and teardown. What's still deliberately minimal:

1. **No error handling.** No `worker.onerror`, no try/catch around `getContext("2d")`. If the canvas fails to initialize or the worker throws, the page fails silently. Adding a `worker.onerror` handler that logs to the console is a one-liner and worth doing in real code.

2. **No reset.** Stopping and starting resumes where the ball and counter left off. If you wanted a full reset, add a `"reset"` message that sets `i = 0` and re-centers the ball.

3. **Single ball, single canvas.** The `Ball` class makes multiple balls trivial (`balls = [new Ball(...), new Ball(...)]` and a loop), but the worker only tracks one.

4. **No worker termination.** If you wanted to fully release the worker's thread, call `worker.terminate()` from the main page. The rAF loop will be cancelled automatically since the thread is gone.

5. **`var` still in the worker.** Works fine; `let`/`const` would be idiomatic in modern code. We left `var` to keep the diff from the original minimal.

These are all natural next steps. The foundation is complete — the messaging model, the canvas handoff, the lifecycle, and the animation loop are all in place.

---

## 🎓 The Takeaway

What you've built is a minimal but complete example of the **modern worker + canvas pattern**:

- The **main thread** owns the DOM, receives messages, and sends commands. It never blocks.
- The **worker** owns the loop, the canvas, and the ball. It runs at its own pace, unaffected by page jank.
- **Data crosses the boundary as cloned messages**, except for the canvas, which is *transferred*.
- **Setup and lifecycle are separate concerns**, so `start` / `stop` slot in alongside `initCanvas` without special-casing.
- **Animation is driven by `requestAnimationFrame` + `deltaTime`**, so motion is smooth and frame-rate independent, and the loop pauses automatically when the tab is hidden.
- **Classes in separate files** keep the worker's own code short and the behavior reusable.

That's the whole architecture. Everything else — multiple balls, physics, collision, input handling, `pause`/`resume`, saving state to `localStorage` — slots cleanly on top of this foundation without changing the messaging model.