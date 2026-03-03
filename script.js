/* ============================================================
   FIREBASE IMPORTS (v10 modular via CDN ESM)
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getDatabase, ref, set, update, onValue, remove, onDisconnect, get
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* ============================================================
   FIREBASE CONFIGURATION
   ============================================================ */
const firebaseConfig = {
    apiKey: "AIzaSyAEcVO7lw7_td1C2c_fS4YM398NgiqTAc4",
    authDomain: "vedant-first-project.firebaseapp.com",
    databaseURL: "https://vedant-first-project-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "vedant-first-project",
    storageBucket: "vedant-first-project.firebasestorage.app",
    messagingSenderId: "106861673673",
    appId: "1:106861673673:web:e150fac07f8766ff3b6118",
    measurementId: "G-0NH99CG9CZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ============================================================
   GAME CONSTANTS
   ============================================================ */
const WIN_PATTERNS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6],          // diagonals
];

/* ============================================================
   BOARD NORMALIZER
   Firebase drops null values from arrays, so sparse boards
   come back as objects or short arrays. This rebuilds a proper
   9-element array with null for empty cells.
   ============================================================ */
function normalizeBoard(raw) {
    const board = Array(9).fill(null);
    if (raw) {
        for (let i = 0; i < 9; i++) {
            if (raw[i]) board[i] = raw[i];
        }
    }
    return board;
}

/* ============================================================
   LOCAL STATE
   ============================================================ */
let myName = '';
let myMark = '';     // 'X' or 'O'
let roomId = null;
let roomRef = null;
let unsubscribe = null;   // onValue listener unsubscriber
let roomData = null;   // latest snapshot from Firebase
let localScores = { X: 0, O: 0 };
let localRound = 1;

/* ============================================================
   DOM REFS
   ============================================================ */
// Screens
const lobbyScreen = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const resultScreen = document.getElementById('result-screen');
const gameScreen = document.getElementById('game-screen');

// Lobby
const inputName = document.getElementById('input-name');
const createRoomBtn = document.getElementById('create-room-btn');
const inputRoomId = document.getElementById('input-room-id');
const joinRoomBtn = document.getElementById('join-room-btn');
const lobbyError = document.getElementById('lobby-error');

// Waiting
const displayRoomId = document.getElementById('display-room-id');
const copyRoomIdBtn = document.getElementById('copy-room-id-btn');
const cancelWaitBtn = document.getElementById('cancel-wait-btn');
const shareLinkHint = document.getElementById('share-link-hint');

// Result
const resultEmoji = document.getElementById('result-emoji');
const resultTitle = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');
const nextRoundBtn = document.getElementById('next-round-btn');
const endGameBtn = document.getElementById('end-game-btn');

