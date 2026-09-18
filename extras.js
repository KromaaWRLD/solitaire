/* v10 extras: high scores + force fresh load */
(function () {
  var VER = "10";
  try {
    var old = localStorage.getItem("solitaire_ver");
    if (old && old !== VER) {
      localStorage.setItem("solitaire_ver", VER);
      location.reload(true);
      return;
    }
    localStorage.setItem("solitaire_ver", VER);
  } catch (e) {}

  function loadHS() {
    try { return JSON.parse(localStorage.getItem("solitaire_hs") || "{}"); }
    catch (e) { return {}; }
  }
  function saveHS(hs) {
    try { localStorage.setItem("solitaire_hs", JSON.stringify(hs)); } catch (e) {}
  }
  function showHS() {
    var el = document.getElementById("highscores");
    if (!el) return;
    var hs = loadHS();
    var parts = [];
    if (hs.bestTime != null) {
      var m = Math.floor(hs.bestTime / 60), s = hs.bestTime % 60;
      parts.push("Best time: <b>" + m + ":" + String(s).padStart(2, "0") + "</b>");
    }
    if (hs.bestMoves != null) parts.push("Fewest moves: <b>" + hs.bestMoves + "</b>");
    if (hs.bestScore != null) parts.push("Top score: <b>" + hs.bestScore + "</b>");
    el.innerHTML = parts.length ? parts.join(" · ") : "No wins yet — beat the game!";
  }

  // Watch win modal and record high scores from the stats text
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
      if (elapsed != null && (hs.bestTime == null || elapsed < hs.bestTime)) {
        hs.bestTime = elapsed; improved.push("time");
      }
      if (moves != null && (hs.bestMoves == null || moves < hs.bestMoves)) {
        hs.bestMoves = moves; improved.push("moves");
      }
      if (score != null && (hs.bestScore == null || score > hs.bestScore)) {
        hs.bestScore = score; improved.push("score");
      }
      saveHS(hs);
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { showHS(); watchWin(); });
  } else {
    showHS();
    watchWin();
  }
})();
