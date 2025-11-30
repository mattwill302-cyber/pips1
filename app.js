// Domino Blocks: 4x4 grid, place 1x2 dominos (each with two pips 1-6).
// Four 2x2 blocks have target sums computed from a hidden solution (guaranteed solvable).
(function(){
  const SIZE = 4;
  const BLOCKS = [
    {r:0,c:0}, // top-left
    {r:0,c:2}, // top-right
    {r:2,c:0}, // bottom-left
    {r:2,c:2}  // bottom-right
  ];

  const gridEl = document.getElementById('grid');
  const poolEl = document.getElementById('domino-pool');
  const targetsEl = document.getElementById('block-targets');
  const msgEl = document.getElementById('message');
  const undoBtn = document.getElementById('undo');
  const restartBtn = document.getElementById('restart');

  let solutionTiles = []; // array of placed tile objects {cells:[{r,c,value},...]}
  let pool = []; // dominos available {id,a,b}
  let placed = []; // player's placements {id, cells:[{r,c,value},...]}
  let selectedDominoId = null;
  let selectionClicks = []; // clicked cells while placing
  let board = createEmptyBoard(); // null or value object {value, dominoId}
  let history = [];

  // Init a solvable puzzle
  function initPuzzle(){
    // Produce a full tiling with random pip values
    const tiling = generateRandomTilingWithValues();
    solutionTiles = tiling.slice(); // copy
    // compute 2x2 block sums as clues
    const blockTargets = computeBlockTargetsFromTiles(solutionTiles);
    // create pool from solution tiles (shuffled)
    pool = solutionTiles.map((t, i)=>({id:i, a:t.cells[0].value, b:t.cells[1].value}));
    shuffleArray(pool);
    placed = [];
    selectedDominoId = null;
    selectionClicks = [];
    board = createEmptyBoard();
    history = [];
    renderAll(blockTargets);
    setMessage('Select a domino then click two adjacent cells to place it.');
  }

  // Create empty board 4x4 of null
  function createEmptyBoard(){
    return Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>null));
  }

  // Generate a random domino tiling (backtracking) and assign pips to each half
  function generateRandomTilingWithValues(){
    // We'll fill a list of tiles with cells {r,c,value} for each domino (2 cells)
    const cells = Array(SIZE).fill(0).map(()=>Array(SIZE).fill(false));
    const tiles = [];

    function findFirstEmpty(){
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!cells[r][c]) return {r,c};
      return null;
    }

    function tryPlace(){
      const pos = findFirstEmpty();
      if(!pos) return true;
      const {r,c} = pos;
      const dirs = [{dr:0,dc:1},{dr:1,dc:0}];
      shuffleArray(dirs);
      for(const d of dirs){
        const nr = r + d.dr, nc = c + d.dc;
        if(nr>=0 && nr<SIZE && nc>=0 && nc<SIZE && !cells[nr][nc]){
          // place domino on (r,c) and (nr,nc)
          cells[r][c] = true; cells[nr][nc] = true;
          // assign random pips 1-6
          const v1 = randInt(1,6), v2 = randInt(1,6);
          tiles.push({cells:[{r,c,value:v1},{r:nr,c:nc,value:v2}]});
          if(tryPlace()) return true;
          // backtrack
          tiles.pop();
          cells[r][c] = false; cells[nr][nc] = false;
        }
      }
      return false;
    }

    // try until success (should be quick for 4x4)
    let attempts = 0;
    while(true){
      // reset
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) cells[r][c] = false;
      tiles.length = 0;
      attempts++;
      if(tryPlace()) break;
      if(attempts>200) throw new Error('Failed to generate tiling');
    }
    return tiles;
  }

  function computeBlockTargetsFromTiles(tiles){
    // Build board of numbers
    const b = createEmptyBoard();
    tiles.forEach((t, idx)=>{
      t.cells.forEach(cell=>{
        b[cell.r][cell.c] = cell.value;
      });
    });
    const targets = BLOCKS.map(bl=>{
      let sum = 0;
      for(let r=bl.r; r<bl.r+2; r++){
        for(let c=bl.c; c<bl.c+2; c++){
          sum += b[r][c];
        }
      }
      return sum;
    });
    return targets;
  }

  // Rendering
  function renderAll(blockTargets){
    renderGrid();
    renderPool();
    renderTargets(blockTargets);
  }

  function renderGrid(){
    gridEl.innerHTML = '';
    for(let r=0;r<SIZE;r++){
      for(let c=0;c<SIZE;c++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        const val = board[r][c];
        if(val){
          cell.classList.add('occupied');
          cell.innerHTML = `<div class="pip">${val.value}</div><div class="pip secondary">#${val.dominoId}</div>`;
        } else {
          cell.innerHTML = '';
        }
        cell.addEventListener('click', onCellClick);
        gridEl.appendChild(cell);
      }
    }
    // Draw subtle block boundaries (for UX) by placing absolutely positioned overlays
    // remove existing overlays first
    const existing = document.querySelectorAll('.block-boundary');
    existing.forEach(e=>e.remove());
    BLOCKS.forEach((b, idx)=>{
      const overlay = document.createElement('div');
      overlay.className = 'block-boundary';
      // compute position relative to gridEl
      const cellSize = gridEl.children[0].getBoundingClientRect();
      // use CSS positioning with grid, easier: place overlay by inserting element before grid and using transform not necessary.
      // Instead, skip pixel-perfect overlays (visual will still show grid cells). (Simplify)
    });
  }

  function renderPool(){
    poolEl.innerHTML = '';
    pool.forEach(d=>{
      const el = document.createElement('div');
      el.className = 'domino';
      if(selectedDominoId === d.id) el.classList.add('selected');
      el.dataset.id = d.id;
      el.innerHTML = `<div class="half">${d.a}</div><div class="half">${d.b}</div>`;
      el.addEventListener('click', ()=> onSelectDomino(d.id));
      poolEl.appendChild(el);
    });
  }

  function renderTargets(blockTargets){
    targetsEl.innerHTML = '';
    blockTargets.forEach((t, idx)=>{
      const box = document.createElement('div');
      box.className = 'target-box';
      const labels = ['Top-left','Top-right','Bottom-left','Bottom-right'];
      box.innerHTML = `<div class="label">${labels[idx]}</div><div class="value">Sum = <strong>${t}</strong></div>`;
      targetsEl.appendChild(box);
    });
  }

  // Event handlers
  function onSelectDomino(id){
    if(placed.find(p=>p.id===id)) return; // already placed
    selectedDominoId = id;
    selectionClicks = [];
    renderPool();
    setMessage('Domino selected. Click two adjacent empty cells to place it.');
  }

  function onCellClick(ev){
    const r = parseInt(ev.currentTarget.dataset.r,10);
    const c = parseInt(ev.currentTarget.dataset.c,10);
    if(!selectedDominoId){
      setMessage('Select a domino from the pool first.');
      return;
    }
    if(board[r][c]){
      setMessage('Cell already occupied. Pick an empty cell.');
      return;
    }
    selectionClicks.push({r,c});
    // highlight maybe
    if(selectionClicks.length===2){
      // validate adjacency
      const a = selectionClicks[0], b = selectionClicks[1];
      if(!areAdjacent(a,b)){
        selectionClicks = [];
        setMessage('Cells not adjacent. Try again.');
        return;
      }
      // place domino into board
      const dom = pool.find(d=>d.id===selectedDominoId);
      if(!dom){ setMessage('Selected domino not found.'); selectionClicks=[]; return; }
      // assign first click -> dom.a, second -> dom.b
      const placements = [
        {r:a.r,c:a.c,value:dom.a},
        {r:b.r,c:b.c,value:dom.b}
      ];
      placements.forEach(p=>{
        board[p.r][p.c] = {value:p.value, dominoId:dom.id};
      });
      // record placement
      placed.push({id:dom.id, cells:placements});
      // remove domino from pool (but keep its entry so hash stays stable) by filtering it out visually
      pool = pool.filter(x=>x.id!==dom.id);
      history.push({action:'place',dominoId:dom.id,cells:placements});
      // clear selection
      selectedDominoId = null;
      selectionClicks = [];
      renderPool();
      renderGrid();
      setMessage('Placed. ' + (placed.length) + ' of 8 placed.');
      checkCompletion();
    } else {
      setMessage('Select the second adjacent cell for the domino.');
    }
  }

  function undo(){
    const last = history.pop();
    if(!last){ setMessage('Nothing to undo.'); return; }
    if(last.action === 'place'){
      // remove cells
      last.cells.forEach(cell=>{ board[cell.r][cell.c] = null; });
      // restore domino to pool (we use id to restore original numbers from solutionTiles)
      // find original tile numbers in solutionTiles: find tile with same id (in solutionTiles the domino ids correspond to their index)
      const sol = solutionTiles[last.dominoId];
      const domObj = {id:last.dominoId, a:sol.cells[0].value, b:sol.cells[1].value};
      pool.push(domObj);
      // sort pool to keep order unpredictable (or keep pushed)
      // remove from placed list
      placed = placed.filter(p=>p.id !== last.dominoId);
      renderPool();
      renderGrid();
      setMessage('Undid last placement.');
    }
  }

  function restart(){
    initPuzzle();
  }

  function checkCompletion(){
    // if board full (no null), compute block sums and compare
    if(board.flat().some(cell=>cell===null)) return;
    const sums = BLOCKS.map(bl=>{
      let s=0;
      for(let r=bl.r;r<bl.r+2;r++) for(let c=bl.c;c<bl.c+2;c++) s+=board[r][c].value;
      return s;
    });
    const correctTargets = computeBlockTargetsFromTiles(solutionTiles);
    let ok = true;
    const wrongIdx = [];
    for(let i=0;i<sums.length;i++){
      if(sums[i] !== correctTargets[i]) { ok=false; wrongIdx.push(i); }
    }
    if(ok){
      setMessage('Congratulations — you solved it!');
    } else {
      setMessage('All dominos placed, but some blocks do not match targets. Wrong blocks: ' + wrongIdx.map(i=>i+1).join(', '));
      // highlight wrong blocks (UX) - we'll flash those cells briefly
      flashWrongBlocks(wrongIdx);
    }
  }

  function flashWrongBlocks(indices){
    indices.forEach(idx=>{
      const bl = BLOCKS[idx];
      for(let r=bl.r;r<bl.r+2;r++){
        for(let c=bl.c;c<bl.c+2;c++){
          const cellIndex = r*SIZE + c;
          const el = gridEl.children[cellIndex];
          if(el){
            el.classList.add('highlight');
            setTimeout(()=>el.classList.remove('highlight'), 1200);
          }
        }
      }
    });
  }

  // Utilities
  function areAdjacent(a,b){
    const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
    return (dr + dc) === 1;
  }

  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function shuffleArray(a){
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
  }

  function setMessage(t){ msgEl.textContent = t; }

  // hook up controls
  undoBtn.addEventListener('click', ()=>{ undo(); });
  restartBtn.addEventListener('click', ()=>{ restart(); });

  // Start
  initPuzzle();

})();