// Game
const nameP1Display = document.getElementById('name-p1');
const nameP2Display = document.getElementById('name-p2');
const scoreP1Display = document.getElementById('score-val-p1');
const scoreP2Display = document.getElementById('score-val-p2');
const roundLabel = document.getElementById('round-label');
const turnIndicator = document.getElementById('turn-indicator');
const turnText = document.getElementById('turn-text');
const scoreCardP1 = document.getElementById('score-p1');
const scoreCardP2 = document.getElementById('score-p2');
const boxes = document.querySelectorAll('.box');
const newRoundBtn = document.getElementById('new-round-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const menuBtn = document.getElementById('menu-btn');
const roomBadge = document.getElementById('room-badge');

/* ============================================================
   SCREEN MANAGEMENT
   ============================================================ */
function showScreen(screenEl) {
    [lobbyScreen, waitingScreen, resultScreen].forEach(s => s.classList.remove('active'));
    gameScreen.classList.add('hidden');

    if (screenEl === gameScreen) {
        gameScreen.classList.remove('hidden');
    } else {
        screenEl.classList.add('active');
    }
}

function showLobbyError(msg) {
    lobbyError.textContent = msg;
    lobbyError.classList.add('visible');
    setTimeout(() => lobbyError.classList.remove('visible'), 4000);
}

/* ============================================================
   ROOM HELPERS
   ============================================================ */
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

/* ============================================================
   CREATE ROOM
   ============================================================ */
async function createRoom(playerName) {
    roomId = generateRoomId();
    myName = playerName;
    myMark = 'X';
    roomRef = ref(db, `rooms/${roomId}`);

    const roomPayload = {
        board: [null, null, null, null, null, null, null, null, null],
        turn: 'X',
        winner: null,
        players: {
            X: playerName,
            O: null
        },
        createdAt: Date.now()
    };

    try {
        await set(roomRef, roomPayload);

        // Auto-cleanup on disconnect
        onDisconnect(ref(db, `rooms/${roomId}/players/X`)).remove();

        // Update URL for sharing
        const shareUrl = `${location.origin}${location.pathname}?room=${roomId}`;
        history.replaceState(null, '', `?room=${roomId}`);
        shareLinkHint.textContent = `Or share: ${shareUrl}`;

        displayRoomId.textContent = roomId;
        showScreen(waitingScreen);

        // Start listening
        listenToRoom(roomId);
    } catch (err) {
        console.error('Create room error:', err);
        showLobbyError('Failed to create room. Check your connection.');
    }
}

/* ============================================================
   JOIN ROOM
   ============================================================ */
async function joinRoom(id, playerName) {
    roomId = id.toUpperCase().trim();
    myName = playerName;
    myMark = 'O';
    roomRef = ref(db, `rooms/${roomId}`);

    try {
        const snapshot = await get(roomRef);

        if (!snapshot.exists()) {
            showLobbyError('Room not found. Check the ID and try again.');
            roomId = null;
            return;
        }

        const data = snapshot.val();

        if (data.players?.O) {
            showLobbyError('Room is full! Both players already joined.');
            roomId = null;
            return;
        }

        // Join as O
        await update(ref(db, `rooms/${roomId}/players`), { O: playerName });

        // Auto-cleanup on disconnect
        onDisconnect(ref(db, `rooms/${roomId}/players/O`)).remove();

        // Update URL
        history.replaceState(null, '', `?room=${roomId}`);

        // Start listening
        listenToRoom(roomId);
    } catch (err) {
        console.error('Join room error:', err);
        showLobbyError('Failed to join room. Check your connection.');
    }
}

/* ============================================================
   LISTEN TO ROOM (onValue — Firebase source of truth)
   ============================================================ */
function listenToRoom(id) {
    // Clean up any previous listener
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }

    const roomPath = ref(db, `rooms/${id}`);

    unsubscribe = onValue(roomPath, (snapshot) => {
        if (!snapshot.exists()) {
            // Room was deleted
            handleRoomDeleted();
            return;
        }

        roomData = snapshot.val();

        // Both players present → go to game screen
        if (roomData.players?.X && roomData.players?.O) {
            renderGame(roomData);
        }
    }, (error) => {
        console.error('Listener error:', error);
        showLobbyError('Connection lost.');
    });
}

/* ============================================================
   RENDER GAME (called on every Firebase snapshot)
   ============================================================ */
function renderGame(data) {
    // Show game screen if not already visible
    if (gameScreen.classList.contains('hidden')) {
        showScreen(gameScreen);
    }

    const playerX = data.players.X;
    const playerO = data.players.O;

    // Scoreboard (use local scores since Firebase only stores per-round)
    nameP1Display.textContent = playerX;
    nameP2Display.textContent = playerO;
    scoreP1Display.textContent = localScores.X;
    scoreP2Display.textContent = localScores.O;
    roundLabel.textContent = `Round ${localRound}`;
    roomBadge.textContent = `Room: ${roomId}`;

    // Board
    const board = normalizeBoard(data.board);
    boxes.forEach((box, i) => {
        const val = board[i];
        box.innerHTML = val || '';
        box.className = 'box';

        if (val === 'X') box.classList.add('played-x');
        else if (val === 'O') box.classList.add('played-o');

        box.disabled = !!val || !!data.winner;
    });

    // Turn / Winner
    if (data.winner) {
        handleResultFromFirebase(data);
    } else {
        renderTurn(data);
    }
}

