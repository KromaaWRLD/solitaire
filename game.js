(() => {
  "use strict";

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));

  const DIFFICULTY = {
    easy:   { draw: 1, maxPasses: Infinity, label: "Easy" },
    medium: { draw: 3, maxPasses: Infinity, label: "Medium" },
    hard:   { draw: 3, maxPasses: 3,        label: "Hard" },
  };

  let stock = [], waste = [], foundations = [[], [], [], []], tableau = [[], [], [], [], [], [], []];
  let drawCount = 1, maxPasses = Infinity, passCount = 0;
  let selected = null, history = [], moves = 0, score = 0;
  let startTime = null, pausedAt = null, totalPaused = 0, timerInterval = null;
  let gameWon = false, isPaused = false, isAnimating = false, difficulty = "easy";

  const TUTORIAL = [
    {
      title: "Goal",
      html: `<p>Build four <strong>foundation</strong> piles (top right), one for each suit, from <strong>Ace → King</strong>.</p>
             <p>When all 52 cards are on the foundations, you win!</p>`
    },
    {
      title: "Tableau",
      html: `<p>The seven columns in the middle are the <strong>tableau</strong>.</p>
             <ul>
               <li>Build <strong>down</strong> in <strong>alternating colors</strong> (red on black, black on red).</li>
               <li>Example: black 8 can go on red 9.</li>
               <li>Only a <strong>King</strong> (or a sequence starting with a King) can fill an empty column.</li>
             </ul>`
    },
    {
      title: "Stock & Waste",
      html: `<p>Click the <strong>stock</strong> (top left) to draw cards onto the waste pile.</p>
             <ul>
               <li><strong>Easy</strong> – draw 1 card at a time</li>
               <li><strong>Medium / Hard</strong> – draw 3 cards; only the top one is playable</li>
               <li>When the stock is empty, click it to recycle the waste (Hard mode has limited passes).</li>
             </ul>`
    },
    {
      title: "Moving cards",
      html: `<ul>
               <li><strong>Drag</strong> a card or stack, or <strong>click</strong> to select then click the destination.</li>
               <li><strong>Double-click</strong> a card to send it to a foundation if possible.</li>
               <li>Moving a card reveals the face-down card underneath.</li>
             </ul>`
    },
    {
      title: "Finish & more",
      html: `<ul>
               <li>When every card is face-up, the <strong>Finish</strong> button appears — tap it to auto-complete.</li>
               <li>Use <strong>Hint</strong> if you're stuck, <strong>Undo</strong> to reverse a move.</li>
               <li><strong>Pause</strong> freezes the timer anytime.</li>
             </ul>
             <p>Good luck!</p>`
    }
  ];
  let tutStep = 0;

  function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          suit, rank,
          value: RANK_VALUE[rank],
          color: (suit === "♥" || suit === "♦") ? "red" : "black",
          faceUp: false,
          id: rank + suit
        });
      }
    }
    return shuffle(deck);
  }

  function shuffle(a) {
    const arr = [...a];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function deal() {
    const deck = createDeck();
    tableau = [[], [], [], [], [], [], []];
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        card.faceUp = row === col;
        tableau[col].push(card);
      }
    }
    stock = deck;
    waste = [];
    foundations = [[], [], [], []];
    selected = null;
    history = [];
    moves = 0;
    score = 0;
    passCount = 0;
    gameWon = false;
    isAnimating = false;
    totalPaused = 0;
    pausedAt = null;
    isPaused = false;
    startTime = Date.now();
    updateTimer();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    render(true);
    updateUI();
    updatePassInfo();
  }

  function canPlaceOnTableau(card, targetCol) {
    const pile = tableau[targetCol];
    if (pile.length === 0) return card.rank === "K";
    const top = pile[pile.length - 1];
    return top.faceUp && card.color !== top.color && card.value === top.value - 1;
  }

  function canPlaceOnFoundation(card, fi) {
    const pile = foundations[fi];
    if (pile.length === 0) return card.rank === "A";
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === top.value + 1;
  }

  function findFoundationFor(card) {
    for (let i = 0; i < 4; i++) if (canPlaceOnFoundation(card, i)) return i;
    return -1;
  }

  function allTableauFaceUp() {
    return tableau.every(col => col.every(c => c.faceUp));
  }

  function canAutoComplete() {
    if (!allTableauFaceUp()) return false;
    if (stock.length > 0) return false;
    return true;
  }

  function pushHistory(action) {
    history.push(action);
    if (history.length > 120) history.shift();
  }

  function undo() {
    if (!history.length || gameWon || isAnimating || isPaused) return;
    const action = history.pop();
    applyUndo(action);
    moves = Math.max(0, moves - 1);
    selected = null;
    render();
    updateUI();
    updatePassInfo();
  }

  function applyUndo(action) {
    switch (action.type) {
      case "draw":
        for (let i = 0; i < action.count; i++) {
          const c = waste.pop();
          if (c) { c.faceUp = false; stock.push(c); }
        }
        break;
      case "recycle":
        while (stock.length) {
          const c = stock.pop();
          c.faceUp = true;
          waste.push(c);
        }
        passCount = Math.max(0, passCount - 1);
        break;
      case "move": {
        const { cards, from, to } = action;
        if (to.type === "tableau")
          tableau[to.index].splice(tableau[to.index].length - cards.length, cards.length);
        else if (to.type === "foundation") {
          foundations[to.index].pop();
          score = Math.max(0, score - 10);
        }
        if (from.type === "tableau" && from.wasFlipped) {
          const p = tableau[from.index];
          if (p.length) p[p.length - 1].faceUp = false;
        }
        if (from.type === "tableau") tableau[from.index].push(...cards);
        else if (from.type === "waste") waste.push(...cards);
        else if (from.type === "foundation") foundations[from.index].push(...cards);
        break;
      }
    }
  }

  function drawFromStock() {
    if (gameWon || isAnimating || isPaused) return;
    clearSelection();

    if (stock.length === 0) {
      if (waste.length === 0) return;
      if (passCount >= maxPasses) return;
      pushHistory({ type: "recycle" });
      while (waste.length) {
        const c = waste.pop();
        c.faceUp = false;
        stock.push(c);
      }
      passCount++;
      moves++;
      render();
      updateUI();
      updatePassInfo();
      return;
    }

    const count = Math.min(drawCount, stock.length);
    for (let i = 0; i < count; i++) {
      const c = stock.pop();
      c.faceUp = true;
      waste.push(c);
    }
    pushHistory({ type: "draw", count });
    moves++;
    render();
    updateUI();
    checkAutoButton();
  }

  function moveCards(cards, from, to, silent) {
    if (from.type === "tableau") {
      tableau[from.index].splice(tableau[from.index].length - cards.length, cards.length);
      const pile = tableau[from.index];
      if (pile.length && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
        from.wasFlipped = true;
      }
    } else if (from.type === "waste") {
      waste.pop();
    } else if (from.type === "foundation") {
      foundations[from.index].pop();
      score = Math.max(0, score - 10);
    }

    if (to.type === "tableau") {
      tableau[to.index].push(...cards);
    } else if (to.type === "foundation") {
      foundations[to.index].push(cards[0]);
      score += 10;
    }

    if (!silent) {
      pushHistory({ type: "move", cards: cards.map(c => ({ ...c })), from: { ...from }, to: { ...to } });
      moves++;
    }
    clearSelection();
    render();
    updateUI();
    checkWin();
    checkAutoButton();
  }

  function tryAutoMoveToFoundation(card, from) {
    const fi = findFoundationFor(card);
    if (fi === -1) return false;
    moveCards([card], from, { type: "foundation", index: fi });
    return true;
  }

  function runAutoComplete() {
    if (isAnimating || gameWon) return;
    isAnimating = true;
    document.getElementById("auto-btn").classList.add("hidden");

    function step() {
      let moved = false;

      if (waste.length) {
        const card = waste[waste.length - 1];
        const fi = findFoundationFor(card);
        if (fi !== -1) {
          moveCards([card], { type: "waste" }, { type: "foundation", index: fi }, true);
          moves++;
          score += 10;
          moved = true;
        }
      }

      if (!moved) {
        for (let col = 0; col < 7; col++) {
          const pile = tableau[col];
          if (!pile.length) continue;
          const card = pile[pile.length - 1];
          const fi = findFoundationFor(card);
          if (fi !== -1) {
            moveCards([card], { type: "tableau", index: col }, { type: "foundation", index: fi }, true);
            moves++;
            score += 10;
            moved = true;
            break;
          }
        }
      }

      updateUI();
      if (moved) {
        setTimeout(step, 180);
      } else {
        isAnimating = false;
        checkWin();
      }
    }
    step();
  }

  function checkAutoButton() {
    const btn = document.getElementById("auto-btn");
    if (canAutoComplete() && !gameWon && !isAnimating) {
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  }

  function clearSelection() {
    selected = null;
    document.querySelectorAll(".card.selected, .card.hint-glow").forEach(el => {
      el.classList.remove("selected", "hint-glow");
    });
    document.querySelectorAll(".pile.valid-drop").forEach(el => el.classList.remove("valid-drop"));
  }

  function getMovableStack(colIndex, startIndex) {
    const pile = tableau[colIndex];
    if (startIndex >= pile.length || !pile[startIndex].faceUp) return null;
    const stack = pile.slice(startIndex);
    for (let i = 1; i < stack.length; i++) {
      if (stack[i].color === stack[i - 1].color || stack[i].value !== stack[i - 1].value - 1)
        return null;
    }
    return stack;
  }

  function handleCardClick(e) {
    if (gameWon || isAnimating || isPaused) return;
    e.stopPropagation();
    const cardEl = e.currentTarget;
    const location = cardEl.dataset.location;
    const col = parseInt(cardEl.dataset.col, 10);
    const idx = parseInt(cardEl.dataset.idx, 10);

    if (e.detail === 2) {
      clearSelection();
      let card, from;
      if (location === "waste") {
        if (!waste.length) return;
        card = waste[waste.length - 1];
        from = { type: "waste" };
      } else if (location === "tableau") {
        const pile = tableau[col];
        if (idx !== pile.length - 1 || !pile[idx].faceUp) return;
        card = pile[idx];
        from = { type: "tableau", index: col };
      } else return;
      if (card) tryAutoMoveToFoundation(card, from);
      return;
    }

    if (location === "stock") {
      drawFromStock();
      return;
    }

    if (!cardEl.classList.contains("face-up")) return;

    if (selected) {
      attemptDrop(location, col);
      return;
    }

    if (location === "waste") {
      if (!waste.length) return;
      selectCards([waste[waste.length - 1]], { type: "waste" });
      cardEl.classList.add("selected");
    } else if (location === "tableau") {
      const stack = getMovableStack(col, idx);
      if (!stack) return;
      selectCards(stack, { type: "tableau", index: col });
      const pileEl = document.getElementById(`tableau-${col}`);
      const cards = pileEl.querySelectorAll(".card");
      for (let i = idx; i < cards.length; i++) cards[i].classList.add("selected");
    } else if (location === "foundation") {
      const pile = foundations[col];
      if (!pile.length) return;
      selectCards([pile[pile.length - 1]], { type: "foundation", index: col });
      cardEl.classList.add("selected");
    }
  }

  function selectCards(cards, from) {
    clearSelection();
    selected = { cards, from };
  }

  function attemptDrop(location, col) {
    if (!selected) return;
    const { cards, from } = selected;
    if (location === "tableau" && canPlaceOnTableau(cards[0], col)) {
      moveCards(cards, from, { type: "tableau", index: col });
      return;
    }
    if (location === "foundation" && cards.length === 1 && canPlaceOnFoundation(cards[0], col)) {
      moveCards(cards, from, { type: "foundation", index: col });
      return;
    }
    clearSelection();
  }

  function handlePileClick(e) {
    if (gameWon || isAnimating || isPaused) return;
    const pileEl = e.currentTarget;
    if (pileEl.id === "stock") {
      drawFromStock();
      return;
    }
    if (!selected) return;
    if (pileEl.classList.contains("tableau-col")) {
      attemptDrop("tableau", parseInt(pileEl.id.replace("tableau-", ""), 10));
    } else if (pileEl.classList.contains("foundation")) {
      attemptDrop("foundation", parseInt(pileEl.id.replace("foundation-", ""), 10));
    }
  }

  let dragData = null;

  function onDragStart(e) {
    if (gameWon || isAnimating || isPaused) { e.preventDefault(); return; }
    const cardEl = e.target.closest(".card");
    if (!cardEl || !cardEl.classList.contains("face-up")) { e.preventDefault(); return; }

    const location = cardEl.dataset.location;
    const col = parseInt(cardEl.dataset.col, 10);
    const idx = parseInt(cardEl.dataset.idx, 10);
    let cards, from;

    if (location === "waste") {
      cards = [waste[waste.length - 1]];
      from = { type: "waste" };
    } else if (location === "tableau") {
      cards = getMovableStack(col, idx);
      if (!cards) { e.preventDefault(); return; }
      from = { type: "tableau", index: col };
    } else if (location === "foundation") {
      cards = [foundations[col][foundations[col].length - 1]];
      from = { type: "foundation", index: col };
    } else { e.preventDefault(); return; }

    dragData = { cards, from };
    cardEl.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cardEl.dataset.id);
    setTimeout(() => clearSelection(), 0);
  }

  function onDragEnd() {
    document.querySelectorAll(".card.dragging").forEach(el => el.classList.remove("dragging"));
    document.querySelectorAll(".pile.valid-drop").forEach(el => el.classList.remove("valid-drop"));
    dragData = null;
  }

  function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }

  function onDragEnter(e) {
    e.preventDefault();
    if (!dragData) return;
    const pile = e.currentTarget;
    let valid = false;
    if (pile.classList.contains("tableau-col")) {
      valid = canPlaceOnTableau(dragData.cards[0], parseInt(pile.id.replace("tableau-", ""), 10));
    } else if (pile.classList.contains("foundation")) {
      valid = dragData.cards.length === 1 &&
        canPlaceOnFoundation(dragData.cards[0], parseInt(pile.id.replace("foundation-", ""), 10));
    }
    if (valid) pile.classList.add("valid-drop");
  }

  function onDragLeave(e) { e.currentTarget.classList.remove("valid-drop"); }

  function onDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("valid-drop");
    if (!dragData) return;
    const pile = e.currentTarget;
    const { cards, from } = dragData;
    if (pile.classList.contains("tableau-col")) {
      const col = parseInt(pile.id.replace("tableau-", ""), 10);
      if (canPlaceOnTableau(cards[0], col)) moveCards(cards, from, { type: "tableau", index: col });
    } else if (pile.classList.contains("foundation")) {
      const col = parseInt(pile.id.replace("foundation-", ""), 10);
      if (cards.length === 1 && canPlaceOnFoundation(cards[0], col))
        moveCards(cards, from, { type: "foundation", index: col });
    }
    dragData = null;
  }

  function showHint() {
    if (gameWon || isAnimating || isPaused) return;
    clearSelection();

    const candidates = [];
    if (waste.length) {
      const c = waste[waste.length - 1];
      if (findFoundationFor(c) !== -1) candidates.push({ el: findCardEl("waste", 0, waste.length - 1), card: c });
    }
    for (let col = 0; col < 7; col++) {
      const pile = tableau[col];
      if (!pile.length) continue;
      const c = pile[pile.length - 1];
      if (c.faceUp && findFoundationFor(c) !== -1)
        candidates.push({ el: findCardEl("tableau", col, pile.length - 1), card: c });
    }
    if (candidates.length) {
      candidates[0].el?.classList.add("hint-glow");
      return;
    }

    for (let col = 0; col < 7; col++) {
      const pile = tableau[col];
      for (let i = 0; i < pile.length; i++) {
        if (!pile[i].faceUp) continue;
        const stack = getMovableStack(col, i);
        if (!stack) continue;
        for (let t = 0; t < 7; t++) {
          if (t === col) continue;
          if (canPlaceOnTableau(stack[0], t)) {
            const el = findCardEl("tableau", col, i);
            el?.classList.add("hint-glow");
            return;
          }
        }
      }
    }

    const stockEl = document.getElementById("stock");
    if (stock.length || (waste.length && passCount < maxPasses)) {
      stockEl.style.outline = "3px solid #4fc3f7";
      setTimeout(() => { stockEl.style.outline = ""; }, 1600);
    }
  }

  function findCardEl(location, col, idx) {
    const sel = location === "waste"
      ? `#waste .card[data-idx="${idx}"]`
      : location === "tableau"
        ? `#tableau-${col} .card[data-idx="${idx}"]`
        : `#foundation-${col} .card[data-idx="${idx}"]`;
    return document.querySelector(sel);
  }

  function createCardElement(card, location, col, idx, animateDeal) {
    const el = document.createElement("div");
    el.className = `card ${card.color} ${card.faceUp ? "face-up" : "face-down"}`;
    if (animateDeal) el.classList.add("deal-in");
    el.dataset.id = card.id;
    el.dataset.location = location;
    el.dataset.col = col;
    el.dataset.idx = idx;
    el.draggable = card.faceUp && !isPaused;

    if (card.faceUp) {
      el.innerHTML = `
        <div class="corner top"><span>${card.rank}</span><span>${card.suit}</span></div>
        <div class="suit-center">${card.suit}</div>
        <div class="corner bottom"><span>${card.rank}</span><span>${card.suit}</span></div>
      `;
    }

    el.addEventListener("click", handleCardClick);
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("dragend", onDragEnd);
    return el;
  }

  function getOverlap() {
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue("--overlap")) || 30;
  }

  function renderPile(container, cards, location, colIndex, animateDeal) {
    container.innerHTML = "";
    const overlap = location === "tableau" ? getOverlap() : 0;
    cards.forEach((card, i) => {
      const el = createCardElement(card, location, colIndex, i, animateDeal);
      el.style.top = `${i * overlap}px`;
      el.style.zIndex = i + 1;
      if (location === "waste" && drawCount === 3) {
        const visible = Math.min(3, cards.length);
        const start = cards.length - visible;
        el.style.left = i >= start ? `${(i - start) * 20}px` : "0";
      }
      if (animateDeal) el.style.animationDelay = `${(colIndex * 0.04 + i * 0.03)}s`;
      container.appendChild(el);
    });
  }

  function render(animateDeal = false) {
    const stockEl = document.getElementById("stock");
    stockEl.innerHTML = "";
    const noMorePasses = stock.length === 0 && passCount >= maxPasses;
    stockEl.classList.toggle("empty", stock.length === 0);
    stockEl.classList.toggle("disabled", noMorePasses && stock.length === 0);
    if (stock.length > 0) {
      const back = document.createElement("div");
      back.className = "card face-down";
      back.style.position = "relative";
      back.dataset.location = "stock";
      back.addEventListener("click", handleCardClick);
      stockEl.appendChild(back);
    }

    renderPile(document.getElementById("waste"), waste, "waste", 0, false);
    for (let i = 0; i < 4; i++)
      renderPile(document.getElementById(`foundation-${i}`), foundations[i], "foundation", i, false);
    for (let i = 0; i < 7; i++)
      renderPile(document.getElementById(`tableau-${i}`), tableau[i], "tableau", i, animateDeal);
  }

  function elapsedSeconds() {
    if (!startTime) return 0;
    const now = isPaused && pausedAt ? pausedAt : Date.now();
    return Math.floor((now - startTime - totalPaused) / 1000);
  }

  function updateTimer() {
    if (!startTime) return;
    const elapsed = elapsedSeconds();
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    document.getElementById("timer").textContent = `${m}:${s}`;
  }

  function updateUI() {
    document.getElementById("moves").textContent = moves;
    document.getElementById("score").textContent = score;
    document.getElementById("undo").disabled = !history.length || gameWon || isAnimating;
  }

  function updatePassInfo() {
    const el = document.getElementById("pass-info");
    if (maxPasses === Infinity) {
      el.classList.add("hidden");
    } else {
      el.classList.remove("hidden");
      const left = Math.max(0, maxPasses - passCount);
      el.textContent = left === 0 && stock.length === 0
        ? "No passes left"
        : `Passes left: ${left}`;
    }
  }

  function checkWin() {
    const total = foundations.reduce((s, f) => s + f.length, 0);
    if (total === 52) {
      gameWon = true;
      clearInterval(timerInterval);
      isAnimating = false;
      document.getElementById("auto-btn").classList.add("hidden");
      const elapsed = elapsedSeconds();
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      const timeBonus = Math.max(0, 700000 / Math.max(elapsed, 1) | 0);
      score += timeBonus;
      document.getElementById("win-stats").innerHTML =
        `<div>Difficulty: <strong>${DIFFICULTY[difficulty].label}</strong></div>
         <div>Time: <strong>${m}m ${s}s</strong></div>
         <div>Moves: <strong>${moves}</strong></div>
         <div>Score: <strong>${score}</strong></div>`;
      document.getElementById("win-modal").classList.remove("hidden");
    }
  }

  function pause() {
    if (gameWon || isPaused) return;
    isPaused = true;
    pausedAt = Date.now();
    clearInterval(timerInterval);
    document.getElementById("pause-screen").classList.remove("hidden");
  }

  function resume() {
    if (!isPaused) return;
    totalPaused += Date.now() - pausedAt;
    pausedAt = null;
    isPaused = false;
    timerInterval = setInterval(updateTimer, 1000);
    document.getElementById("pause-screen").classList.add("hidden");
  }

  function openTutorial(step = 0) {
    tutStep = step;
    renderTutorial();
    document.getElementById("tutorial-modal").classList.remove("hidden");
  }

  function renderTutorial() {
    const step = TUTORIAL[tutStep];
    document.getElementById("tutorial-content").innerHTML =
      `<h3>${step.title}</h3>${step.html}`;
    document.getElementById("tut-prev").style.visibility = tutStep === 0 ? "hidden" : "visible";
    document.getElementById("tut-next").textContent =
      tutStep === TUTORIAL.length - 1 ? "Got it" : "Next";
    const dots = document.getElementById("tut-dots");
    dots.innerHTML = TUTORIAL.map((_, i) =>
      `<span class="dot${i === tutStep ? " active" : ""}"></span>`
    ).join("");
  }

  function closeTutorial() {
    document.getElementById("tutorial-modal").classList.add("hidden");
  }

  function startGame(diff) {
    difficulty = diff;
    const cfg = DIFFICULTY[diff];
    drawCount = cfg.draw;
    maxPasses = cfg.maxPasses;
    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("game-app").classList.remove("hidden");
    document.getElementById("win-modal").classList.add("hidden");
    document.getElementById("pause-screen").classList.add("hidden");
    document.getElementById("menu-modal").classList.add("hidden");
    deal();
  }

  function showStartScreen() {
    document.getElementById("game-app").classList.add("hidden");
    document.getElementById("win-modal").classList.add("hidden");
    document.getElementById("pause-screen").classList.add("hidden");
    document.getElementById("menu-modal").classList.add("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
    if (timerInterval) clearInterval(timerInterval);
  }

  function setupListeners() {
    document.querySelectorAll("[data-diff]").forEach(btn => {
      btn.addEventListener("click", () => startGame(btn.dataset.diff));
    });

    document.getElementById("open-tutorial-start").addEventListener("click", () => openTutorial(0));
    document.getElementById("pause-btn").addEventListener("click", pause);
    document.getElementById("resume-btn").addEventListener("click", resume);
    document.getElementById("new-from-pause").addEventListener("click", () => {
      resume();
      showStartScreen();
    });
    document.getElementById("tutorial-from-pause").addEventListener("click", () => {
      document.getElementById("pause-screen").classList.add("hidden");
      openTutorial(0);
    });

    document.getElementById("undo").addEventListener("click", undo);
    document.getElementById("hint-btn").addEventListener("click", showHint);
    document.getElementById("auto-btn").addEventListener("click", runAutoComplete);

    document.getElementById("play-again").addEventListener("click", () => startGame(difficulty));
    document.getElementById("change-diff").addEventListener("click", showStartScreen);

    document.getElementById("close-tutorial").addEventListener("click", closeTutorial);
    document.getElementById("tut-prev").addEventListener("click", () => {
      if (tutStep > 0) { tutStep--; renderTutorial(); }
    });
    document.getElementById("tut-next").addEventListener("click", () => {
      if (tutStep < TUTORIAL.length - 1) { tutStep++; renderTutorial(); }
      else closeTutorial();
    });

    document.getElementById("menu-btn").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.remove("hidden");
    });
    document.getElementById("menu-close").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.add("hidden");
    });
    document.getElementById("menu-new").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.add("hidden");
      startGame(difficulty);
    });
    document.getElementById("menu-diff").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.add("hidden");
      showStartScreen();
    });
    document.getElementById("menu-tutorial").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.add("hidden");
      openTutorial(0);
    });

    document.getElementById("stock").addEventListener("click", handlePileClick);
    document.getElementById("waste").addEventListener("click", handlePileClick);
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`foundation-${i}`);
      el.addEventListener("click", handlePileClick);
      el.addEventListener("dragover", onDragOver);
      el.addEventListener("dragenter", onDragEnter);
      el.addEventListener("dragleave", onDragLeave);
      el.addEventListener("drop", onDrop);
    }
    for (let i = 0; i < 7; i++) {
      const el = document.getElementById(`tableau-${i}`);
      el.addEventListener("click", handlePileClick);
      el.addEventListener("dragover", onDragOver);
      el.addEventListener("dragenter", onDragEnter);
      el.addEventListener("dragleave", onDragLeave);
      el.addEventListener("drop", onDrop);
    }

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        if (!document.getElementById("tutorial-modal").classList.contains("hidden")) closeTutorial();
        else if (!document.getElementById("menu-modal").classList.contains("hidden"))
          document.getElementById("menu-modal").classList.add("hidden");
        else if (isPaused) resume();
        else if (!document.getElementById("game-app").classList.contains("hidden")) pause();
      }
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
      if (e.key === "h" || e.key === "H") showHint();
    });
  }

  setupListeners();
})();
