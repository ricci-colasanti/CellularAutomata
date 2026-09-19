/**
 * CACanvas
 * --------
 * A small helper around an HTML `<canvas>` element for drawing
 * **cellular-automata style grids**.
 *
 * The canvas is divided into a fixed number of rows (set via `ofHeight`),
 * and each "cell" is drawn as a square of `cellSize` pixels. Because
 * `cellSize` is an integer, the grid always tiles the viewport exactly,
 * with no sub-pixel gaps or borders between cells.
 *
 * Coordinate system:
 *   - `x` increases to the right  (column index)
 *   - `y` increases downward      (row index)
 *   - Both are in *grid units*, not pixels. The class multiplies by
 *     `cellSize` internally before drawing.
 *
 * Typical usage:
 *   const ca = new CACanvas(document.getElementById("c"), 60);
 *   ca.resizeAndReset();
 *   ca.drawSquareAt(3, 4, "red");
 */
export default class CACanvas {
  /**
   * @param {HTMLCanvasElement} canvas  The `<canvas>` element to draw on.
   * @param {number} [ofHeight=100]     Target number of rows to fit
   *                                    vertically. Used to derive
   *                                    `cellSize` on resize.
   */
  constructor(canvas, ofHeight = 100) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;

    /** @type {CanvasRenderingContext2D} */
    this.ctx = this.canvas.getContext("2d");

    /**
     * Size of one cell in pixels. Recomputed on every resize.
     * @type {number}
     */
    this.cellSize = 2;

    /**
     * Desired number of rows. Higher = smaller cells = more cells.
     * @type {number}
     */
    this.ofHeight = ofHeight;

    /** @type {number} Number of columns, derived from viewport width. */
    this.cols = 0;

    /** @type {number} Number of rows, derived from viewport height. */
    this.rows = 0;
  }

  /**
   * Recompute the grid to match the current canvas dimensions, then clear it.
   *
   * This adapts the grid to whatever CSS size the canvas has (e.g. 80% width,
   * responsive breakpoints), NOT the full browser window. The grid fills the
   * visible canvas area exactly with no gaps or partial cells.
   *
   * Steps:
   *   1. Read the rendered size of the canvas element (after CSS is applied).
   *   2. Compute an integer `cellSize` so `ofHeight` rows fit vertically.
   *   3. Calculate how many columns and rows fit with that cell size.
   *   4. Resize the canvas internal buffer (`.width`/`.height`) to exact
   *      pixel multiples — prevents sub-pixel rendering artifacts.
   *   5. Fill the canvas with the background colour.
   *
   * Call this:
   *   • After initialisation (once CSS layout is complete)
   *   • On window resize (since % widths change with viewport)
   *
   * @returns {void}
   */
  resizeAndReset() {
    // Step 1: Get rendered dimensions AFTER CSS has been applied.
    // clientWidth/clientHeight reflect what the user sees (includes margins,
    // padding, borders but excludes scrollbars). This respects your CSS:
    //   width: 80%, margin-left: 10%, aspect-ratio: 1 / 1, etc.
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    // Step 2: Compute an INTEGER cell size in pixels.
    // Using Math.floor ensures:
    //   • All cells are whole pixels → no blurry anti-aliased edges
    //   • Exactly `ofHeight` rows fit within the canvas height
    //   • We may leave a few unused pixels at bottom/right (intentional)
    this.cellSize = Math.floor(height / this.ofHeight);

    // Step 3: Calculate grid dimensions (number of columns and rows)
    // that fit within the available width/height using the fixed cellSize.
    this.cols = Math.floor(width / this.cellSize);
    this.rows = Math.floor(height / this.cellSize);

    // Step 4: Set the canvas INTERNAL BUFFER resolution.
    // IMPORTANT: Canvas .width/.height differ from CSS width/height!
    // - CSS size controls how big it looks on screen
    // - .width/.height control the drawing buffer (pixels available to ctx)
    // Setting them to exact cellSize multiples avoids sub-pixel gaps.
    this.canvas.width = this.cols * this.cellSize;
    this.canvas.height = this.rows * this.cellSize;

    // Step 5: Clear everything to default background.
    // This prepares a clean slate for drawing the new grid.
    this.clear("#eeeeee");
  }
  
  // Optional: Helper to attach resize listener
  listenForResize(callback) {
    window.addEventListener('resize', callback);
    // Clean up later if needed
    return () => window.removeEventListener('resize', callback);
  }


  /**
   * Fill the whole canvas with a solid colour.
   * @param {string} [backGround="#eeeeee"]  Any CSS colour string.
   */
  clear(backGround = "#eeeeee") {
    this.ctx.fillStyle = backGround;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw a single filled square at grid position (x, y).
   *
   * @param {number}  x                 Column index (grid units).
   * @param {number}  y                 Row index (grid units).
   * @param {string}  [colour="#333333"] Fill colour.
   * @param {boolean} [border=false]    If true, also stroke a light
   *                                    border around the square. Useful
   *                                    when cellSize is large enough
   *                                    that cells would otherwise blur
   *                                    together.
   */
  drawSquareAt(x, y, colour = "#333333", border = false) {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(
      x * this.cellSize,
      y * this.cellSize,
      this.cellSize,
      this.cellSize,
    );

    if (border) {
      // Light stroke so neighbouring cells stay visually distinct.
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

  /**
   * Draw a filled circle centred in grid cell (x, y).
   *
   * The circle is drawn at 1/2.2 of the cell size (slightly smaller than
   * the cell) so it visually "floats" inside its square.
   *
   * @param {number}  x                 Column index (grid units).
   * @param {number}  y                 Row index (grid units).
   * @param {string}  [colour="#333333"] Fill colour.
   * @param {boolean} [border=false]    If true, stroke a light outline.
   */
  drawCircleAt(x, y, colour = "#333333", border = false) {
    // Convert grid coords → pixel coords of the cell centre.
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
