export class Cell {

  static now = 0;
  static next = 1;

  static update(){
    [Cell.now,Cell.next] = [Cell.next, Cell.now];
  }

  constructor(ypos, xpos) {
    this.xpos = xpos;
    this.ypos = ypos;
    this.occupant = ["",""];
    this.neighbours = [];
  }

  addNeighbour(cell) {
    this.neighbours.push(cell);
  }
  
  getOccupant() {
    return this.occupant[Cell.now];
  }

  getOccupantNext() {
    return this.occupant[Cell.next];
  }

  setOccupant(occupant) {
    this.occupant[Cell.next] = occupant;
  }

  setOccupantNow(occupant) {
    this.occupant[Cell.now] = occupant;
  }

  iterate(){
    this.occupant[Cell.next]=this.occupant[Cell.now]
  }
}

export class Grid {
  constructor(cols, rows) {
    console.log(cols,rows);
    this.cols = cols;
    this.rows = rows;
    this.cells = [];

    this.init();
    
  }

  xBounds(x) {
    return (x + this.cols) % this.cols;
  }

  yBounds(y) {
    return (y + this.rows) % this.rows;
  }

  init() {
    for (let y = 0; y < this.rows; y++) {
      this.cells[y] = [];
      for (let x = 0; x < this.cols; x++) {
        // The third argument is ignored by Cell's constructor, but
        // harmless — kept as-is to match the original code.
        this.cells[y][x] = null;
      }
    }
  }

  setNeighbours() {
    console.log(this.rows)
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        for (let yy = y - 1; yy <= y + 1; yy++) {
          let yyy = this.yBounds(yy);
          for (let xx = x - 1; xx <= x + 1; xx++) {
            let xxx = this.xBounds(xx);

            // Skip the cell itself.
            if (yyy === y && xxx === x) {
              continue;
            }

            this.cells[y][x].addNeighbour(this.cells[yyy][xxx]);
          }
        }
      }
    }
  }

  getCell(y, x) {
    return this.cells[y][x];
  }
}
