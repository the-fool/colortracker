import { Rect, TrackEvent, ColorFn } from './models';
import * as math from './math';

class Tracker {
  private colors: { [color: string]: ColorFn } = {};
  private neighbors = {};
  private neighborsI = [];
  private neighborsJ = [];
  private videoNode: HTMLVideoElement;
  minGroupSize = 30;
  minMagnitude = 20;
  maxMagnitude = Infinity;

  constructor() {
    this.videoNode = document.getElementById('tracker') as HTMLVideoElement;
    Tracker.initUserMedia();
  }

  public registerColor(name: string, fn: ColorFn) {
    this.colors[name] = fn;
  }

  private static initUserMedia() {

  }

  private doTrack(element) {
    /**
     * Tracks a video element based on the specified `tracker` instance. This
     * method extract the pixel information of the input element to pass to the
     * `tracker` instance. The `tracker.track(pixels, width, height)` will be in
     * a `requestAnimationFrame` loop in order to track all video frames.
     * @private
     */
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    var width;
    var height;


    // FIXME here the video display size of the analysed size
    var resizeCanvas_ = function () {
      width = element.offsetWidth;
      height = element.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resizeCanvas_();
    element.addEventListener('resize', resizeCanvas_);


    // FIXME: do a process function - it is up to the caller to handle the frequency of detection
    // it seems all handled in the tracking.TrackerTask..
    // so in short, remove the tracking.TrackerTask from here
    // if the user want to use it, it can create it himself
    var requestId;
    var requestAnimationFrame_ = function () {
      requestId = window.requestAnimationFrame(function () {
        if (element.readyState === element.HAVE_ENOUGH_DATA) {
          try {
            // Firefox v~30.0 gets confused with the video readyState firing an
            // erroneous HAVE_ENOUGH_DATA just before HAVE_CURRENT_DATA state,
            // hence keep trying to read it until resolved.
            context.drawImage(element, 0, 0, width, height);
          } catch (err) { }
          this.trackCanvasInternal(canvas);
        }
        requestAnimationFrame_();
      });
    };

    /*
    var task = new tracking.TrackerTask(tracker);
    task.on('stop', function () {
      window.cancelAnimationFrame(requestId);
    });
    task.on('run', function () {
      requestAnimationFrame_();
    });
    return task.run();
    */
  };
  /**
   * Tracks a canvas element based on the specified `tracker` instance. This
   * method extract the pixel information of the input element to pass to the
   * `tracker` instance.
   */
  private trackCanvasInternal(element: HTMLCanvasElement) {
    var width = element.width;
    var height = element.height;
    var context = element.getContext('2d');
    var imageData = context.getImageData(0, 0, width, height);
    //this.trackColor(imageData.data, width, height);
  };

  /**
   * Calculates the central coordinate from the cloud points. The cloud points
   * are all points that matches the desired color.
   */
  private static calculateDimensions(cloud: Int32Array, total: number, color: string): TrackEvent {
    let maxx = -1;
    let maxy = -1;
    let minx = Infinity;
    let miny = Infinity;
    let x;
    let y;

    for (let c = 0; c < total; c += 2) {
      x = cloud[c];
      y = cloud[c + 1];

      if (x < minx) {
        minx = x;
      }
      if (x > maxx) {
        maxx = x;
      }
      if (y < miny) {
        miny = y;
      }
      if (y > maxy) {
        maxy = y;
      }
    }

    return {
      width: maxx - minx,
      height: maxy - miny,
      x: minx,
      y: miny,
      color
    };
  };

  /**
   * Gets the eight offset values of the neighbours surrounding a pixel.
   */
  private getNeighborsForWidth(width: number) {
    if (this.neighbors[width]) {
      return this.neighbors[width];
    }

    const neighbors = new Int32Array(8);

    neighbors[0] = -width * 4;
    neighbors[1] = -width * 4 + 4;
    neighbors[2] = 4;
    neighbors[3] = width * 4 + 4;
    neighbors[4] = width * 4;
    neighbors[5] = width * 4 - 4;
    neighbors[6] = -4;
    neighbors[7] = -width * 4 - 4;

    this.neighbors[width] = neighbors;

    return neighbors;
  };

  private trackColor(pixels, width, height, color) {
    var colorFn = this.colors[color];
    var currGroup = new Int32Array(pixels.length >> 2);
    let currGroupSize;
    let currI;
    let currJ;
    let currW;
    const marked = new Int8Array(pixels.length);
    const neighboursW = this.getNeighborsForWidth(width);
    const queue = new Int32Array(pixels.length);
    let queuePosition;
    const results = [];
    let w = -4;

    if (!colorFn) {
      return results;
    }

    for (var i = 0; i < height; i++) {
      for (var j = 0; j < width; j++) {
        w += 4;

        if (marked[w]) {
          continue;
        }

        currGroupSize = 0;

        queuePosition = -1;
        queue[++queuePosition] = w;
        queue[++queuePosition] = i;
        queue[++queuePosition] = j;

        marked[w] = 1;

        while (queuePosition >= 0) {
          currJ = queue[queuePosition--];
          currI = queue[queuePosition--];
          currW = queue[queuePosition--];

          if (colorFn(pixels[currW], pixels[currW + 1], pixels[currW + 2])) {
            currGroup[currGroupSize++] = currJ;
            currGroup[currGroupSize++] = currI;

            for (var k = 0; k < neighboursW.length; k++) {
              var otherW = currW + neighboursW[k];
              var otherI = currI + this.neighborsI[k];
              var otherJ = currJ + this.neighborsJ[k];
              if (!marked[otherW] && otherI >= 0 && otherI < height && otherJ >= 0 && otherJ < width) {
                queue[++queuePosition] = otherW;
                queue[++queuePosition] = otherI;
                queue[++queuePosition] = otherJ;

                marked[otherW] = 1;
              }
            }
          }
        }

        if (currGroupSize >= this.minGroupSize) {
          const data = Tracker.calculateDimensions(currGroup, currGroupSize, color);
          if (data) {
            results.push(data);
          }
        }
      }
    }

    return Tracker.mergeRectangles(results, this.minMagnitude, this.maxMagnitude);
  };

  /**
   * Unites groups whose bounding box intersect with each other.
   */
  private static mergeRectangles(rects: Rect[], minMagnitude: number, maxMagnitude: number) {
    let intersects;
    const results = [];

    for (let r = 0; r < rects.length; r++) {
      const r1 = rects[r];
      intersects = true;
      for (let s = r + 1; s < rects.length; s++) {
        const r2 = rects[s];
        if (math.intersectRect(r1.x, r1.y, r1.x + r1.width, r1.y + r1.height, r2.x, r2.y, r2.x + r2.width, r2.y + r2.height)) {
          intersects = false;
          const x1 = Math.min(r1.x, r2.x);
          const y1 = Math.min(r1.y, r2.y);
          const x2 = Math.max(r1.x + r1.width, r2.x + r2.width);
          const y2 = Math.max(r1.y + r1.height, r2.y + r2.height);
          r2.height = y2 - y1;
          r2.width = x2 - x1;
          r2.x = x1;
          r2.y = y1;
          break;
        }
      }

      if (intersects) {
        if (r1.width >= minMagnitude && r1.height >= minMagnitude) {
          if (r1.width <= maxMagnitude && r1.height <= maxMagnitude) {
            results.push(r1);
          }
        }
      }
    }

    return results;
  };
}