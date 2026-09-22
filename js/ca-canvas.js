/**
 * CACanvas
 * --------
 * A small helper around an HTML `<canvas>` element for drawing
 * cellular-automata style grids.
 *
 * Coordinate system:
 *   - `x` increases to the right  (column index)
 *   - `y` increases downward      (row index)
 *   - Both are in *grid units*, not pixels.
 */
export class CACanvas {
  /**
   * @param {HTMLCanvasElement|OffscreenCanvas} canvas
   * @param {number} [ofHeight=100]  Target rows to fit vertically.
   * @param {number} [width]         Desired display width in pixels.
   *                                 Defaults to canvas.width.
   * @param {number} [height]        Desired display height in pixels.
   *                                 Defaults to canvas.height.
   */
  constructor(canvas, ofHeight = 100, width, height) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    this.ofHeight = ofHeight;

    this.cellSize = 2;
    this.cols = 0;
    this.rows = 0;

    this.resize(width, height);
  }

  /**
   * Recompute grid dims to fit the given display size, then clear.
   * The canvas *buffer* is resized to exactly cols*cellSize × rows*cellSize
   * so cells are whole pixels and there are no sub-pixel artifacts.
   *
   * @param {number} [width]   Desired width in pixels.
   * @param {number} [height]  Desired height in pixels.
   */
  resize(width, height) {
    const w = width  ?? this.canvas.width;
    const h = height ?? this.canvas.height;

    // Integer cell size so cells are whole pixels. Guard against 0.
    this.cellSize = Math.max(1, Math.floor(h / this.ofHeight));

    this.cols = Math.max(1, Math.floor(w / this.cellSize));
    this.rows = Math.max(1, Math.floor(h / this.cellSize));

    // Resize the drawing buffer to exact cell multiples.
    this.canvas.width  = this.cols * this.cellSize;
    this.canvas.height = this.rows * this.cellSize;

    this.clear("#eeeeee");
  }

  /** Alias kept for API compatibility. */
  resizeAndReset() {
    this.resize();
  }

  setColour(colour) {
    this.ctx.fillStyle = colour;
  }

  clear(backGround = "#eeeeee") {
    this.ctx.fillStyle = backGround;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawSquareAt(x, y, colour = "#333333", border = false) {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(
      x * this.cellSize,
      y * this.cellSize,
      this.cellSize,
      this.cellSize,
    );

    if (border) {
      this.ctx.strokeStyle = "#eeeeee";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        x * this.cellSize,
        y * this.cellSize,
        this.cellSize,
        this.cellSize,
      );
    }
  }

  quickDrawSquareAt(x, y) {
    this.ctx.fillRect(
      x * this.cellSize,
      y * this.cellSize,
      this.cellSize,
      this.cellSize,
    );
  }

  drawCircleAt(x, y, colour = "#333333", border = false) {
    const centerX = x * this.cellSize + this.cellSize / 2;
    const centerY = y * this.cellSize + this.cellSize / 2;
    const radius = this.cellSize / 2.2;

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = colour;
    this.ctx.fill();

    if (border) {
      this.ctx.strokeStyle = "#eeeeee";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }
}