export class Ball {
  constructor(x, y, dx, dy, radius) {
    this.x = x;
    this.y = y;
    this.dx = dx;        // pixels per second
    this.dy = dy;
    this.radius = radius;
  }

  update(W, H, dt) {
    this.x += this.dx * dt;
    this.y += this.dy * dt;

    if (this.x - this.radius < 0 || this.x + this.radius > W) this.dx *= -1;
    if (this.y - this.radius < 0 || this.y + this.radius > H) this.dy *= -1;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();
  }
}