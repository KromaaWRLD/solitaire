/* v14: pointer-drag overlay + invalid toasts + streaks + version */
(function () {
  var VER = "14";
  try {
    var old = localStorage.getItem("solitaire_ver");
    if (old && old !== VER) {
      localStorage.setItem("solitaire_ver", VER);
      location.reload(true);
      return;
    }
    localStorage.setItem("solitaire_ver", VER);
  } catch (e) {}

  function showToast(msg, ms) {
    ms = ms || 2600;
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.style.cssText =
        "position:fixed;bottom:28px;left:50%;transform:translateX(-50%);" +
        "background:rgba(20,20,20,0.94);color:#fff;padding:12px 22px;border-radius:10px;" +
        "font-size:0.95rem;z-index:99999;max-width:92vw;text-align:center;" +
        "box-shadow:0 8px 24px rgba(0,0,0,0.45);pointer-events:none;opacity:0;" +
        "transition:opacity 0.2s;line-height:1.45;font-family:system-ui,sans-serif";
      document.body.appendChild(el);
    }
    el.innerHTML = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.style.opacity = "0";
    }, ms);
  }
  window.showToast = showToast;

  function loadHS() {
    try {
      return JSON.parse(localStorage.getItem("solitaire_hs") || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveHS(hs) {
    try {
      localStorage.setItem("solitaire_hs", JSON.stringify(hs));
    } catch (e) {}
  }
  function showHS() {
    var el = document.getElementById("highscores");
    if (!el) return;
    var hs = loadHS();
    var parts = [];
    if (hs.streak > 0) parts.push("🔥 Streak: <b>" + hs.streak + "</b>");
    if (hs.bestStreak > 0) parts.push("Best streak: <b>" + hs.bestStreak + "</b>");
    if (hs.bestTime != null) {
      var m = Math.floor(hs.bestTime / 60),
        s = hs.bestTime % 60;
      parts.push("Best time: <b>" + m + ":" + String(s).padStart(2, "0") + "</b>");
    }
    if (hs.bestMoves != null) parts.push("Fewest moves: <b>" + hs.bestMoves + "</b>");
    if (hs.bestScore != null) parts.push("Top score: <b>" + hs.bestScore + "</b>");
    el.innerHTML = parts.length ? parts.join(" · ") : "No wins yet — beat the game!";
  }
  function watchWin() {
    var modal = document.getElementById("win-modal");
    if (!modal) return;
    var obs = new MutationObserver(function () {
      if (modal.classList.contains("hidden")) return;
      var stats = document.getElementById("win-stats");
      if (!stats || stats.dataset.recorded) return;
      stats.dataset.recorded = "1";
      var text = stats.textContent || "";
      var timeM = text.match(/(\d+)\s*m\s*(\d+)\s*s/i);
      var movesM = text.match(/Moves:\s*(\d+)/i);
      var scoreM = text.match(/Score:\s*(\d+)/i);
      var elapsed = timeM ? parseInt(timeM[1], 10) * 60 + parseInt(timeM[2], 10) : null;
      var moves = movesM ? parseInt(movesM[1], 10) : null;
      var score = scoreM ? parseInt(scoreM[1], 10) : null;
      var hs = loadHS();
      var improved = [];
      hs.streak = (hs.streak || 0) + 1;
      if (!hs.bestStreak || hs.streak > hs.bestStreak) {
        hs.bestStreak = hs.streak;
        improved.push("streak");
      }
      if (elapsed != null && (hs.bestTime == null || elapsed < hs.bestTime)) {
        hs.bestTime = elapsed;
        improved.push("time");
      }
      if (moves != null && (hs.bestMoves == null || moves < hs.bestMoves)) {
        hs.bestMoves = moves;
        improved.push("moves");
      }
      if (score != null && (hs.bestScore == null || score > hs.bestScore)) {
        hs.bestScore = score;
        improved.push("score");
      }
      saveHS(hs);
      var streakLine = document.createElement("div");
      streakLine.innerHTML = "Win streak: <strong>" + hs.streak + "</strong> 🔥";
      stats.appendChild(streakLine);
      if (improved.length) {
        var badge = document.createElement("div");
        badge.style.cssText = "color:#0d7a4f;font-weight:700;margin-top:8px";
        badge.textContent = "🏆 New record: " + improved.join(", ") + "!";
        stats.appendChild(badge);
      }
      showHS();
    });
    obs.observe(modal, { attributes: true, attributeFilter: ["class"] });
  }
  function hookDiff() {
    function resetStreak() {
      var hs = loadHS();
      hs.streak = 0;
      saveHS(hs);
      showHS();
    }
    var a = document.getElementById("change-diff");
    var b = document.getElementById("menu-diff");
    if (a) a.addEventListener("click", resetStreak);
    if (b) b.addEventListener("click", resetStreak);
  }

  var drag = null;

  function cardLabel(el) {
    if (!el) return "card";
    var r = el.querySelector(".corner span:first-child");
    var s = el.querySelector(".corner span:last-child");
    return ((r && r.textContent) || "") + ((s && s.textContent) || "") || "card";
  }

  function explainInvalid(cardEl, targetPile) {
    var label = cardLabel(cardEl);
    if (!targetPile) return "Drop on a column or foundation.";
    if (targetPile.classList.contains("stock"))
      return "Don't drop on the stock — click it to draw.";
    if (targetPile.classList.contains("waste"))
      return "You can't put cards back on the waste.";
    if (targetPile.classList.contains("foundation")) {
      return (
        "Can't place <b>" +
        label +
        "</b> there. Foundations build <b>Ace → King</b> in the <b>same suit</b>."
      );
    }
    if (targetPile.classList.contains("tableau-col")) {
      var cards = targetPile.querySelectorAll(".card.face-up");
      if (!cards.length) {
        return "Empty column needs a <b>King</b>. (" + label + " isn't a King.)";
      }
      return (
        "Can't place <b>" +
        label +
        "</b> there. Columns need <b>alternating colors</b> and one rank lower."
      );
    }
    return "Invalid move.";
  }

  function makeGhost(cardEl) {
    var g = cardEl.cloneNode(true);
    g.classList.remove("selected", "dragging");
    g.style.position = "fixed";
    g.style.margin = "0";
    g.style.zIndex = "99998";
    g.style.pointerEvents = "none";
    g.style.opacity = "0.95";
    g.style.boxShadow = "0 16px 32px rgba(0,0,0,0.5)";
    g.style.transition = "none";
    var pile = cardEl.closest(".tableau-col");
    if (pile) {
      var kids = Array.prototype.slice.call(pile.querySelectorAll(".card"));
      var idx = kids.indexOf(cardEl);
      if (idx >= 0) {
        var top = parseFloat(cardEl.style.top) || 0;
        for (var i = idx + 1; i < kids.length; i++) {
          if (!kids[i].classList.contains("face-up")) break;
          var c = kids[i].cloneNode(true);
          c.style.position = "absolute";
          c.style.top = (parseFloat(kids[i].style.top) || 0) - top + "px";
          c.style.left = "0";
          c.style.margin = "0";
          c.style.pointerEvents = "none";
          g.appendChild(c);
        }
      }
    }
    document.body.appendChild(g);
    return g;
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    var cardEl = e.currentTarget;
    if (!cardEl.classList.contains("face-up")) return;
    var waste = cardEl.closest("#waste");
    if (waste) {
      var all = waste.querySelectorAll(".card");
      if (all.length && all[all.length - 1] !== cardEl) {
        showToast("❌ Only the <b>top</b> waste card can be played.");
        return;
      }
    }
    e.preventDefault();
    e.stopPropagation();
    try {
      cardEl.setPointerCapture(e.pointerId);
    } catch (_) {}
    var rect = cardEl.getBoundingClientRect();
    drag = {
      cardEl: cardEl,
      startX: e.clientX,
      startY: e.clientY,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      ghost: null,
      moved: false,
      pointerId: e.pointerId,
    };
    cardEl.addEventListener("pointermove", onPointerMove);
    cardEl.addEventListener("pointerup", onPointerUp);
    cardEl.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e) {
    if (!drag) return;
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.ghost = makeGhost(drag.cardEl);
      drag.cardEl.style.opacity = "0.35";
      var pile = drag.cardEl.closest(".tableau-col");
      if (pile) {
        var kids = Array.prototype.slice.call(pile.querySelectorAll(".card"));
        var idx = kids.indexOf(drag.cardEl);
        for (var i = idx + 1; i < kids.length; i++) kids[i].style.opacity = "0.35";
      }
    }
    if (drag.ghost) {
      drag.ghost.style.left = e.clientX - drag.ox + "px";
      drag.ghost.style.top = e.clientY - drag.oy + "px";
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    var cardEl = drag.cardEl;
    cardEl.removeEventListener("pointermove", onPointerMove);
    cardEl.removeEventListener("pointerup", onPointerUp);
    cardEl.removeEventListener("pointercancel", onPointerUp);
    try {
      cardEl.releasePointerCapture(drag.pointerId);
    } catch (_) {}

    var wasDrag = drag.moved;
    var ghost = drag.ghost;
    var x = e.clientX;
    var y = e.clientY;

    if (ghost) ghost.style.visibility = "hidden";
    var under = document.elementFromPoint(x, y);
    if (ghost) ghost.remove();
    document.querySelectorAll(".card").forEach(function (c) {
      c.style.opacity = "";
    });

    if (wasDrag) {
      var targetPile = under && under.closest(".tableau-col, .foundation, .stock, .waste");
      var fromPile = cardEl.closest(".pile");
      if (targetPile && targetPile !== fromPile) {
        var beforeMoves = (document.getElementById("moves") || {}).textContent;
        cardEl.click();
        setTimeout(function () {
          if (targetPile.classList.contains("tableau-col") || targetPile.classList.contains("foundation")) {
            var topCard = null;
            var cs = targetPile.querySelectorAll(".card");
            if (cs.length) topCard = cs[cs.length - 1];
            if (topCard) topCard.click();
            else targetPile.click();
          }
          setTimeout(function () {
            var afterMoves = (document.getElementById("moves") || {}).textContent;
            var stillSelected = document.querySelector(".card.selected");
            if (afterMoves === beforeMoves) {
              showToast("❌ Invalid — " + explainInvalid(cardEl, targetPile));
              if (stillSelected) stillSelected.click();
            }
          }, 40);
        }, 10);
      }
    }
    drag = null;
  }

  function bindCard(el) {
    if (el.dataset.pdBound) return;
    el.dataset.pdBound = "1";
    el.style.cursor = "grab";
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("dragstart", function (ev) {
      ev.preventDefault();
    });
    el.setAttribute("draggable", "false");
  }

  function rebindAll() {
    document.querySelectorAll(".card.face-up").forEach(bindCard);
  }

  function watchBoard() {
    var board = document.querySelector(".board") || document.getElementById("game-app") || document.body;
    var obs = new MutationObserver(function () {
      rebindAll();
    });
    obs.observe(board, { childList: true, subtree: true });
    rebindAll();
    setInterval(rebindAll, 800);
  }

  function boot() {
    showHS();
    watchWin();
    hookDiff();
    watchBoard();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
