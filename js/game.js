// ===================== CARD & HAND EVALUATION =====================
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_VAL = {};
RANKS.forEach((r, i) => RANK_VAL[r] = i);

function createDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ rank: r, suit: s, code: r + s });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function combinations(arr, k) {
  const res = [];
  function helper(start, curr) {
    if (curr.length === k) {
      res.push([...curr]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      curr.push(arr[i]);
      helper(i + 1, curr);
      curr.pop();
    }
  }
  helper(0, []);
  return res;
}

function evaluate5(cards) {
  const ranks = cards.map(c => RANK_VAL[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  const countMap = {};
  ranks.forEach(r => countMap[r] = (countMap[r] || 0) + 1);
  const counts = Object.values(countMap).sort((a, b) => b - a);
  const uniqueRanks = [...new Set(ranks)];

  let isStraight = false;
  let highStraight = 0;

  if (uniqueRanks.length === 5 && ranks[0] - ranks[4] === 4) {
    isStraight = true;
    highStraight = ranks[0];
  }
  // Wheel A-2-3-4-5
  if (ranks[0] === 12 && ranks[1] === 3 && ranks[2] === 2 && ranks[3] === 1 && ranks[4] === 0) {
    isStraight = true;
    highStraight = 3;
  }

  const sortedByCount = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(x => parseInt(x[0]));

  let score = 0;
  let name = 'High Card';

  if (isStraight && isFlush) {
    score = 8000000 + highStraight;
    name = highStraight === 12 ? 'Royal Flush' : 'Straight Flush';
  } else if (counts[0] === 4) {
    score = 7000000 + sortedByCount[0] * 100 + sortedByCount[1];
    name = 'Four of a Kind';
  } else if (counts[0] === 3 && counts[1] === 2) {
    score = 6000000 + sortedByCount[0] * 100 + sortedByCount[1];
    name = 'Full House';
  } else if (isFlush) {
    score = 5000000 + ranks[0]*10000 + ranks[1]*1000 + ranks[2]*100 + ranks[3]*10 + ranks[4];
    name = 'Flush';
  } else if (isStraight) {
    score = 4000000 + highStraight;
    name = 'Straight';
  } else if (counts[0] === 3) {
    score = 3000000 + sortedByCount[0]*10000 + sortedByCount[1]*100 + sortedByCount[2];
    name = 'Three of a Kind';
  } else if (counts[0] === 2 && counts[1] === 2) {
    const highPair = Math.max(sortedByCount[0], sortedByCount[1]);
    const lowPair  = Math.min(sortedByCount[0], sortedByCount[1]);
    score = 2000000 + highPair*10000 + lowPair*100 + sortedByCount[2];
    name = 'Two Pair';
  } else if (counts[0] === 2) {
    score = 1000000 + sortedByCount[0]*10000 + sortedByCount[1]*1000 + sortedByCount[2]*100 + sortedByCount[3];
    name = 'One Pair';
  } else {
    score = ranks[0]*10000 + ranks[1]*1000 + ranks[2]*100 + ranks[3]*10 + ranks[4];
    name = 'High Card';
  }

  return { score, name };
}

function handRank(hole, community) {
  const cards = [...hole, ...community];
  if (cards.length < 5) return { score: 0, name: 'Incomplete' };

  const combos = combinations(cards, 5);
  let best = { score: -1, name: 'High Card' };

  for (const combo of combos) {
    const result = evaluate5(combo);
    if (result.score > best.score) best = result;
  }
  return best;
}

// ===================== GAME STATE =====================
let state = {};

function initState(startChips, difficulty, maxBetBB) {
  state = {
human: { stack: startChips, hole: [], discarded: [], bet: 0, folded: false, allIn: false, acted: false },
comp:  { stack: startChips, hole: [], discarded: [], bet: 0, folded: false, allIn: false, acted: false },
    community: [],
    pot: 0,
    deck: [],
    phase: 'preflop',
    currentBet: 0,
    minRaise: 0,
    button: 1,               // 0 = human button, 1 = computer button
    acting: null,
    difficulty: +difficulty,
    maxBetBB: +maxBetBB,
    sb: 5,
    bb: 10,
    level: 1,
    handNumber: 0,
    lastBlindIncrease: Date.now(),
    blindInterval: 180,
    selectedDiscard: null,
    gameOver: false,
    message: ''
  };
}

// ===================== UI HELPERS =====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function renderCard(card, faceUp = true, selectable = false, isDiscarded = false) {
  if (!faceUp) return `<div class="card back"></div>`;

  const red = (card.suit === '♥' || card.suit === '♦') ? 'red' : '';
  const sel = (selectable && state.selectedDiscard === card.code) ? 'selected' : '';
  const disc = isDiscarded ? 'discarded' : '';
  const click = selectable ? `onclick="selectDiscard('${card.code}')"` : '';

  return `
    <div class="card-wrapper">
      ${isDiscarded ? '<div class="discard-label">Discarded</div>' : ''}
      <div class="card ${red} ${sel} ${disc}" ${click}>
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
    </div>`;
}


function updateUI() {
  document.getElementById('humanStack').textContent =
    state.human.stack + (state.human.bet ? ` (${state.human.bet})` : '');
  document.getElementById('compStack').textContent =
    state.comp.stack + (state.comp.bet ? ` (${state.comp.bet})` : '');
  document.getElementById('potAmount').textContent =
    state.pot + state.human.bet + state.comp.bet;

// Computer cards (active + discarded at showdown)
const showComp = state.phase === 'showdown' || state.gameOver;
let compHtml = state.comp.hole.map(c => renderCard(c, showComp)).join('');
if (showComp && state.comp.discarded.length) {
  compHtml += state.comp.discarded.map(c => renderCard(c, true, false, true)).join('');
}
document.getElementById('compCards').innerHTML = compHtml;

// Human cards (active + discarded)
const canSelect = (state.phase === 'discard1' || state.phase === 'discard2') && state.acting === 'human';
let humanHtml = state.human.hole.map(c => renderCard(c, true, canSelect)).join('');
if (state.human.discarded.length) {
  humanHtml += state.human.discarded.map(c => renderCard(c, true, false, true)).join('');
}
document.getElementById('humanCards').innerHTML = humanHtml;

  
  document.getElementById('communityCards').innerHTML =
    state.community.map(c => renderCard(c)).join('');

  document.getElementById('blindDisplay').textContent = `${state.sb} / ${state.bb}`;
  document.getElementById('levelDisplay').textContent = state.level;

  const elapsed = (Date.now() - state.lastBlindIncrease) / 1000;
  const remaining = Math.max(0, state.blindInterval - elapsed);
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  document.getElementById('nextBlindTime').textContent = `${m}:${s.toString().padStart(2, '0')}`;

  const isDiscard = state.phase === 'discard1' || state.phase === 'discard2';
  const isShowdown = state.phase === 'showdown' || state.gameOver;

  document.getElementById('actionControls').classList.toggle('hidden', isDiscard || isShowdown || state.acting !== 'human');
  document.getElementById('discardControls').classList.toggle('hidden', !isDiscard || state.acting !== 'human');
  document.getElementById('nextHandControls').classList.toggle('hidden', !isShowdown || state.gameOver);

  const toCall = state.currentBet - state.human.bet;
  document.getElementById('btnCheck').style.display = toCall === 0 ? 'inline-block' : 'none';
  document.getElementById('btnCall').style.display  = toCall > 0  ? 'inline-block' : 'none';
  document.getElementById('btnCall').textContent = `Call ${toCall}`;
  document.getElementById('btnBet').style.display   = state.currentBet === 0 ? 'inline-block' : 'none';
  document.getElementById('btnRaise').style.display = state.currentBet > 0  ? 'inline-block' : 'none';

  // Max bet limit for the input
  let maxBet = state.human.stack;
  if (state.maxBetBB > 0) {
    maxBet = Math.min(maxBet, state.maxBetBB * state.bb);
  }
  document.getElementById('betAmount').max = maxBet;

  if (state.maxBetBB > 0 && state.human.stack > state.maxBetBB * state.bb) {
    document.getElementById('btnAllIn').textContent = `Max (${state.maxBetBB} BB)`;
  } else {
    document.getElementById('btnAllIn').textContent = 'All-In';
  }

  const msgEl = document.getElementById('message');
  if (state.message) {
    msgEl.textContent = state.message;
    msgEl.classList.remove('hidden');
  } else {
    msgEl.classList.add('hidden');
  }
}

function log(msg) {
  document.getElementById('actionLog').textContent = msg;
}

function logComputer(msg) {
  const el = document.getElementById('computerLog');
  if (el) el.textContent = msg;
}

// ===================== GAME FLOW =====================
function startGame() {
  const chips = +document.getElementById('startChips').value || 1000;
  const diff  = document.getElementById('difficulty').value;
  const maxBB = document.getElementById('maxBetBB').value;
  initState(chips, diff, maxBB);
  showScreen('game');
  newHand();
  setInterval(checkBlindIncrease, 1000);
}

function checkBlindIncrease() {
  if (state.gameOver) return;
  const elapsed = (Date.now() - state.lastBlindIncrease) / 1000;
  if (elapsed >= state.blindInterval) {
    state.sb *= 2;
    state.bb *= 2;
    state.level++;
    state.lastBlindIncrease = Date.now();
    if (state.level > 3) state.blindInterval = Math.max(90, state.blindInterval - 20);
    log(`Blinds increased to ${state.sb}/${state.bb}`);
  }
  updateUI();
}

function postBlind(player, amount) {
  const p = state[player];
  const real = Math.min(amount, p.stack);
  p.stack -= real;
  p.bet += real;
  if (p.stack === 0) p.allIn = true;
}

function getMaxAllowed(player) {
  const p = state[player];
  if (state.maxBetBB <= 0) return p.stack + p.bet; // No Limit
  return Math.min(p.stack + p.bet, state.currentBet + state.maxBetBB * state.bb);
}

function newHand() {
  if (state.human.stack <= 0 || state.comp.stack <= 0) {
    state.gameOver = true;
    state.message = state.human.stack > 0 ? 'You win the match!' : 'Computer wins the match!';
    updateUI();
    return;
  }

  state.handNumber++;
  state.deck = shuffle(createDeck());
  state.community = [];
  state.pot = 0;
  state.human.hole = [];
  state.comp.hole = [];
  state.human.bet = 0;
  state.comp.bet = 0;
  state.human.folded = false;
  state.comp.folded = false;
  state.human.discarded = [];
  state.comp.discarded = [];
  state.human.allIn = false;
  state.comp.allIn = false;
  state.human.acted = false;
  state.comp.acted = false;
  state.currentBet = 0;
  state.minRaise = state.bb;
  state.phase = 'preflop';
  state.selectedDiscard = null;
  state.message = '';
  logComputer('');          // clear previous computer action

  // Alternate button
  state.button = 1 - state.button;

  // Deal 4 cards each
  for (let i = 0; i < 4; i++) {
    state.human.hole.push(state.deck.pop());
    state.comp.hole.push(state.deck.pop());
  }

  // Heads-up blinds: Button posts SB, other posts BB
  if (state.button === 0) {
    postBlind('human', state.sb);
    postBlind('comp', state.bb);
  } else {
    postBlind('comp', state.sb);
    postBlind('human', state.bb);
  }

  state.currentBet = state.bb;
  state.minRaise = state.bb;

  // Preflop: Button acts first
  state.acting = state.button === 0 ? 'human' : 'comp';

  log(`Hand #${state.handNumber} — ${state.button === 0 ? 'You are' : 'Computer is'} on the Button`);
  updateUI();

  if (state.acting === 'comp') {
    setTimeout(compAct, 800);
  }
}

function playerAction(type) {
  if (state.acting !== 'human' || state.human.folded) return;

  const p = state.human;
  const toCall = state.currentBet - p.bet;

  if (type === 'fold') {
    p.folded = true;
    log('You fold');
    endHand();
    return;
  }

  if (type === 'check') {
    if (toCall > 0) return;
    log('You check');
  } else if (type === 'call') {
    const amount = Math.min(toCall, p.stack);
    p.stack -= amount;
    p.bet += amount;
    if (p.stack === 0) p.allIn = true;
    log(amount === 0 ? 'You check' : `You call ${amount}`);
  } else if (type === 'bet' || type === 'raise') {
    let raiseTo = parseInt(document.getElementById('betAmount').value) || 0;
    const minRaiseTo = state.currentBet === 0 ? state.bb : state.currentBet + state.minRaise;
    const maxAllowed = getMaxAllowed('human');

    raiseTo = Math.max(raiseTo, minRaiseTo);
    raiseTo = Math.min(raiseTo, maxAllowed);

    const add = raiseTo - p.bet;
    if (add <= 0) return;

    p.stack -= add;
    p.bet += add;

    if (raiseTo > state.currentBet) {
      state.minRaise = raiseTo - state.currentBet;
      state.currentBet = raiseTo;
    }
    if (p.stack === 0) p.allIn = true;

    log(type === 'bet' ? `You bet ${raiseTo}` : `You raise to ${raiseTo}`);
  } else if (type === 'allin') {
    const maxAllowed = getMaxAllowed('human');
    const raiseTo = Math.min(p.stack + p.bet, maxAllowed);
    const add = raiseTo - p.bet;

    p.stack -= add;
    p.bet += add;

    if (raiseTo > state.currentBet) {
      state.minRaise = Math.max(state.minRaise, raiseTo - state.currentBet);
      state.currentBet = raiseTo;
    }
    if (p.stack === 0) p.allIn = true;

    log(p.stack === 0 ? `You go all-in for ${raiseTo}` : `You bet ${raiseTo} (capped by limit)`);
  }

  afterAction();
}

function afterAction() {
  const h = state.human;
  const c = state.comp;

  // Mark the player who just acted
  if (state.acting === 'human') h.acted = true;
  if (state.acting === 'comp')  c.acted = true;

  const bothActedOrCannotAct =
    (h.acted || h.folded || h.allIn) &&
    (c.acted || c.folded || c.allIn);

  const betsMatched =
    h.bet === c.bet || h.allIn || c.allIn || h.folded || c.folded;

  if (bothActedOrCannotAct && betsMatched) {
    // Collect bets into pot
    state.pot += h.bet + c.bet;
    h.bet = 0;
    c.bet = 0;
    state.currentBet = 0;
    state.minRaise = state.bb;
    nextPhase();
  } else {
    // Switch actor
    state.acting = state.acting === 'human' ? 'comp' : 'human';

    if (state[state.acting].folded || state[state.acting].allIn) {
      afterAction(); // re-evaluate
      return;
    }

    updateUI();
    if (state.acting === 'comp') setTimeout(compAct, 800);
  }
  updateUI();
}

function nextPhase() {
  if (state.human.folded || state.comp.folded) {
    endHand();
    return;
  }

  if (state.phase === 'preflop') {
    state.deck.pop(); // burn
    state.community.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    state.phase = 'flop';
    log('Flop dealt');
    startBettingRound();
  } else if (state.phase === 'flop') {
    state.phase = 'discard1';
    state.selectedDiscard = null;
    log('Discard 1 card before the Turn');
    compDiscard();
    state.acting = 'human';
    updateUI();
  } else if (state.phase === 'discard1') {
    state.deck.pop(); // burn
    state.community.push(state.deck.pop());
    state.phase = 'turn';
    log('Turn dealt');
    startBettingRound();
  } else if (state.phase === 'turn') {
    state.phase = 'discard2';
    state.selectedDiscard = null;
    log('Discard 1 card before the River');
    compDiscard();
    state.acting = 'human';
    updateUI();
  } else if (state.phase === 'discard2') {
    state.deck.pop(); // burn
    state.community.push(state.deck.pop());
    state.phase = 'river';
    log('River dealt');
    startBettingRound();
  } else if (state.phase === 'river') {
    state.phase = 'showdown';
    endHand();
  }
}

function startBettingRound() {
  state.currentBet = 0;
  state.minRaise = state.bb;

  // Reset acted flags for the new round
  state.human.acted = false;
  state.comp.acted = false;

  // Post-flop: non-button acts first
  state.acting = state.button === 0 ? 'comp' : 'human';

  if (state[state.acting].folded || state[state.acting].allIn) {
    state.acting = state.acting === 'human' ? 'comp' : 'human';
  }

  updateUI();
  if (state.acting === 'comp') setTimeout(compAct, 700);
}

function selectDiscard(code) {
  if (state.phase !== 'discard1' && state.phase !== 'discard2') return;
  state.selectedDiscard = code;
  document.getElementById('btnDiscard').disabled = false;
  updateUI();
}

function confirmDiscard() {
  if (!state.selectedDiscard) return;

  const idx = state.human.hole.findIndex(c => c.code === state.selectedDiscard);
  if (idx === -1) return;

  const card = state.human.hole.splice(idx, 1)[0];
  state.human.discarded.push(card);
  state.selectedDiscard = null;
  log('You discarded 1 card');

  // Computer discard
  if (state.phase === 'discard1' && state.comp.hole.length > 3) compDiscard();
  if (state.phase === 'discard2' && state.comp.hole.length > 2) compDiscard();

  const target = state.phase === 'discard1' ? 3 : 2;
  if (state.human.hole.length === target && state.comp.hole.length === target) {
    nextPhase();
  }
  updateUI();
}

function compDiscard() {
  const target = state.phase === 'discard1' ? 3 : 2;
  if (state.comp.hole.length <= target) return;

  let worstIdx = 0;
  let worstScore = 999;

  state.comp.hole.forEach((card, i) => {
    let score = RANK_VAL[card.rank];
    if (state.difficulty >= 2) {
      const suitedCount = state.comp.hole.filter(c => c.suit === card.suit).length;
      if (suitedCount > 1) score += 4;
    }
    if (score < worstScore) {
      worstScore = score;
      worstIdx = i;
    }
  });

  const card = state.comp.hole.splice(worstIdx, 1)[0];
  state.comp.discarded.push(card);
}


function endHand() {
  state.pot += state.human.bet + state.comp.bet;
  state.human.bet = 0;
  state.comp.bet = 0;

  const potWon = state.pot;

  let winner = null;
  let msg = '';

  if (state.human.folded) {
    winner = 'comp';
    msg = `Computer wins the pot of ${potWon} (you folded)`;
  } else if (state.comp.folded) {
    winner = 'human';
    msg = `You win the pot of ${potWon} (computer folded)`;
  } else {
    const hRank = handRank(state.human.hole, state.community);
    const cRank = handRank(state.comp.hole, state.community);

    if (hRank.score > cRank.score) {
      winner = 'human';
      msg = `You win with ${hRank.name} — Pot: ${potWon}`;
    } else if (cRank.score > hRank.score) {
      winner = 'comp';
      msg = `Computer wins with ${cRank.name} — Pot: ${potWon}`;
    } else {
      winner = 'tie';
      msg = `Split pot of ${potWon} — both have ${hRank.name}`;
    }
  }

  if (winner === 'human') state.human.stack += state.pot;
  else if (winner === 'comp') state.comp.stack += state.pot;
  else {
    state.human.stack += Math.floor(state.pot / 2);
    state.comp.stack += Math.ceil(state.pot / 2);
  }

  state.pot = 0;
  state.message = msg;
  state.phase = 'showdown';
  log(msg);
  updateUI();
}

// ===================== COMPUTER AI =====================
function estimateStrength(hole, community) {
  if (community.length === 0) {
    const vals = hole.map(c => RANK_VAL[c.rank]).sort((a, b) => b - a);
    let score = (vals[0] + vals[1]) / 24;
    if (vals[0] === vals[1]) score += 0.28;
    if (hole[0].suit === hole[1].suit) score += 0.06;
    return Math.min(0.95, score);
  }

  const rank = handRank(hole, community);
  if (rank.score >= 7000000) return 0.96;
  if (rank.score >= 6000000) return 0.90;
  if (rank.score >= 5000000) return 0.82;
  if (rank.score >= 4000000) return 0.74;
  if (rank.score >= 3000000) return 0.64;
  if (rank.score >= 2000000) return 0.52;
  if (rank.score >= 1000000) return 0.40;
  return 0.22 + (rank.score / 1000000) * 0.1;
}

function compAct() {
  if (state.acting !== 'comp' || state.comp.folded || state.gameOver) return;

  const p = state.comp;
  const toCall = state.currentBet - p.bet;
  const pot = state.pot + state.human.bet + p.bet;
  const strength = estimateStrength(p.hole, state.community);
  const diff = state.difficulty;

  let action = 'check';
  let raiseTo = 0;

  if (toCall === 0) {
    if (strength > 0.58 + (3 - diff) * 0.06 && Math.random() < 0.40 + diff * 0.12) {
      action = 'bet';
      raiseTo = Math.min(p.stack + p.bet, state.bb * (1 + Math.floor(Math.random() * 3)));
    } else {
      action = 'check';
    }
  } else {
    const potOdds = toCall / (pot + toCall);

    if (strength > potOdds + 0.10 - diff * 0.03) {
      if (strength > 0.70 && Math.random() < 0.30 + diff * 0.15) {
        action = 'raise';
        raiseTo = state.currentBet + Math.max(state.minRaise, state.bb * 2);
      } else {
        action = 'call';
      }
    } else if (strength < 0.32 && Math.random() < 0.55 + (3 - diff) * 0.1) {
      action = 'fold';
    } else {
      action = 'call';
    }
  }

  // Execute
  if (action === 'fold') {
    p.folded = true;
    logComputer('Computer folds');
    endHand();
    return;
  }

  if (action === 'check') {
    logComputer('Computer checks');
  } else if (action === 'call') {
    const amount = Math.min(toCall, p.stack);
    p.stack -= amount;
    p.bet += amount;
    if (p.stack === 0) p.allIn = true;
    logComputer(amount === 0 ? 'Computer checks' : `Computer calls ${amount}`);
  } else if (action === 'bet' || action === 'raise') {
    const maxAllowed = getMaxAllowed('comp');
    raiseTo = Math.max(raiseTo, state.currentBet + (state.currentBet === 0 ? state.bb : state.minRaise));
    raiseTo = Math.min(raiseTo, maxAllowed);

    const add = raiseTo - p.bet;
    p.stack -= add;
    p.bet += add;

    if (raiseTo > state.currentBet) {
      state.minRaise = raiseTo - state.currentBet;
      state.currentBet = raiseTo;
    }
    if (p.stack === 0) p.allIn = true;

    logComputer(action === 'bet' ? `Computer bets ${raiseTo}` : `Computer raises to ${raiseTo}`);
  }

  afterAction();
}

function confirmQuit() {
  if (confirm('Quit the current match and return to menu?')) {
    showScreen('menu');
  }
}

// ===================== INIT =====================
showScreen('menu');
