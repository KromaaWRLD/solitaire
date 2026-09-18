(() => {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));

  // ─── State ───────────────────────────────────────────────────
  let stock = [];
  let waste = [];
  let foundations = [[], [], [], []]; // one per suit index
  let tableau = [[], [], [], [], [], [], []];
  let drawCount = 1;
  let selected = null; // { cards: Card[], from: {type, index}, sourceEl }
  let history = [];
  let moves = 0;
  let startTime = null;
  let timerInterval = null;
  let gameWon = false;

  // ─── Card model ──────────────────────────────────────────────
  function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          suit,
          rank,
          value: RANK_VALUE[rank],
          color: suit === "♥" || suit === "♦" ? "red" : "black",
          faceUp: false,
          id: `${rank}${suit}`,
        });
      }
    }
    return shuffle(deck);
  }

  function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── Deal ────────────────────────────────────────────────────
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
    gameWon = false;
    startTime = Date.now();
    updateTimer();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    render();
    updateUI();
  }

  // ─── Rules helpers ───────────────────────────────────────────
  function canPlaceOnTableau(card, targetCol) {
    const pile = tableau[targetCol];
    if (pile.length === 0) return card.rank === "K";
    const top = pile[pile.length - 1];
    return top.faceUp && card.color !== top.color && card.value === top.value - 1;
  }

  function canPlaceOnFoundation(card, foundationIndex) {
    const pile = foundations[foundationIndex];
    if (pile.length === 0) return card.rank === "A";
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === top.value + 1;
  }

  function findFoundationFor(card) {
    for (let i = 0; i < 4; i++) {
      if (canPlaceOnFoundation(card, i)) return i;
    }
    return -1;
  }

  // ─── History / Undo ──────────────────────────────────────────
  function pushHistory(action) {
    history.push(action);
    if (history.length > 100) history.shift();
  }

  function undo() {
    if (history.length === 0 || gameWon) return;
    const action = history.pop();
    applyUndo(action);
    moves = Math.max(0, moves - 1);
    selected = null;
    render();
    updateUI();
  }

  function applyUndo(action) {
    switch (action.type) {
      case "draw": {
        // Move cards from waste back to stock (in reverse order)
        for (let i = 0; i < action.count; i++) {
          const card = waste.pop();
          if (card) {
            card.faceUp = false;
            stock.push(card);
          }
        }
        break;
      }
      case "recycle": {
        // Waste was emptied into stock; reverse it
        while (stock.length) {
          const card = stock.pop();
          card.faceUp = true;
          waste.push(card);
        }
        break;
      }
      case "move": {
        // Move cards back from dest to source
        const { cards, from, to } = action;
        // Remove from destination
        if (to.type === "tableau") {
          tableau[to.index].splice(tableau[to.index].length - cards.length, cards.length);
        } else if (to.type === "foundation") {
          foundations[to.index].pop();
        } else if (to.type === "waste") {
          waste.pop();
        }
        // Restore face state of source top if needed
        if (from.type === "tableau" && from.wasFlipped) {
          const pile = tableau[from.index];
          if (pile.length) pile[pile.length - 1].faceUp = false;
        }
        // Put cards back
        if (from.type === "tableau") {
          tableau[from.index].push(...cards);
        } else if (from.type === "waste") {
          waste.push(...cards);
        } else if (from.type === "foundation") {
          foundations[from.index].push(...cards);
        }
        break;
      }
    }
  }

  // ─── Moves ───────────────────────────────────────────────────
  function drawFromStock() {
    if (gameWon) return;
    clearSelection();

    if (stock.length === 0) {
      if (waste.length === 0) return;
      // Recycle waste → stock
      pushHistory({ type: "recycle" });
      while (waste.length) {
        const card = waste.pop();
        card.faceUp = false;
        stock.push(card);
      }
      moves++;
      render();
      updateUI();
      return;
    }

    const count = Math.min(drawCount, stock.length);
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const card = stock.pop();
      card.faceUp = true;
      waste.push(card);
      drawn.push(card);
    }
    pushHistory({ type: "draw", count });
    moves++;
    render();
    updateUI();
  }

  function moveCards(cards, from, to) {
    // Remove from source
    if (from.type === "tableau") {
      tableau[from.index].splice(tableau[from.index].length - cards.length, cards.length);
      // Flip new top if needed
      const pile = tableau[from.index];
      if (pile.length && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
        from.wasFlipped = true;
      }
    } else if (from.type === "waste") {
      waste.pop();
    } else if (from.type === "foundation") {
      foundations[from.index].pop();
    }

    // Add to destination
    if (to.type === "tableau") {
      tableau[to.index].push(...cards);
    } else if (to.type === "foundation") {
      foundations[to.index].push(cards[0]); // only single card
    }

    pushHistory({ type: "move", cards: cards.map(c => ({ ...c })), from: { ...from }, to: { ...to } });
    moves++;
    clearSelection();
    render();
    updateUI();
    checkWin();
  }

  function tryAutoMoveToFoundation(card, from) {
    const fi = findFoundationFor(card);
    if (fi === -1) return false;
    // Only auto-move single cards
    moveCards([card], from, { type: "foundation", index: fi });
    return true;
  }

  // ─── Selection & interaction ─────────────────────────────────
  function clearSelection() {
    selected = null;
    document.querySelectorAll(".card.selected").forEach(el => el.classList.remove("selected"));
    document.querySelectorAll(".pile.valid-drop").forEach(el => el.classList.remove("valid-drop"));
  }

  function selectCards(cards, from) {
    clearSelection();
    selected = { cards, from };
    // Highlight will be applied in render or via classes after
  }

  function getMovableStack(colIndex, startIndex) {
    const pile = tableau[colIndex];
    if (startIndex >= pile.length || !pile[startIndex].faceUp) return null;
    const stack = pile.slice(startIndex);
    // Validate sequential descending alternating
    for (let i = 1; i < stack.length; i++) {
      if (
        stack[i].color === stack[i - 1].color ||
        stack[i].value !== stack[i - 1].value - 1
      ) {
        return null;
      }
    }
    return stack;
  }

  function handleCardClick(e) {
    if (gameWon) return;
    e.stopPropagation();
    const cardEl = e.currentTarget;
    const location = cardEl.dataset.location;
    const col = parseInt(cardEl.dataset.col, 10);
    const idx = parseInt(cardEl.dataset.idx, 10);

    // Double-click → try foundation
    if (e.detail === 2) {
      clearSelection();
      let card, from;
      if (location === "waste") {
        if (waste.length === 0) return;
        card = waste[waste.length - 1];
        from = { type: "waste" };
      } else if (location === "tableau") {
        const pile = tableau[col];
        if (idx !== pile.length - 1 || !pile[idx].faceUp) return;
        card = pile[idx];
        from = { type: "tableau", index: col };
      } else if (location === "foundation") {
        return; // don't auto from foundation usually
      }
      if (card) tryAutoMoveToFoundation(card, from);
      return;
    }

    // Single click
    if (location === "stock") {
      drawFromStock();
      return;
    }

    if (!cardEl.classList.contains("face-up") && location !== "stock") return;

    // If something already selected → try to drop
    if (selected) {
      attemptDrop(location, col);
      return;
    }

    // Select
    if (location === "waste") {
      if (waste.length === 0) return;
      const card = waste[waste.length - 1];
      selectCards([card], { type: "waste" });
      cardEl.classList.add("selected");
    } else if (location === "tableau") {
      const stack = getMovableStack(col, idx);
      if (!stack) return;
      selectCards(stack, { type: "tableau", index: col });
      // Highlight all cards in the stack
      const pileEl = document.getElementById(`tableau-${col}`);
      const cards = pileEl.querySelectorAll(".card");
      for (let i = idx; i < cards.length; i++) {
        cards[i].classList.add("selected");
      }
    } else if (location === "foundation") {
      const pile = foundations[col];
      if (pile.length === 0) return;
      const card = pile[pile.length - 1];
      selectCards([card], { type: "foundation", index: col });
      cardEl.classList.add("selected");
    }
  }

  function attemptDrop(location, col) {
    if (!selected) return;
    const { cards, from } = selected;

    if (location === "tableau") {
      if (canPlaceOnTableau(cards[0], col)) {
        moveCards(cards, from, { type: "tableau", index: col });
        return;
      }
    } else if (location === "foundation") {
      if (cards.length === 1 && canPlaceOnFoundation(cards[0], col)) {
        moveCards(cards, from, { type: "foundation", index: col });
        return;
      }
    }

    // Invalid drop → just deselect
    clearSelection();
  }

  function handlePileClick(e) {
    if (gameWon) return;
    const pileEl = e.currentTarget;
    if (pileEl.id === "stock") {
      drawFromStock();
      return;
    }
    if (!selected) return;

    if (pileEl.classList.contains("tableau-col")) {
      const col = parseInt(pileEl.id.replace("tableau-", ""), 10);
      attemptDrop("tableau", col);
    } else if (pileEl.classList.contains("foundation")) {
      const col = parseInt(pileEl.id.replace("foundation-", ""), 10);
      attemptDrop("foundation", col);
    }
  }

  // ─── Drag & Drop (HTML5) ─────────────────────────────────────
  let dragData = null;

  function onDragStart(e) {
    if (gameWon) {
      e.preventDefault();
      return;
    }
    const cardEl = e.target.closest(".card");
    if (!cardEl || !cardEl.classList.contains("face-up")) {
      e.preventDefault();
      return;
    }

    const location = cardEl.dataset.location;
    const col = parseInt(cardEl.dataset.col, 10);
    const idx = parseInt(cardEl.dataset.idx, 10);

    let cards, from;
    if (location === "waste") {
      cards = [waste[waste.length - 1]];
      from = { type: "waste" };
    } else if (location === "tableau") {
      cards = getMovableStack(col, idx);
      if (!cards) {
        e.preventDefault();
        return;
      }
      from = { type: "tableau", index: col };
    } else if (location === "foundation") {
      cards = [foundations[col][foundations[col].length - 1]];
      from = { type: "foundation", index: col };
    } else {
      e.preventDefault();
      return;
    }

    dragData = { cards, from };
    cardEl.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cardEl.dataset.id); // required for Firefox
    // Slight delay so browser captures the drag image
    setTimeout(() => clearSelection(), 0);
  }

  function onDragEnd(e) {
    document.querySelectorAll(".card.dragging").forEach(el => el.classList.remove("dragging"));
    document.querySelectorAll(".pile.valid-drop").forEach(el => el.classList.remove("valid-drop"));
    dragData = null;
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDragEnter(e) {
    e.preventDefault();
    if (!dragData) return;
    const pile = e.currentTarget;
    let valid = false;
    if (pile.classList.contains("tableau-col")) {
      const col = parseInt(pile.id.replace("tableau-", ""), 10);
      valid = canPlaceOnTableau(dragData.cards[0], col);
    } else if (pile.classList.contains("foundation")) {
      const col = parseInt(pile.id.replace("foundation-", ""), 10);
      valid = dragData.cards.length === 1 && canPlaceOnFoundation(dragData.cards[0], col);
    }
    if (valid) pile.classList.add("valid-drop");
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove("valid-drop");
  }

  function onDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("valid-drop");
    if (!dragData) return;

    const pile = e.currentTarget;
    const { cards, from } = dragData;

    if (pile.classList.contains("tableau-col")) {
      const col = parseInt(pile.id.replace("tableau-", ""), 10);
      if (canPlaceOnTableau(cards[0], col)) {
        moveCards(cards, from, { type: "tableau", index: col });
      }
    } else if (pile.classList.contains("foundation")) {
      const col = parseInt(pile.id.replace("foundation-", ""), 10);
      if (cards.length === 1 && canPlaceOnFoundation(cards[0], col)) {
        moveCards(cards, from, { type: "foundation", index: col });
      }
    }
    dragData = null;
  }

  // ─── Rendering ───────────────────────────────────────────────
  function createCardElement(card, location, col, idx) {
    const el = document.createElement("div");
    el.className = `card ${card.color} ${card.faceUp ? "face-up" : "face-down"}`;
    el.dataset.id = card.id;
    el.dataset.location = location;
    el.dataset.col = col;
    el.dataset.idx = idx;
    el.draggable = card.faceUp;

    if (card.faceUp) {
      el.innerHTML = `
        <div class="corner top">
          <span>${card.rank}</span>
          <span>${card.suit}</span>
        </div>
        <div class="suit-center">${card.suit}</div>
        <div class="corner bottom">
          <span>${card.rank}</span>
          <span>${card.suit}</span>
        </div>
      `;
    }

    el.addEventListener("click", handleCardClick);
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("dragend", onDragEnd);
    return el;
  }

  function renderPile(container, cards, location, colIndex, offsetY = 0) {
    container.innerHTML = "";
    cards.forEach((card, i) => {
      const el = createCardElement(card, location, colIndex, i);
      el.style.top = `${offsetY + i * (location === "tableau" ? parseInt(getComputedStyle(document.documentElement).getPropertyValue("--overlap")) || 28 : 0)}px`;
      el.style.zIndex = i + 1;
      // Slight horizontal offset for waste when draw-3
      if (location === "waste" && drawCount === 3) {
        const visible = Math.min(3, cards.length);
        const start = cards.length - visible;
        if (i >= start) {
          el.style.left = `${(i - start) * 18}px`;
        } else {
          el.style.left = "0";
        }
      }
      container.appendChild(el);
    });
  }

  function render() {
    // Stock
    const stockEl = document.getElementById("stock");
    stockEl.innerHTML = "";
    stockEl.classList.toggle("empty", stock.length === 0);
    if (stock.length > 0) {
      // Show a face-down card representation
      const back = document.createElement("div");
      back.className = "card face-down";
      back.style.position = "relative";
      back.dataset.location = "stock";
      back.addEventListener("click", handleCardClick);
      stockEl.appendChild(back);
    }

    // Waste
    const wasteEl = document.getElementById("waste");
    renderPile(wasteEl, waste, "waste", 0);

    // Foundations
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`foundation-${i}`);
      renderPile(el, foundations[i], "foundation", i);
    }

    // Tableau
    for (let i = 0; i < 7; i++) {
      const el = document.getElementById(`tableau-${i}`);
      renderPile(el, tableau[i], "tableau", i);
    }
  }

  // ─── UI helpers ──────────────────────────────────────────────
  function updateTimer() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    document.getElementById("timer").textContent = `${m}:${s}`;
  }

  function updateUI() {
    document.getElementById("moves").textContent = `Moves: ${moves}`;
    document.getElementById("undo").disabled = history.length === 0 || gameWon;
  }

  function checkWin() {
    const total = foundations.reduce((sum, f) => sum + f.length, 0);
    if (total === 52) {
      gameWon = true;
      clearInterval(timerInterval);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      document.getElementById("win-stats").textContent =
        `Time: ${m}m ${s}s  •  Moves: ${moves}`;
      document.getElementById("win-modal").classList.remove("hidden");
    }
  }

  // ─── Event listeners ─────────────────────────────────────────
  function setupListeners() {
    document.getElementById("new-game").addEventListener("click", () => {
      document.getElementById("win-modal").classList.add("hidden");
      deal();
    });
    document.getElementById("play-again").addEventListener("click", () => {
      document.getElementById("win-modal").classList.add("hidden");
      deal();
    });
    document.getElementById("undo").addEventListener("click", undo);

    document.querySelectorAll('input[name="draw"]').forEach(radio => {
      radio.addEventListener("change", e => {
        drawCount = parseInt(e.target.value, 10);
        // Restart game when changing draw mode for fairness
        deal();
      });
    });

    // Pile click targets (empty areas)
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

    // Click on empty board deselects
    document.querySelector(".board").addEventListener("click", e => {
      if (e.target.classList.contains("board") || e.target.classList.contains("tableau") ||
          e.target.classList.contains("top-row")) {
        clearSelection();
      }
    });
  }

  // ─── Init ────────────────────────────────────────────────────
  setupListeners();
  deal();
})();
