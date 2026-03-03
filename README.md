# ⚡ Tic Tac Toe — Multiplayer Neon Edition

A sleek, real-time **two-player multiplayer** Tic Tac Toe game powered by **Firebase Realtime Database** — built with vanilla **HTML**, **CSS**, and **JavaScript**. No frameworks, just clean modular Firebase v10 code.

---

## 🎮 Features

### Multiplayer
- **Create Room** — Host a game and get a unique 6-character Room ID
- **Join Room** — Enter a friend's Room ID to join their game instantly
- **Real-time sync** — All moves, turns, and results sync live via Firebase `onValue` listener
- **Firebase as source of truth** — No local state drift; every action reads from the database
- **Room sharing via URL** — Append `?room=ROOMID` to the URL and share with a friend
- **Auto-cleanup on disconnect** — Uses `onDisconnect()` to remove player data when a tab closes

### Gameplay
- **Turn enforcement** — Only the current turn's player can make a move
- **Win detection** — All 8 winning combinations checked after every move; winning cells glow gold
- **Draw detection** — Recognizes a full board with no winner
- **Animated result overlay** — Smooth modal announces winner or draw (no `alert()`)
- **Score tracking** — Scores persist across rounds within a session
- **New Round** — Resets the board via Firebase while keeping scores
- **Leave Room** — Deletes the room from Firebase and returns both players to the lobby

### Edge Case Handling
- Invalid Room ID → error message shown
- Room already full → error message shown
- Playing out of turn → move is blocked
- Cell already filled → move is blocked
- Room deleted mid-game → both players returned to lobby with a notification

---

## 🖼️ UI Highlights

- Dark cosmic background with radial gradient glow
- Neon color system: **Cyan** for X · **Violet** for O · **Gold** for wins
- Glassmorphism cards with backdrop blur
- Score cards glow on the active player's side
- Cell pop-in animation on play, pulse animation on winning cells
- Waiting screen with bouncing hourglass and copy-to-clipboard Room ID
- Room badge in the game header showing the active Room ID
- [`Outfit`](https://fonts.google.com/specimen/Outfit) Google Font — modern, bold, geometric
- Fully responsive down to 400 px screens

---

## 🗂️ Project Structure

```
TicTacToc/
├── index.html   # App shell — Lobby, Waiting, Game, Result screens
├── style.css    # Dark neon design system, animations, multiplayer UI
├── script.js    # Firebase multiplayer logic (ES module)
└── README.md    # This file
```

---

## 🔧 Firebase Setup

This project uses **Firebase Realtime Database** with the **v10 modular SDK** loaded via CDN ESM imports.

### Prerequisites
1. A Firebase project with **Realtime Database** enabled
2. Your `firebaseConfig` object (already embedded in `script.js`)

### Database Structure

```
rooms/
  └── {roomId}/
        ├── board: [null, null, null, null, null, null, null, null, null]
        ├── turn: "X" | "O"
        ├── winner: null | "X" | "O" | "draw"
        ├── players/
        │     ├── X: "PlayerName"
        │     └── O: "PlayerName" | null
        └── createdAt: timestamp
```

### Database Rules (Recommended)

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> ⚠️ These rules are open for development. For production, add authentication and validation rules.

---

## 🚀 Getting Started

Since the app uses ES module imports (`type="module"`), it **must be served via HTTP**, not opened as a `file://` URL.

```bash
# Option 1 — VS Code Live Server (recommended)
Right-click index.html → "Open with Live Server"

# Option 2 — npx serve
npx -y serve . -l 3000
# Then open http://localhost:3000

# Option 3 — Python
python -m http.server 3000
# Then open http://localhost:3000
```

> **Browser support:** Any modern browser (Chrome, Firefox, Edge, Safari). Requires an internet connection for Firebase and Google Fonts.

---

## 🧠 How It Works

| Concern | Approach |
|---|---|
| Game state | Firebase Realtime Database — single source of truth |
| Room creation | `set()` writes initial room structure |
| Joining a room | `update()` adds the second player |
| Making moves | `update()` patches `board/{index}` and `turn` |
| Real-time sync | `onValue()` listener updates UI on every change |
| Win/draw check | Runs client-side, then writes `winner` to Firebase |
| Board reset | `update()` resets `board`, `turn`, and `winner` |
| Room deletion | `remove()` clears the room node |
| Disconnect handling | `onDisconnect().remove()` auto-cleans player slot |
| Screen routing | CSS class toggling (`active` / `hidden`) |
| Animations | Pure CSS `@keyframes` — no animation libraries |

### Core Functions

| Function | Purpose |
|---|---|
| `createRoom(playerName)` | Creates a new room in Firebase, assigns player as X |
| `joinRoom(roomId, playerName)` | Joins an existing room as O |
| `listenToRoom(roomId)` | Subscribes to real-time updates via `onValue` |
| `makeMove(index)` | Validates and pushes a move to Firebase |
| `resetBoard()` | Clears board in Firebase for a new round |
| `deleteRoom()` | Removes the room from Firebase entirely |

---

## 🛠️ Possible Enhancements

- [ ] Single-player mode with a simple AI (minimax)
- [ ] Sound effects on moves and wins
- [ ] Best-of-N series mode
- [ ] Confetti animation on win
- [ ] Chat between players during a game
- [ ] Spectator mode (read-only room access)
- [ ] Player authentication with Firebase Auth

---

## 📄 License

This project is open source and free to use for any purpose.
#
