
  /**
   * Tests if a rectangle intersects with another.
   *  x0y0 --------       x2y2 --------
   *      |       |           |       |
   *      -------- x1y1       -------- x3y3
   */
  function intersectRect(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    return !(x2 > x1 || x3 < x0 || y2 > y1 || y3 < y0);
  };


  export {
      intersectRect
  }