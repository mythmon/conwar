(function() {
  var i, x, y;

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

  var config = {
    speed: 3000, // ms to wait between frames.
    size: {x: 80, y: 60},
    cellSize: 10,
    gameId: randomID(),
    playerId: randomID(),
  };
  var urlParams = queryParams();
  if (urlParams.speed) {
    config.speed = urlParams.speed
  }
  if (urlParams.size) {
    var split = urlParams.size.split(',');
    config.size.x = split[0];
    config.size.y = split[1];
  }
  if (urlParams.game) {
    config.gameId = urlParams.game;
  } else {
    updateQueryParams({game: config.gameId});
  }

  var historySize = 10;
  var boards = [];
  for (i = 0; i < historySize; i++) {
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
  boards[0][56][29] = red;
  boards[0][55][29] = red;
  boards[0][55][30] = red;
  boards[0][54][30] = red;
  boards[0][55][31] = red;

  boards[0][20][29] = blue;
  boards[0][21][29] = blue;
  boards[0][21][31] = blue;
  boards[0][23][30] = blue;
  boards[0][24][29] = blue;
  boards[0][25][29] = blue;
  boards[0][26][29] = blue;

  var generation = 0;

  var width = 800;
  var height = 600;

  var c = document.querySelector('.board canvas');
  c.width = width;
  c.height = height;
  var ctx = c.getContext('2d');
  ctx.mozImageSmoothingEnabled = false;

  var playerColor = CELL.ALIVE;
  var inputQueue = [];
  var numPlayers = 0;

  var firebase = new Firebase('https://gameofwar.firebaseIO.com/');
  var gameRef = firebase.child('game').child(config.gameId);
  var inputRef = gameRef.child('input');

  var connectedRef = firebase.child('.info/connected');
  var onlineRef = gameRef.child('players/online').child(config.playerId);
  connectedRef.on('value', function(snap) {
    if (snap.val() === true) {
      onlineRef.set('online');
      onlineRef.onDisconnect().set(null);
    }
  });
  gameRef.child('players/online').on('value', function(snap) {
    var count = 0;
    var val = snap.val();
    for (var key in val) {
      if (val.hasOwnProperty(key)) {
        count++;
      }
    }
    numPlayers = count;
  });

  (function makeColorSelector() {
    var colorSelector = document.querySelector('.controls .color-selector');
    function colorRadioButton(display, val) {
      var radioButton = document.createElement('input');
      radioButton.name = 'player-color';
      radioButton.type = 'radio';
      radioButton.value = val;

      var label = document.createElement('label');
      label.appendChild(radioButton);
      label.appendChild(document.createTextNode(display));
      colorSelector.appendChild(label);

      return radioButton;
    }

    colorRadioButton('Neutral', CELL.ALIVE).checked = true;
    colorRadioButton('Red', CELL.ALIVE | CELL.P1);
    colorRadioButton('Blue', CELL.ALIVE | CELL.P2);

    colorSelector.addEventListener('change', function(e) {
      playerColor = parseFloat(e.target.value);
    });
  })();

  var down = null;
  function eventCell(e) {
    var x = Math.floor((e.clientX - c.offsetLeft) / config.cellSize);
    var y = Math.floor((e.clientY - c.offsetTop) / config.cellSize);
    return [x, y];
  }

  function toggleCell(x, y, newState) {
    var cell = board(x, y);
    newState = newState || (cell & CELL.ALIVE ? CELL.DEAD : playerColor);
    var p = {x: x, y: y, state: newState, generation: generation}
    if (board(x, y) !== newState) {
      inputRef.push(p);
    }
    return newState;
  }

  c.addEventListener('mousedown', function(e) {
    var pos = eventCell(e);
    down = toggleCell(pos[0], pos[1]);
    draw();
  });
  c.addEventListener('mousemove', function(e) {
    if (down === null) return;
    var pos = eventCell(e);
    toggleCell(pos[0], pos[1], down);
    draw();
  });
  c.addEventListener('mouseup', function(e) {
    down = null;
  });

  var stats = new Stats();
  stats.setMode(1); // 0: fps, 1: ms
  // Align top-left
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.bottom = '0px';
  document.body.appendChild( stats.domElement );


  function step() {
    stats.end();
    stats.begin();

    for (var i = inputQueue.length - 1; i >= 0; i--) {
      var change = inputQueue[i];
      if (change.generation === generation) {
        board(change.x, change.y, change.state);
        inputQueue.splice(i, 1);
      }
    }

    var x, y;
    for (x = 0; x < boards[0].length; x++) {
      for (y = 0 ; y < boards[0][0].length; y++) {
        board(x, y, nextState(x, y), true);
      }
    }
    requestFrame(draw);
    generation++;
    setTimeout(readyForNextStep, config.speed);
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

  function board(x, y, newVal, next) {
    var gen = generation + (next | 0);
    var b = boards[gen % 4];
    var col = b[x];
    if (newVal !== undefined && col) {
      col[y] = newVal;
    }
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

    for (x = 0; x < boards[0].length; x++) {
      for (y = 0; y < boards[0][0].length; y++) {
        ctx.fillStyle = cellColors[board(x, y)] || '#f0f';
        ctx.fillRect(x * config.cellSize, y * config.cellSize,
                     config.cellSize, config.cellSize);
      }
    }

    document.querySelector('.controls .info').innerHTML =
       'Generation ' + generation + '. ' + numPlayers + ' players.';
  }

  function updateFirebase() {
  }

  var inputQueue = [];
  inputRef.on('child_added', function(snapshot) {
    var change = snapshot.val();
    if (change.generation === generation) {
      board(change.x, change.y, change.state);
      return;
    }
    if (change.generation > generation) {
      inputQueue.push(change);
    } else {
      if (generation - change.generation > historySize - 1) {
        alert('AHHH Input came in from an old generation. This is bad! ' +
             'local: ' + generation + ' remote: ' + change.generation);
        throw 'AHHH Input came in from an old generation. This is bad! ' +
              'local: ' + generation + ' remote: ' + change.generation;
      } else {
        console.log('rolling back to deal with wibble wobbly');
        generation = change.generation;
        board(change.x, change.y, change.state);
      }
    }
  });

  function readyForNextStep() {
    gameRef.child('players/ready').child(generation).transaction(function(val) {
      return val + 1;
    });
  }
  gameRef.child('players/ready').on('value', function(snap) {
    var val = snap.val();
    console.log(val[generation], '/', numPlayers, 'players ready on gen', generation);
    if (val && val[generation] >= numPlayers) {
      console.log('step');
      setTimeout(step, 0);
    }
  });

  draw();
  setTimeout(readyForNextStep, config.speed);

  function queryParams() {
    var url = window.location.href;
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

  function updateQueryParams(obj) {
    var key;
    var current = queryParams();
    for (key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      current[key] = obj[key];
    }
    var newQuery = '?';
    for (key in current) {
      if (!obj.hasOwnProperty(key)) continue;
      newQuery += key + '=' + obj[key] + '&';
    }
    newQuery = newQuery.slice(0, -1);
    var newUrl = window.location.pathname + newQuery + window.location.hash;
    window.history.replaceState(null, null, newUrl);
  }
  window.updateQueryParams = updateQueryParams;

  function randomID() {
    return (Math.random() + Math.PI).toString(36).substring(2, 10);
  }
})();