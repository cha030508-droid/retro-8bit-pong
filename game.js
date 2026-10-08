(() => {
  const W = 320;
  const H = 240;
  const PADDLE_W = 4;
  const PADDLE_H = 28;
  const BALL = 4;
  const PADDLE_SPEED = 2.6;
  const AI_SPEED = 1.85;
  const BALL_SPEED = 1.7;
  const BALL_SPEED_CAP = 6.4;
  const HIT_SPEEDUP = 0.12;
  const MILESTONE = 10;
  const MILESTONE_BOOST = 0.45;
  const HIGH_KEY = "retro-pong-high-score";
  const MUTE_KEY = "retro-pong-muted";
  const CONTROLS_KEY = "retro-pong-1p-keys";
  const TWO_BALL_KEY = "retro-pong-two-ball";
  const RAINBOW = [
    "#ff4d4d",
    "#ff9a3c",
    "#ffe14d",
    "#7cff6b",
    "#4dc4ff",
    "#6b6bff",
    "#d45cff",
  ];
  const ACCENT_START = 3;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const els = {
    menu: document.getElementById("menu"),
    hud: document.getElementById("hud"),
    pause: document.getElementById("pause"),
    gameover: document.getElementById("gameover"),
    rally: document.getElementById("rally"),
    menuHigh: document.getElementById("menu-high"),
    overTitle: document.getElementById("over-title"),
    overRally: document.getElementById("over-rally"),
    overRecord: document.getElementById("over-record"),
    menuMute: document.getElementById("menu-mute"),
    pauseMute: document.getElementById("pause-mute"),
    ready: document.getElementById("ready"),
    controls: document.getElementById("controls"),
    twoball: document.getElementById("twoball"),
  };

  const keys = new Set();
  let audioCtx = null;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let highScore = Number(localStorage.getItem(HIGH_KEY) || 0);
  let onePlayerKeys =
    localStorage.getItem(CONTROLS_KEY) === "arrows" ? "arrows" : "ws";
  let twoBalls = localStorage.getItem(TWO_BALL_KEY) === "1";

  const state = {
    screen: "menu",
    mode: "1p",
    rally: 0,
    left: { y: (H - PADDLE_H) / 2 },
    right: { y: (H - PADDLE_H) / 2 },
    balls: [],
    aiOffset: 0,
    serveTimer: 0,
    lastTime: 0,
    accent: ACCENT_START,
  };

  function accentColor() {
    return RAINBOW[state.accent];
  }

  function applyAccent() {
    document.documentElement.style.setProperty("--accent", accentColor());
  }

  function show(el) {
    el.classList.remove("hidden");
  }

  function hide(el) {
    el.classList.add("hidden");
  }

  function setScreen(name) {
    state.screen = name;
    hide(els.menu);
    hide(els.hud);
    hide(els.pause);
    hide(els.gameover);
    if (name === "menu") show(els.menu);
    if (name === "play") show(els.hud);
    if (name === "pause") {
      show(els.hud);
      show(els.pause);
    }
    if (name === "over") show(els.gameover);
    if ((name === "play" || name === "pause") && state.mode === "1p") {
      show(els.controls);
    } else {
      hide(els.controls);
    }
  }

  function updateMuteLabels() {
    const label = muted ? "SOUND: OFF" : "SOUND: ON";
    els.menuMute.textContent = label;
    els.pauseMute.textContent = label;
  }

  function updateHighScoreDisplay() {
    els.menuHigh.textContent = String(highScore);
  }

  function updateControlsLabel() {
    els.controls.textContent =
      onePlayerKeys === "arrows" ? "KEYS: ARROWS" : "KEYS: W/S";
  }

  function updateTwoBallLabel() {
    els.twoball.textContent = twoBalls ? "TWO BALL: ON" : "TWO BALL: OFF";
  }

  function toggleTwoBalls() {
    twoBalls = !twoBalls;
    localStorage.setItem(TWO_BALL_KEY, twoBalls ? "1" : "0");
    updateTwoBallLabel();
    beep(520, 0.05, 0.04);
  }

  function toggleOnePlayerKeys() {
    onePlayerKeys = onePlayerKeys === "ws" ? "arrows" : "ws";
    localStorage.setItem(CONTROLS_KEY, onePlayerKeys);
    updateControlsLabel();
    beep(520, 0.05, 0.04);
  }

  function playerDir(scheme) {
    if (scheme === "arrows") {
      return (keys.has("arrowdown") ? 1 : 0) - (keys.has("arrowup") ? 1 : 0);
    }
    return (keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0);
  }

  function ensureAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (err) {
      /* audio optional */
    }
  }

  function beep(freq, duration, volume) {
    if (muted) return;
    ensureAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = volume == null ? 0.05 : volume;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function serveBall(dir, y) {
    const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
    const ball = {
      x: W / 2 - BALL / 2,
      y,
      vx: Math.cos(angle) * BALL_SPEED * dir,
      vy: Math.sin(angle) * BALL_SPEED,
    };
    if (Math.abs(ball.vx) < 1.2) ball.vx = 1.2 * dir;
    return ball;
  }

  function resetRally() {
    state.rally = 0;
    els.rally.textContent = "0";
    state.left.y = (H - PADDLE_H) / 2;
    state.right.y = (H - PADDLE_H) / 2;
    if (twoBalls) {
      state.balls = [serveBall(-1, H / 2 - 36), serveBall(1, H / 2 + 32)];
    } else {
      const dir = Math.random() < 0.5 ? 1 : -1;
      state.balls = [serveBall(dir, H / 2 - BALL / 2)];
    }
    state.aiOffset = (Math.random() - 0.5) * 16;
    state.serveTimer = 70;
    state.accent = ACCENT_START;
    applyAccent();
  }

  function startGame(mode) {
    state.mode = mode;
    resetRally();
    setMenuIndex(els.menu, 0);
    setMenuIndex(els.pause, 0);
    setScreen("play");
    beep(440, 0.08, 0.04);
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    updateMuteLabels();
    if (!muted) beep(660, 0.06, 0.04);
  }

  function overlayItems(overlay) {
    return [...overlay.querySelectorAll(".menu-item")];
  }

  function selectedIndex(overlay) {
    const items = overlayItems(overlay);
    return Math.max(
      0,
      items.findIndex((item) => item.classList.contains("selected"))
    );
  }

  function setMenuIndex(overlay, index) {
    const items = overlayItems(overlay);
    items.forEach((item, i) => {
      item.classList.toggle("selected", i === index);
    });
  }

  function moveMenu(overlay, delta) {
    const items = overlayItems(overlay);
    const next = (selectedIndex(overlay) + delta + items.length) % items.length;
    setMenuIndex(overlay, next);
    beep(220, 0.04, 0.03);
  }

  function activateMenu(overlay) {
    const items = overlayItems(overlay);
    const item = items[selectedIndex(overlay)];
    if (item) runAction(item.dataset.action);
  }

  function runAction(action) {
    if (action === "1p") startGame("1p");
    if (action === "2p") startGame("2p");
    if (action === "mute") toggleMute();
    if (action === "resume") {
      setScreen("play");
      beep(520, 0.06, 0.04);
    }
    if (action === "new") {
      setScreen("menu");
      updateHighScoreDisplay();
      beep(180, 0.08, 0.04);
    }
    if (action === "controls") toggleOnePlayerKeys();
  }

  function movePaddle(paddle, dir, dt) {
    paddle.y = clamp(paddle.y + dir * PADDLE_SPEED * dt, 4, H - PADDLE_H - 4);
  }

  function chaseBall() {
    const incoming = state.balls.filter((ball) => ball.vx < 0);
    const pool = incoming.length ? incoming : state.balls;
    return pool.reduce((closest, ball) => (ball.x < closest.x ? ball : closest));
  }

  function updateAI(dt) {
    const ball = chaseBall();
    const target = ball.y + BALL / 2 - PADDLE_H / 2 + state.aiOffset;
    const diff = target - state.left.y;
    const step = clamp(diff, -AI_SPEED * dt, AI_SPEED * dt);
    state.left.y = clamp(state.left.y + step, 4, H - PADDLE_H - 4);
  }

  function paddleHit(paddleX, paddleY, ball) {
    return (
      ball.x < paddleX + PADDLE_W &&
      ball.x + BALL > paddleX &&
      ball.y < paddleY + PADDLE_H &&
      ball.y + BALL > paddleY
    );
  }

  function setBallSpeed(ball, speed, dirX) {
    const angle = Math.atan2(ball.vy, ball.vx);
    const dir = dirX == null ? Math.sign(ball.vx) || 1 : dirX;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    if (Math.sign(ball.vx) !== dir) {
      ball.vx = Math.abs(ball.vx) * dir;
    }
  }

  function boostAllBalls(amount) {
    for (const ball of state.balls) {
      const speed = Math.min(
        Math.hypot(ball.vx, ball.vy) + amount,
        BALL_SPEED_CAP
      );
      setBallSpeed(ball, speed);
    }
  }

  function bounceOffPaddle(ball, paddleY, goingRight) {
    const ballCenter = ball.y + BALL / 2;
    const paddleCenter = paddleY + PADDLE_H / 2;
    const offset = (ballCenter - paddleCenter) / (PADDLE_H / 2);
    let speed = Math.min(
      Math.hypot(ball.vx, ball.vy) + HIT_SPEEDUP,
      BALL_SPEED_CAP
    );
    const angle = offset * 0.7;
    const dir = goingRight ? 1 : -1;
    ball.vx = Math.cos(angle) * speed * dir;
    ball.vy = Math.sin(angle) * speed;
    if (Math.abs(ball.vx) < 1.1) ball.vx = 1.1 * dir;
    state.rally += 1;
    els.rally.textContent = String(state.rally);
    if (state.rally % MILESTONE === 0) {
      boostAllBalls(MILESTONE_BOOST);
      beep(720, 0.08, 0.06);
    }
    state.aiOffset = (Math.random() - 0.5) * 20;
    state.accent = (state.accent + 1) % RAINBOW.length;
    applyAccent();
    beep(goingRight ? 480 : 360, 0.05, 0.05);
  }

  function endGame(missedSide) {
    let title;
    if (state.mode === "1p") {
      title = missedSide === "right" ? "YOU LOSE" : "YOU WIN";
    } else {
      title = missedSide === "left" ? "PLAYER 2 WINS" : "PLAYER 1 WINS";
    }

    let isRecord = false;
    if (state.rally > highScore) {
      highScore = state.rally;
      localStorage.setItem(HIGH_KEY, String(highScore));
      isRecord = true;
    }

    els.overTitle.textContent = title;
    els.overRally.textContent = String(state.rally);
    els.overRecord.classList.toggle("hidden", !isRecord);
    setScreen("over");
    beep(missedSide === "right" && state.mode === "1p" ? 140 : 620, 0.18, 0.06);
  }

  function updatePlay(dt) {
    if (state.mode === "2p") {
      movePaddle(state.left, playerDir("ws"), dt);
      movePaddle(state.right, playerDir("arrows"), dt);
    } else {
      movePaddle(state.right, playerDir(onePlayerKeys), dt);
      if (state.serveTimer <= 0) updateAI(dt);
    }

    if (state.serveTimer > 0) {
      state.serveTimer -= dt;
      return;
    }

    const leftX = 12;
    const rightX = W - 12 - PADDLE_W;

    for (const ball of state.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.y <= 4) {
        ball.y = 4;
        ball.vy *= -1;
        beep(200, 0.03, 0.03);
      }
      if (ball.y + BALL >= H - 4) {
        ball.y = H - 4 - BALL;
        ball.vy *= -1;
        beep(200, 0.03, 0.03);
      }

      if (ball.vx < 0 && paddleHit(leftX, state.left.y, ball)) {
        ball.x = leftX + PADDLE_W;
        bounceOffPaddle(ball, state.left.y, true);
      } else if (ball.vx > 0 && paddleHit(rightX, state.right.y, ball)) {
        ball.x = rightX - BALL;
        bounceOffPaddle(ball, state.right.y, false);
      }

      if (ball.x + BALL < 0) {
        endGame("left");
        return;
      }
      if (ball.x > W) {
        endGame("right");
        return;
      }
    }
  }

  function drawCourt() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, 4);
    ctx.fillRect(0, H - 4, W, 4);

    ctx.fillStyle = "#fff";
    for (let y = 10; y < H - 10; y += 10) {
      ctx.fillRect(W / 2 - 1, y, 2, 5);
    }
  }

  function drawPlay() {
    drawCourt();
    ctx.fillStyle = accentColor();
    ctx.fillRect(12, Math.round(state.left.y), PADDLE_W, PADDLE_H);
    ctx.fillRect(W - 16, Math.round(state.right.y), PADDLE_W, PADDLE_H);
    for (const ball of state.balls) {
      ctx.fillRect(Math.round(ball.x), Math.round(ball.y), BALL, BALL);
    }
  }

  function loop(now) {
    const dt = Math.min((now - state.lastTime) / 16.67, 2.5);
    state.lastTime = now;
    if (state.screen === "play") updatePlay(dt);
    if (state.screen === "play") {
      els.ready.classList.toggle("hidden", state.serveTimer <= 0);
    } else {
      els.ready.classList.add("hidden");
    }
    if (state.screen === "menu") drawCourt();
    else drawPlay();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (
      [
        "arrowup",
        "arrowdown",
        " ",
        "enter",
        "p",
        "escape",
        "w",
        "s",
      ].includes(key)
    ) {
      event.preventDefault();
    }
    keys.add(key);
    if (event.code === "KeyW") keys.add("w");
    if (event.code === "KeyS") keys.add("s");

    if (["arrowup", "arrowdown", "enter", " "].includes(key)) ensureAudio();

    if (state.screen === "menu") {
      if (key === "arrowup") moveMenu(els.menu, -1);
      if (key === "arrowdown") moveMenu(els.menu, 1);
      if (key === "enter" || key === " ") activateMenu(els.menu);
      return;
    }

    if (state.screen === "pause") {
      if (key === "arrowup") moveMenu(els.pause, -1);
      if (key === "arrowdown") moveMenu(els.pause, 1);
      if (key === "enter" || key === " ") activateMenu(els.pause);
      if (key === "escape" || key === "p") runAction("resume");
      return;
    }

    if (state.screen === "over") {
      if (key === "enter" || key === " ") runAction("new");
      return;
    }

    if (state.screen === "play") {
      if (key === "escape" || key === "p") {
        setScreen("pause");
        beep(240, 0.05, 0.03);
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
    if (event.code === "KeyW") keys.delete("w");
    if (event.code === "KeyS") keys.delete("s");
  });

  els.controls.addEventListener("click", () => {
    ensureAudio();
    toggleOnePlayerKeys();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("#twoball")) toggleTwoBalls();
  });

  document.querySelectorAll(".menu-item").forEach((button) => {
    button.addEventListener("mouseenter", () => {
      const overlay = button.closest(".overlay");
      const items = overlayItems(overlay);
      setMenuIndex(overlay, items.indexOf(button));
    });
    button.addEventListener("click", () => {
      ensureAudio();
      runAction(button.dataset.action);
    });
  });

  updateMuteLabels();
  updateHighScoreDisplay();
  updateControlsLabel();
  updateTwoBallLabel();
  applyAccent();
  setScreen("menu");
  requestAnimationFrame((now) => {
    state.lastTime = now;
    loop(now);
  });
})();
