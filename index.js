import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import vm from 'node:vm';


import fs from 'fs';

const problemsPath = path.join(process.cwd(), 'server', 'problems.json');
let problems = [];
try {
  problems = JSON.parse(fs.readFileSync(problemsPath, 'utf8'));
  console.log('✅ Loaded', problems.length, 'problems from problems.json');
} catch (e) {
  console.warn('⚠️ Could not load problems.json — falling back to default problems');
 
  problems = [
    {
      id: 'p1',
      title: 'Reverse String',
      statement: 'Write a function reverseString(s) that returns the reversed string.',
      functionName: 'reverseString',
      starterCode: `function reverseString(s) {\n  // TODO: return reversed string\n}\n\nmodule.exports = { reverseString };`,
      tests: [
        { input: ['abc'], output: 'cba' },
        { input: ['racecar'], output: 'racecar' },
      ]
    }
  ];
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'client')));

// In-memory demo state
const users = new Map(); // socketId -> { name }
const queue = new Map(); // key(lang:level) -> [socketId,...]
const matches = new Map(); // matchId -> { players: [id1,id2], problem, startAt, submissions: {}, winner: null, timeLimitMs }


function queueKey({ language = 'javascript', level = 'beginner' }) {
  return `${language}:${level}`;
}

io.on('connection', (socket) => {
  console.log('connected', socket.id);

  socket.on('register', ({ name }) => {
    users.set(socket.id, { name: name?.trim() || `Player-${socket.id.slice(0,5)}` });
    socket.emit('registered', users.get(socket.id));
  });

  socket.on('joinQueue', ({ language = 'javascript', level = 'beginner' } = {}) => {
    const key = queueKey({ language, level });
    if (!queue.has(key)) queue.set(key, []);
    const arr = queue.get(key);
    if (!arr.includes(socket.id)) arr.push(socket.id);
    io.to(socket.id).emit('queueJoined', { key, position: arr.indexOf(socket.id) + 1 });

    // Try to match two players
    if (arr.length >= 2) {
      const p1 = arr.shift();
      const p2 = arr.shift();
      startMatch([p1, p2], { language, level });
    }
  });

  socket.on('submitCode', ({ matchId, code }) => {
    const match = matches.get(matchId);
    if (!match || match.winner) return;
    if (!match.players.includes(socket.id)) return;

    const { problem } = match;
    const result = judgeJS(code, problem); // { passed, total, details }

    // store submission
    if (!match.submissions[socket.id]) match.submissions[socket.id] = [];
    match.submissions[socket.id].push({ code, result, ts: Date.now() });

    // emit immediate result
    io.to(socket.id).emit('submissionResult', { matchId, ...result });

    // Check for winner: first to pass all tests wins
    if (result.passed === result.total) {
      // If opponent already passed all, decide by earlier timestamp
      const opponentId = match.players.find((id) => id !== socket.id);
      const youTime = Date.now() - match.startAt;
      const oppSubmissions = match.submissions[opponentId] || [];
      const oppWinTime = oppSubmissions.find(s => s.result.passed === s.result.total)?.ts;

      match.winner = socket.id;
      let tie = false;
      if (oppWinTime) {
        tie = true;
        match.winner = (youTime <= (oppWinTime - match.startAt)) ? socket.id : opponentId;
      }

      endMatch(matchId, { reason: 'solved', tie });
    }
  });

  socket.on('disconnect', () => {
    // Remove from queues
    for (const [key, arr] of queue.entries()) {
      const idx = arr.indexOf(socket.id);
      if (idx !== -1) arr.splice(idx, 1);
    }
    // If in an active match, award win to opponent
    for (const [matchId, match] of matches.entries()) {
      if (!match.winner && match.players.includes(socket.id)) {
        match.winner = match.players.find((id) => id !== socket.id);
        endMatch(matchId, { reason: 'opponent_disconnected' });
      }
    }
    users.delete(socket.id);
  });
});

function pickProblem() {
  return problems[Math.floor(Math.random() * problems.length)];
}

function startMatch(playerIds, { language, level }) {
  const problem = pickProblem();
  const matchId = nanoid(10);
  const timeLimitMs = 10 * 60 * 1000; // 10 minutes demo
  const startAt = Date.now();

  matches.set(matchId, {
    players: playerIds,
    problem,
    language,
    level,
    startAt,
    timeLimitMs,
    submissions: {},
    winner: null,
  });

  playerIds.forEach((pid) => {
    io.to(pid).emit('matchStarted', {
      matchId,
      problem: {
        id: problem.id,
        title: problem.title,
        statement: problem.statement,
        functionName: problem.functionName,
        starterCode: problem.starterCode,
        totalTests: problem.tests.length,
      },
      timeLimitMs,
      opponent: users.get(playerIds.find((id) => id !== pid))?.name || 'Opponent',
    });
  });

  // End match when timer expires
  setTimeout(() => {
    const m = matches.get(matchId);
    if (!m || m.winner) return;
    // Decide by who passed more tests; if tie, earliest full pass or draw
    const [a, b] = m.players;
    const aBest = bestSubmission(m.submissions[a]);
    const bBest = bestSubmission(m.submissions[b]);

    if ((aBest?.passed || 0) > (bBest?.passed || 0)) m.winner = a;
    else if ((bBest?.passed || 0) > (aBest?.passed || 0)) m.winner = b;
    else m.winner = null; // draw

    endMatch(matchId, { reason: 'timeout' });
  }, timeLimitMs + 500);
}

function bestSubmission(list = []) {
  if (!list.length) return null;
  return list.sort((x, y) => (y.result.passed - x.result.passed) || (x.ts - y.ts))[0];
}

function endMatch(matchId, { reason, tie = false } = {}) {
  const match = matches.get(matchId);
  if (!match) return;
  const payload = {
    matchId,
    reason,
    winnerSocketId: match.winner,
    players: match.players,
    problemId: match.problem.id,
    tie,
  };
  match.players.forEach((pid) => io.to(pid).emit('matchEnded', payload));
  // Keep match in memory briefly; for a real app, persist to DB
  setTimeout(() => matches.delete(matchId), 60 * 1000);
}

// --- JS Judge (Node vm) DEMO ONLY ---
function judgeJS(source, problem) {
  const context = {
    module: { exports: {} },
    exports: {},
    console,
  };
  const script = new vm.Script(source, { timeout: 1000, displayErrors: true });
  const sandbox = vm.createContext(context);
  let passed = 0;
  const total = problem.tests.length;
  const details = [];
  try {
    script.runInContext(sandbox, { timeout: 1000 });
    const exported = sandbox.module?.exports || sandbox.exports || {};
    const fn = exported[problem.functionName];
    if (typeof fn !== 'function') {
      return { passed: 0, total, details: [{ error: `Export function ${problem.functionName} not found` }] };
    }
    for (const t of problem.tests) {
      let out, err;
      try {
        out = fn(...t.input);
      } catch (e) {
        err = String(e);
      }
      const ok = err ? false : deepEqual(out, t.output);
      if (ok) passed++;
      details.push({ input: t.input, expected: t.output, got: out, ok, err });
    }
  } catch (e) {
    return { passed: 0, total, details: [{ error: String(e) }] };
  }
  return { passed, total, details };
}

function deepEqual(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`CodeVerse demo listening on http://localhost:${PORT}`));