function renderTurn(data) {
    const isX = data.turn === 'X';
    const currentPlayerName = isX ? data.players.X : data.players.O;
    const isMyTurn = (data.turn === myMark);

    turnText.textContent = isMyTurn
        ? `Your turn (${myMark})`
        : `${currentPlayerName}'s turn`;

    turnIndicator.className = `turn-indicator ${isX ? 'turn-x' : 'turn-o'}`;

    scoreCardP1.classList.toggle('active-p2', isX);    // P1 = X
    scoreCardP1.classList.toggle('active-p1', false);
    scoreCardP2.classList.toggle('active-p1', !isX);   // P2 = O
    scoreCardP2.classList.toggle('active-p2', false);

    // Disable board if not my turn
    if (!isMyTurn) {
        boxes.forEach(box => { if (!box.innerHTML) box.disabled = true; });
    } else {
        boxes.forEach(box => { if (!box.innerHTML && !data.winner) box.disabled = false; });
    }
}

/* ============================================================
   MAKE MOVE (push to Firebase)
   ============================================================ */
async function makeMove(index) {
    if (!roomData || !roomId) return;
    if (roomData.winner) return;
    if (roomData.turn !== myMark) return;

    const board = normalizeBoard(roomData.board);
    if (board[index]) return;

    // Place mark locally in board array
    board[index] = myMark;

    // Check for winner / draw
    const result = checkWinner(board);

    const updates = {};
    updates[`board/${index}`] = myMark;

    if (result) {
        if (result.type === 'win') {
            updates['winner'] = result.mark;
        } else {
            updates['winner'] = 'draw';
        }
    } else {
        updates['turn'] = myMark === 'X' ? 'O' : 'X';
    }

    try {
        await update(ref(db, `rooms/${roomId}`), updates);
    } catch (err) {
        console.error('Move failed:', err);
    }
}

/* ============================================================
   WIN / DRAW DETECTION
   ============================================================ */
function checkWinner(board) {
    for (const [a, b, c] of WIN_PATTERNS) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return { type: 'win', mark: board[a], cells: [a, b, c] };
        }
    }
    if (board.every(cell => cell != null)) {
        return { type: 'draw' };
    }
    return null;
}

/* ============================================================
   HANDLE RESULT (triggered by Firebase snapshot)
   ============================================================ */
let resultShown = false;

function handleResultFromFirebase(data) {
    // Highlight winning cells
    if (data.winner !== 'draw') {
        const board = normalizeBoard(data.board);
        const winResult = checkWinner(board);
        if (winResult && winResult.cells) {
            winResult.cells.forEach(i => {
                boxes[i].classList.remove('played-o', 'played-x');
                boxes[i].classList.add('winner-cell');
            });
        }
    }

    // Disable all boxes
    boxes.forEach(box => { box.disabled = true; });

    // Only show result overlay once per result
    if (resultShown) return;
    resultShown = true;

    if (data.winner === 'draw') {
        localRound++;

        setTimeout(() => {
            resultEmoji.textContent = '🤝';
            resultTitle.textContent = "It's a Draw!";
            resultTitle.style.color = '#94a3b8';
            resultTitle.style.textShadow = 'none';
            resultSubtitle.textContent = 'Nobody claimed this round.';
            showScreen(resultScreen);
        }, 400);

    } else {
        const winnerName = data.winner === 'X' ? data.players.X : data.players.O;
        localScores[data.winner]++;
        localRound++;

        // Update score display
        scoreP1Display.textContent = localScores.X;
        scoreP2Display.textContent = localScores.O;

        setTimeout(() => {
            resultEmoji.textContent = '🏆';
            resultTitle.textContent = `${winnerName} Wins!`;
            resultTitle.style.color = '';
            resultTitle.style.textShadow = '';
            resultSubtitle.textContent = data.winner === myMark
                ? '🎉 You won this round!'
                : 'Better luck next time!';
            showScreen(resultScreen);
        }, 900);
    }
}

