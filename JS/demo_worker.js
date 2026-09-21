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