import { CACanvas } from "../../js/ca-canvas.js";
import { Grid, Cell } from "../../js/cellular-automata.js";

class GoL extends Cell {
  constructor(ypos, xpos) {
    super(ypos, xpos);
  }

  iterate() {
    let live = 0;
    const len = this.neighbours.length;
    for (let i = 0; i < len; i++) {
      live += this.neighbours[i].getOccupant();
    }

    const current = this.getOccupant();
    let next = 0;

    if (current === 1 && (live === 2 || live === 3)) {
      next = 1;
    } else if (current !== 1 && live === 3) {
      next = 1;
    }
    this.setOccupant(next);
  }
}

const R_PENTO = [
  [1, 0],  [2, 0],
  [0, -1], [1, -1],
  [1, -2],
];

const STEP_INTERVAL = 0.01;


let accumulator = 0;
let caCanvas = null;
let gridInstance = null;
let lastTime = 0;
let animationId = null;

function loop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  accumulator += dt;

  if (accumulator >= STEP_INTERVAL) {
    accumulator -= STEP_INTERVAL;

    for (let y = 0; y < gridInstance.rows; y++) {
      for (let x = 0; x < gridInstance.cols; x++) {
        gridInstance.getCell(y, x).iterate();
      }
    }
    Cell.update();
    drawGrid();
  }

  animationId = self.requestAnimationFrame(loop);
}

function drawGrid() {
  caCanvas.clear();
  caCanvas.setColour("#000000");
  const yMax = caCanvas.rows;
  const xMax = caCanvas.cols;
  for (let y = 0; y < yMax; y++) {
    for (let x = 0; x < xMax; x++) {
      const cell = gridInstance.cells[y][x];
      if (cell.getOccupant() === 1) {
        caCanvas.quickDrawSquareAt(x, y);
      }
    }
  }
}

function buildGrid() {
  const rows = caCanvas.rows;
  const cols = caCanvas.cols;

  gridInstance = new Grid(cols, rows);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const newCell = new GoL(y, x);
      gridInstance.cells[y][x] = newCell;
      newCell.setOccupantNow(0);
    }
  }
  gridInstance.setNeighbours();

  // Seed R-pentomino near the centre.
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);

  for (const [dx, dy] of R_PENTO) {
    const x = cx + dx;
    const y = cy + dy;
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      gridInstance.getCell(y, x).setOccupantNow(1);
    }
  }
}

/**
 * Resize the drawing buffer to the requested display size, then rebuild
 * the grid to match. Posts the actual (possibly smaller) buffer size back
 * to the main thread so CSS can be matched to it.
 */
function resizeTo(width, height) {
  caCanvas.resize(width, height);
  buildGrid();
  drawGrid();

  self.postMessage({
    type: "sizeChanged",
    width: caCanvas.canvas.width,
    height: caCanvas.canvas.height,
  });
}

function init(e) {
  const offscreen = e.data.canvas;
  const desiredW = e.data.desiredWidth;
  const desiredH = e.data.desiredHeight;
  const yCells = e.data.yCells;

  caCanvas = new CACanvas(offscreen, yCells, desiredW, desiredH);
  buildGrid();
  drawGrid();

  self.postMessage({
    type: "sizeChanged",
    width: caCanvas.canvas.width,
    height: caCanvas.canvas.height,
  });
}

onmessage = function (e) {
  switch (e.data.type) {
    case "initCanvas":
      init(e);
      break;

    case "resize":
      if (caCanvas) resizeTo(e.data.width, e.data.height);
      break;

    case "start":
      if (animationId === null) {
        lastTime = 0;
        animationId = self.requestAnimationFrame(loop);
      }
      break;
  }
};