/* ============================================================
   RESET BOARD (new round — push fresh board to Firebase)
   ============================================================ */
async function resetBoard() {
    if (!roomId) return;
    resultShown = false;

    try {
        await update(ref(db, `rooms/${roomId}`), {
            board: [null, null, null, null, null, null, null, null, null],
            turn: 'X',
            winner: null
        });
    } catch (err) {
        console.error('Reset failed:', err);
    }
}

/* ============================================================
   DELETE ROOM & CLEANUP
   ============================================================ */
async function deleteRoom() {
    if (!roomId) return;

    try {
        await remove(ref(db, `rooms/${roomId}`));
    } catch (err) {
        console.error('Delete room error:', err);
    }
    cleanup();
}

function cleanup() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    roomId = null;
    roomRef = null;
    roomData = null;
    myMark = '';
    resultShown = false;
    localScores = { X: 0, O: 0 };
    localRound = 1;
    history.replaceState(null, '', location.pathname);
}

function handleRoomDeleted() {
    cleanup();
    showScreen(lobbyScreen);
    showLobbyError('The room was deleted or the host disconnected.');
}

/* ============================================================
   EVENT LISTENERS — LOBBY
   ============================================================ */
createRoomBtn.addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) { inputName.focus(); return; }
    createRoom(name);
});

joinRoomBtn.addEventListener('click', () => {
    const name = inputName.value.trim();
    const id = inputRoomId.value.trim();
    if (!name) { inputName.focus(); return; }
    if (!id) { inputRoomId.focus(); return; }
    joinRoom(id, name);
});

// Allow Enter key to trigger
inputName.addEventListener('keydown', e => {
    if (e.key === 'Enter') createRoomBtn.click();
});
inputRoomId.addEventListener('keydown', e => {
    if (e.key === 'Enter') joinRoomBtn.click();
});

/* ============================================================
   EVENT LISTENERS — WAITING SCREEN
   ============================================================ */
copyRoomIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => {
        copyRoomIdBtn.textContent = '✅';
        setTimeout(() => { copyRoomIdBtn.textContent = '📋'; }, 1500);
    });
});

cancelWaitBtn.addEventListener('click', () => {
    deleteRoom();
    showScreen(lobbyScreen);
});

/* ============================================================
   EVENT LISTENERS — GAME BOARD
   ============================================================ */
boxes.forEach(box => {
    box.addEventListener('click', () => {
        const idx = parseInt(box.dataset.index);
        makeMove(idx);
    });
});

/* ============================================================
   EVENT LISTENERS — RESULT SCREEN
   ============================================================ */
nextRoundBtn.addEventListener('click', () => {
    resultTitle.style.color = '';
    resultTitle.style.textShadow = '';
    resetBoard();
    showScreen(gameScreen);
});

endGameBtn.addEventListener('click', () => {
    resultTitle.style.color = '';
    resultTitle.style.textShadow = '';
    deleteRoom();
    showScreen(lobbyScreen);
});

/* ============================================================
   EVENT LISTENERS — GAME SCREEN ACTIONS
   ============================================================ */
newRoundBtn.addEventListener('click', () => {
    resetBoard();
});

leaveRoomBtn.addEventListener('click', () => {
    if (!confirm('Leave the room? This will end the game for both players.')) return;
    deleteRoom();
    showScreen(lobbyScreen);
});

menuBtn.addEventListener('click', () => {
    if (!confirm('Leave the room?')) return;
    deleteRoom();
    showScreen(lobbyScreen);
});

/* ============================================================
   BOOT — Handle ?room=ROOMID from URL
   ============================================================ */
(function boot() {
    const params = new URLSearchParams(location.search);
    const urlRoom = params.get('room');

    if (urlRoom) {
        inputRoomId.value = urlRoom.toUpperCase();
        // Pre-focus the name input so user just types name and clicks join
        inputName.focus();
    }

    showScreen(lobbyScreen);
})();
