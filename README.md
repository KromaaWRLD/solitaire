# ♠ Klondike Solitaire ♥

A polished, Google-style **Klondike Solitaire** that runs entirely in the browser. No build step, no dependencies.

**[Play it live →](https://kromaawrld.github.io/solitaire/)**

## Features

- **Three difficulties**
  - **Easy** – Draw 1, unlimited passes
  - **Medium** – Draw 3, unlimited passes
  - **Hard** – Draw 3, only 3 passes through the stock
- **Auto-complete (Finish)** – When every card is face-up, tap **Finish** to automatically move remaining cards to the foundations (moves are counted)
- **Pause** – Freeze the timer anytime
- **Tutorial** – Built-in step-by-step guide
- **Hint** – Highlights a useful move
- **Undo** – With full history
- Card flip & deal animations
- High-contrast, easy-to-read cards
- Score + timer + move counter
- Drag-and-drop or click-to-move
- Double-click to send a card to the foundation
- Fully responsive (phone & desktop)

## Controls

| Action | How |
|--------|-----|
| Draw | Click the stock |
| Move | Drag, or click source then destination |
| Auto to foundation | Double-click a card |
| Finish game | **Finish** button (appears when all cards are face-up) |
| Hint | **Hint** button or press `H` |
| Undo | **Undo** or `Ctrl/Cmd + Z` |
| Pause | ⏸ button or `Esc` |
| Tutorial | Menu → Tutorial |

## Run locally

Open `index.html` in any modern browser, or:

```bash
npx serve .
```

## GitHub Pages

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch** → `main` / root
3. Live at `https://<username>.github.io/solitaire/`

## License

MIT
