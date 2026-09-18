/* v12: high scores + win streaks + version reload */
(function () {
  var VER = "12";
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
    if (hs.streak > 0) parts.push("🔥 Streak: <b>" + hs.streak + "</b>");
    if (hs.bestStreak > 0) parts.push("Best streak: <b>" + hs.bestStreak + "</b>");
    if (hs.bestTime != null) {
      var m = Math.floor(hs.bestTime / 60), s = hs.bestTime % 60;
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
        hs.bestTime = elapsed; improved.push("time");
      }
      if (moves != null && (hs.bestMoves == null || moves < hs.bestMoves)) {
        hs.bestMoves = moves; improved.push("moves");
      }
      if (score != null && (hs.bestScore == null || score > hs.bestScore)) {
        hs.bestScore = score; improved.push("score");
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

  // Reset streak when starting a new game after a loss isn't easy to detect;
  // reset streak if user opens start screen without winning (menu new game)
  function hookNewGame() {
    document.querySelectorAll("[data-diff], #menu-new, #play-again, #new-from-pause").forEach(function (btn) {
      btn.addEventListener("click", function () {
        // play-again continues streak; only reset on explicit abandon via change difficulty
      });
    });
    var changeDiff = document.getElementById("change-diff");
    var menuDiff = document.getElementById("menu-diff");
    function resetStreak() {
      var hs = loadHS();
      hs.streak = 0;
      saveHS(hs);
      showHS();
    }
    if (changeDiff) changeDiff.addEventListener("click", resetStreak);
    if (menuDiff) menuDiff.addEventListener("click", resetStreak);
  }

  function boot() {
    showHS();
    watchWin();
    hookNewGame();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
