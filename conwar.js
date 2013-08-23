(function() {
  var key, i, x, y;

  var CELL = {
    DEAD: 0,
    ALIVE: 1,
    P1: 2,
    P2: 4,
    BASE: 256,
    OUT: 512,
  }

  var requestFrame = window.webkitRequestAnimationFrame ||
                     window.requestAnimationFrame ||
                     window.mozRequestAnimationFrame ||
                     window.msRequestAnimationFrame;

  var stats = new Stats();
  stats.setMode(1); // 0: fps, 1: ms
  // Align top-left
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.bottom = '0px';
  document.body.appendChild( stats.domElement );

  var config = {
    speed: 500, // ms to wait between frames.
    size: {x: 160, y: 120},
  }
  var urlParams = queryParams(window.location.href);
  if (urlParams.speed) {
    config.speed = urlParams.speed
  }
  if (urlParams.size) {
    var split = urlParams.size.split(',');
    config.size.x = split[0];
    config.size.y = split[1];
  }

  var boards = [];
  for (i = 0; i < 2; i++) {
    boards[i] = [];
    for (x = 0; x < config.size.x; x++) {
      boards[i][x] = [];
      for (y = 0; y < config.size.y; y++) {
        boards[i][x][y] = CELL.DEAD;
      }
    }
  }

  // Make some stuff.
  var red = CELL.ALIVE | CELL.P1;
  var blue = CELL.ALIVE | CELL.P2;
  var neutral = CELL.ALIVE;
  boards[0][81][49] = red;
  boards[0][80][49] = red;
  boards[0][80][50] = red;
  boards[0][79][50] = red;
  boards[0][80][51] = red;

  boards[0][50][49] = blue;
  boards[0][51][49] = blue;
  boards[0][51][51] = blue;
  boards[0][53][50] = blue;
  boards[0][54][49] = blue;
  boards[0][55][49] = blue;
  boards[0][56][49] = blue;

  var generation = 0;

  var boardDiv = document.querySelector('.board');
  var width = 800;
  var height = 600;

  var c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  var ctx = c.getContext('2d');
  ctx.mozImageSmoothingEnabled = false;

  boardDiv.appendChild(c);

  var s = 1;
  var cx=0, cy=0;

  var as = 1;
  var acx=0, acy=0;

  ctx.fillStyle="#fff";
  ctx.strokeStyle="#ccc";

  var stime = Date.now();

  function step() {
    stats.end();
    stats.begin();

    var x, y;
    for (x = 0; x < boards[0].length; x++) {
      for (y = 0 ; y < boards[0][0].length; y++) {
        boards[(generation+1) % 2][x][y] = nextState(x, y);
      }
    }
    generation++;
    requestFrame(draw);
  }

  function nextState(x, y) {
    var surr = getNeighbors(x, y);
    var cell = board(x, y);
    if (cell & CELL.ALIVE) {
      if (surr.count.alive === 2 || surr.count.alive === 3) {
        return cell;
      } else {
        return CELL.DEAD;
      }
    } else {
      if (surr.count.alive === 3) {
        var newCell = CELL.ALIVE;
        if (surr.count.base === surr.count.alive) {
          newCell |= CELL.BASE;
        }
        if (surr.count.p1 === 3) {
          newCell |= CELL.P1;
        } else if (surr.count.p2 === 3) {
          newCell |= CELL.P2;
        }
        return newCell;
      } else {
        return CELL.DEAD;
      }
    }
  }

  function getNeighbors(x, y) {
    var neighbors = [
      board(x, y-1),
      board(x+1, y-1),
      board(x+1, y),
      board(x+1, y+1),
      board(x, y+1),
      board(x-1, y+1),
      board(x-1, y),
      board(x-1, y-1),
    ];

    neighbors.count = {
      dead: 0,
      alive: 0,
      p1: 0,
      p2: 0
    };

    var cell;
    for (var i = 0, l = neighbors.length; i < l; i++) {
      cell = neighbors[i];
      if (cell & CELL.ALIVE) {
        neighbors.count.alive++;

        if (cell & CELL.P1) {
          neighbors.count.p1++;
        }
        if (cell & CELL.P2) {
          neighbors.count.p2++;
        }
      } else {
        neighbors.count.dead++;
      }
    }

    return neighbors;
  }

  function board(x, y) {
    var b = boards[generation % 2];
    var col = b[x];
    return col ? col[y] : CELL.OUT;
  }

  var stat = document.querySelector('#stat');

  var cellColors = {};
  cellColors[CELL.DEAD] = '#000';
  cellColors[CELL.ALIVE] = '#aaa';
  cellColors[CELL.ALIVE | CELL.P1] = '#f00';
  cellColors[CELL.ALIVE | CELL.P2] = '#00f';
  cellColors[CELL.ALIVE | CELL.P1 | CELL.BASE] = '#f88';
  cellColors[CELL.ALIVE | CELL.P2 | CELL.BASE] = '#88f';

  function draw() {
    var x, y;
    var size = 5;
    // ctx.fillStyle = '#eee';
    // ctx.fillRect(0,0,width,height);

    for (x = 0; x < boards[0].length; x++) {
      for (y = 0; y < boards[0][0].length; y++) {
        ctx.fillStyle = cellColors[board(x, y)] || '#f0f';
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
    stats.end();
  }

  draw();
  setInterval(step, config.speed);

  function queryParams (url) {
    // Isolate the querystring.
    if (url.indexOf('?') >= 0) {
      url = url.split('?')[1];
    }
    var obj = {};
    var pairs = url.split('&');

    pairs.forEach(function(p) {
      p = p.split('=');
      obj[p[0]] = typeof p[1] === 'undefined' ? true: p[1];
    });

    return obj;
  }
})();