const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.set('view engine', 'ejs');

// Global server state
let serverState = {
  selectedGame: null, // { leagueId, matchIndex }
  timer: {
    mode: 'countdown', // default countdown mode
    running: false,
    baseTime: 0,      // timestamp when timer started
    elapsed: 0,       // seconds elapsed before current run
    preset: 300       // default 5 minutes (300 seconds)
  }
};

function getCurrentTimer() {
  if (serverState.timer.running) {
    const delta = (Date.now() - serverState.timer.baseTime) / 1000;
    if (serverState.timer.mode === 'countup') {
      return serverState.timer.elapsed + delta;
    } else {
      let current = serverState.timer.preset - (serverState.timer.elapsed + delta);
      return current < 0 ? 0 : current;
    }
  } else {
    if (serverState.timer.mode === 'countup') {
      return serverState.timer.elapsed;
    } else {
      let current = serverState.timer.preset - serverState.timer.elapsed;
      return current < 0 ? 0 : current;
    }
  }
}

// Endpoints for state and timer
app.get('/state', (req, res) => {
  res.json(serverState);
});

app.get('/timer', (req, res) => {
  res.json({
    mode: serverState.timer.mode,
    running: serverState.timer.running,
    currentTime: getCurrentTimer(),
    preset: serverState.timer.preset
  });
});

app.post('/timer', (req, res) => {
  const action = req.body.action;
  switch (action) {
    case 'start':
      if (!serverState.timer.running) {
        serverState.timer.baseTime = Date.now();
        serverState.timer.running = true;
      }
      break;
    case 'pause':
      if (serverState.timer.running) {
        const delta = (Date.now() - serverState.timer.baseTime) / 1000;
        serverState.timer.elapsed += delta;
        serverState.timer.running = false;
      }
      break;
    case 'reset':
      serverState.timer.running = false;
      serverState.timer.elapsed = 0;
      serverState.timer.baseTime = 0;
      break;
    case 'setMode':
      if (req.body.mode === 'countup' || req.body.mode === 'countdown') {
        serverState.timer.mode = req.body.mode;
        serverState.timer.running = false;
        serverState.timer.elapsed = 0;
        serverState.timer.baseTime = 0;
      }
      break;
    case 'setPreset':
      if (typeof req.body.preset === 'number') {
        serverState.timer.preset = req.body.preset;
      }
      break;
    default:
      return res.status(400).json({ error: 'Unknown action' });
  }
  res.json({
    mode: serverState.timer.mode,
    running: serverState.timer.running,
    currentTime: getCurrentTimer(),
    preset: serverState.timer.preset
  });
});

// Control page: fetch leagues from external API and pass current selectedGame
app.get('/control', async (req, res) => {
  try {
    const r = await fetch('https://api.syndikat.golf/scores');
    const leagues = await r.json();
    res.render('control', { leagues, selectedGame: serverState.selectedGame });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching leagues');
  }
});

// Set the selected game (server‑side state)
app.post('/setGame', (req, res) => {
  const { leagueId, matchIndex } = req.body;
  if (!leagueId || matchIndex === undefined) {
    return res.status(400).json({ error: 'Missing leagueId or matchIndex' });
  }
  serverState.selectedGame = { leagueId, matchIndex };
  res.json({ success: true, selectedGame: serverState.selectedGame });
});

// Fetch matches for a given league
app.get('/matches/:leagueId', async (req, res) => {
  try {
    const r = await fetch(`https://api.syndikat.golf/scores/${req.params.leagueId}`);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching matches' });
  }
});

// Stream overlay: if no game is selected, render with match: null
app.get('/stream', async (req, res) => {
  if (!serverState.selectedGame) {
    return res.render('stream', { match: null });
  }
  try {
    const { leagueId, matchIndex } = serverState.selectedGame;
    const r = await fetch(`https://api.syndikat.golf/scores/${leagueId}`);
    const allMatches = await r.json();
    const match = allMatches[matchIndex];
    res.render('stream', { match: match || null });
  } catch (err) {
    console.error(err);
    res.render('stream', { match: null });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
