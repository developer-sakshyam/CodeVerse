const socket = io();
let currentMatchId = null;
let timeLeftMs = 0;
let timerInterval = null;

const el = (id) => document.getElementById(id);

// Sections
const registerSec = el('register');
const lobbySec = el('lobby');
const matchSec = el('match');

// Controls
const nameInput = el('name');
const registerBtn = el('registerBtn');
const langSel = el('lang');
const levelSel = el('level');
const queueBtn = el('queueBtn');
const queueStatus = el('queueStatus');

const problemTitle = el('problemTitle');
const statement = el('statement');
const codeArea = el('code');
const opponentEl = el('opponent');
const timerEl = el('timer');
const submitBtn = el('submitBtn');
const resultEl = el('result');
const detailsEl = el('details');

// --- UI helpers ---
function show(sec) {
  [registerSec, lobbySec, matchSec].forEach(s => s.classList.add('hidden'));
  sec.classList.remove('hidden');
}

registerBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Player';
  socket.emit('register', { name });
});

queueBtn.addEventListener('click', () => {
  socket.emit('joinQueue', { language: langSel.value, level: levelSel.value });
  queueStatus.textContent = 'Joined queue… looking for opponent';
});

submitBtn.addEventListener('click', () => {
  resultEl.textContent = 'Submitting…';
  socket.emit('submitCode', { matchId: currentMatchId, code: codeArea.value });
});

socket.on('registered', (profile) => {
  show(lobbySec);
});

socket.on('queueJoined', ({ key, position }) => {
  queueStatus.textContent = `Queue ${key} • Position ${position}`;
});

socket.on('matchStarted', ({ matchId, problem, timeLimitMs, opponent }) => {
  currentMatchId = matchId;
  timeLeftMs = timeLimitMs;
  resultEl.textContent = '';
  detailsEl.innerHTML = '';
  problemTitle.textContent = problem.title;
  statement.textContent = problem.statement;
  opponentEl.textContent = opponent;
  codeArea.value = problem.starterCode || '';
  show(matchSec);
  startTimer();
});

socket.on('submissionResult', ({ passed, total, details }) => {
  resultEl.textContent = `Passed ${passed}/${total}`;
  detailsEl.innerHTML = (details || []).map(d => {
    if (d.error) return `<div>❌ Error: ${d.error}</div>`;
    return `<div>${d.ok ? '✅' : '❌'} input=${JSON.stringify(d.input)} expected=${JSON.stringify(d.expected)} got=${JSON.stringify(d.got)}</div>`;
  }).join('');
});

socket.on('matchEnded', ({ matchId, reason, winnerSocketId, tie }) => {
  clearInterval(timerInterval);
  if (tie) {
    resultEl.textContent = 'Match ended: draw';
  } else if (winnerSocketId) {
    resultEl.textContent = (winnerSocketId === socket.id) ? '🏆 You win!' : 'You lost — gg!';
  } else {
    resultEl.textContent = 'Match ended';
  }
});

function startTimer() {
  clearInterval(timerInterval);
  const endAt = Date.now() + timeLeftMs;
  const tick = () => {
    const remain = Math.max(0, endAt - Date.now());
    const mm = String(Math.floor(remain / 60000)).padStart(2, '0');
    const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, '0');
    timerEl.textContent = `${mm}:${ss}`;
    if (remain <= 0) clearInterval(timerInterval);
  };
  tick();
  timerInterval = setInterval(tick, 250);
}
