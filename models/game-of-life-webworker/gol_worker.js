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
      live += this.neighbours[i].getOccupant()
    }
    
    // apply Conway's rules
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
  [1, 0],  [2, 0],   // was top row
  [0, -1], [1, -1],  // was middle row
  [1, -2]            // was bottom row
];
const yMax = 161;

var STEP_INTERVAL = 0.025;   // seconds between simulation steps (≈6.6 Hz)
var accumulator = 0;


var caCanvas = null;
var gridInstance = null;

var canvas = null;


var lastTime = 0;
var animationId = null;

function loop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  var dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  accumulator += dt;

  // Advance the simulation only when enough time has built up.
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
  caCanvas.setColour('#000000')
  const yMax = caCanvas.rows;
  const xMax = caCanvas.cols;
  for (let y = 0; y < yMax; y++) {
    for (let x = 0; x < xMax; x++) {
      const cell = gridInstance.cells[y][x];
      if (cell.getOccupant() == 1) {
        caCanvas.quickDrawSquareAt(x, y);
      }
    }
  }
}

function init(e) {
  canvas = e.data.canvas;
  console.log(canvas.width, canvas.height);
  caCanvas = new CACanvas(canvas, yMax);
  console.log(caCanvas.cols, caCanvas.rows);

  gridInstance = new Grid(caCanvas.cols, caCanvas.rows);
  const rows = gridInstance.rows
  const cols = gridInstance.cols;
  console.log("*",rows,cols)
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const newCell = new GoL(y, x);
      gridInstance.cells[y][x] = newCell;
      newCell.setOccupantNow(0);
    }
  }
gridInstance.setNeighbours();
  // // 6. seed R‑pentomino in the centre
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);

  for (let [dx, dy] of R_PENTO) {
    const x = cx + dx;
    const y = cy + dy;
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      gridInstance.getCell(y, x).setOccupantNow(1);
    }
  }
  drawGrid();
}


onmessage = function (e) {
  switch (e.data.type) {
    case "initCanvas":
      init(e);
      break;

    case "start":
      console.log("start");
      if (animationId === null) {
        lastTime = 0;
        animationId = self.requestAnimationFrame(loop);
      }
      break;
  }
};