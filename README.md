# ♠ Klondike Solitaire ♥

A clean, fully playable **Klondike Solitaire** game that runs entirely in your browser. No build step, no dependencies.

**[Play it live →](https://kromaawrld.github.io/solitaire/)**

## Features

- Classic Klondike rules
- **Draw 1** or **Draw 3** modes
- Drag-and-drop **or** click-to-move
- Double-click a card to send it to the foundation
- Undo
- Move counter & timer
- Responsive design (works on phone & desktop)
- Win detection with celebration modal

## How to Play

1. Build the four foundation piles (A → K, same suit).
2. Tableau: build down in alternating colors.
3. Only Kings can be placed in empty tableau columns.
4. Click the stock to draw cards.
5. When the stock is empty, click it again to recycle the waste pile.

## Controls

| Action              | How                          |
|---------------------|------------------------------|
| Draw cards          | Click the stock pile         |
| Move cards          | Drag or click source → target|
| Auto to foundation  | Double-click a card          |
| Undo                | Click **Undo** button        |
| New game            | Click **New Game**           |

## Run Locally

Just open `index.html` in any modern browser, or serve the folder:

```bash
npx serve .
# or
python -m http.server
```

## Deploy on GitHub Pages

1. Go to the repository **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / root
4. Save — your game will be live at `https://<username>.github.io/solitaire/`

## License

MIT — do whatever you want with it.
