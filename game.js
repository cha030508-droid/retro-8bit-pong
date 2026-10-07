(() => {
  const W = 320;
  const H = 240;
  const PADDLE_W = 4;
  const PADDLE_H = 28;
  const BALL = 4;
  const PADDLE_SPEED = 2.6;
  const AI_SPEED = 1.85;
  const BALL_SPEED = 1.7;
  const BALL_SPEED_CAP = 4.2;
  const HIT_SPEEDUP = 0.12;
  const HIGH_KEY = "retro-pong-high-score";
  const MUTE_KEY = "retro-pong-muted";

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
  };

  const keys = new Set();
  let audioCtx = null;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let highScore = Number(localStorage.getItem(HIGH_KEY) || 0);

  const state = {
    screen: "menu",
    mode: "1p",
    rally: 0,
    left: { y: (H - PADDLE_H) / 2 },
    right: { y: (H - PADDLE_H) / 2 },
    ball: { x: W / 2, y: H / 2, vx: BALL_SPEED, vy: 0.6 },
    aiOffset: 0,
    serveTimer: 0,
    lastTime: 0,
  };

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
  }

  function updateMuteLabels() {
    const label = muted ? "SOUND: OFF" : "SOUND: ON";
    els.menuMute.textContent = label;
    els.pauseMute.textContent = label;
  }

  function updateHighScoreDisplay() {
    els.menuHigh.textContent = String(highScore);
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function beep(freq, duration, volume) {
    if (muted) return;
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = volume ?? 0.05;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function resetRally() {
    state.rally = 0;
    els.rally.textContent = "0";
    state.left.y = (H - PADDLE_H) / 2;
    state.right.y = (H - PADDLE_H) / 2;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
    state.ball.x = W / 2 - BALL / 2;
    state.ball.y = H / 2 - BALL / 2;
    state.ball.vx = Math.cos(angle) * BALL_SPEED * dir;
    if (Math.abs(state.ball.vx) < 1.2) state.ball.vx = 1.2 * dir;
    state.ball.vy = Math.sin(angle) * BALL_SPEED;
    state.aiOffset = (Math.random() - 0.5) * 16;
    state.serveTimer = 70;
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
  }

  function movePaddle(paddle, dir, dt) {
    paddle.y = clamp(paddle.y + dir * PADDLE_SPEED * dt, 8, H - PADDLE_H - 8);
  }

  function updateAI(dt) {
    const target = state.ball.y + BALL / 2 - PADDLE_H / 2 + state.aiOffset;
    const center = state.right.y;
    const diff = target - center;
    const step = clamp(diff, -AI_SPEED * dt, AI_SPEED * dt);
    state.right.y = clamp(state.right.y + step, 8, H - PADDLE_H - 8);
  }

  function paddleHit(paddleX, paddleY, ball) {
    return (
      ball.x < paddleX + PADDLE_W &&
      ball.x + BALL > paddleX &&
      ball.y < paddleY + PADDLE_H &&
      ball.y + BALL > paddleY
    );
  }

  function bounceOffPaddle(paddleY, goingRight) {
    const ballCenter = state.ball.y + BALL / 2;
    const paddleCenter = paddleY + PADDLE_H / 2;
    const offset = (ballCenter - paddleCenter) / (PADDLE_H / 2);
    const speed = Math.min(
      Math.hypot(state.ball.vx, state.ball.vy) + HIT_SPEEDUP,
      BALL_SPEED_CAP
    );
    const angle = offset * 0.7;
    const dir = goingRight ? 1 : -1;
    state.ball.vx = Math.cos(angle) * speed * dir;
    state.ball.vy = Math.sin(angle) * speed;
    if (Math.abs(state.ball.vx) < 1.1) state.ball.vx = 1.1 * dir;
    state.rally += 1;
    els.rally.textContent = String(state.rally);
    state.aiOffset = (Math.random() - 0.5) * 20;
    beep(goingRight ? 480 : 360, 0.05, 0.05);
  }

  function endGame(missedSide) {
    let title;
    if (state.mode === "1p") {
      title = missedSide === "left" ? "YOU LOSE" : "YOU WIN";
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
    beep(missedSide === "left" && state.mode === "1p" ? 140 : 620, 0.18, 0.06);
  }

  function updatePlay(dt) {
    const leftDir = (keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0);
    const yBefore = state.left.y;
    movePaddle(state.left, leftDir, dt);
    // #region agent log
    if (keys.size > 0 && (!updatePlay._dbg || Date.now() - updatePlay._dbg > 200)) {
      updatePlay._dbg = Date.now();
      fetch('http://127.0.0.1:7636/ingest/17d7fb7e-2bc3-4409-ac94-2e01da8a5e64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'224405'},body:JSON.stringify({sessionId:'224405',runId:'pre-fix',hypothesisId:'B,D',location:'game.js:updatePlay',message:'paddle update',data:{screen:state.screen,mode:state.mode,keys:[...keys],leftDir,yBefore,yAfter:state.left.y,dt,hasW:keys.has('w'),hasS:keys.has('s')},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion

    if (state.mode === "2p") {
      const rightDir =
        (keys.has("arrowdown") ? 1 : 0) - (keys.has("arrowup") ? 1 : 0);
      movePaddle(state.right, rightDir, dt);
    } else if (state.serveTimer <= 0) {
      updateAI(dt);
    }

    if (state.serveTimer > 0) {
      state.serveTimer -= dt;
      return;
    }

    state.ball.x += state.ball.vx * dt;
    state.ball.y += state.ball.vy * dt;

    if (state.ball.y <= 8) {
      state.ball.y = 8;
      state.ball.vy *= -1;
      beep(200, 0.03, 0.03);
    }
    if (state.ball.y + BALL >= H - 8) {
      state.ball.y = H - 8 - BALL;
      state.ball.vy *= -1;
      beep(200, 0.03, 0.03);
    }

    const leftX = 12;
    const rightX = W - 12 - PADDLE_W;

    if (state.ball.vx < 0 && paddleHit(leftX, state.left.y, state.ball)) {
      state.ball.x = leftX + PADDLE_W;
      bounceOffPaddle(state.left.y, true);
    } else if (
      state.ball.vx > 0 &&
      paddleHit(rightX, state.right.y, state.ball)
    ) {
      state.ball.x = rightX - BALL;
      bounceOffPaddle(state.right.y, false);
    }

    if (state.ball.x + BALL < 0) endGame("left");
    else if (state.ball.x > W) endGame("right");
  }

  function drawCourt() {
    ctx.fillStyle = "#050805";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1c2818";
    ctx.fillRect(0, 0, W, 8);
    ctx.fillRect(0, H - 8, W, 8);

    ctx.fillStyle = "#3a4a34";
    for (let y = 12; y < H - 12; y += 10) {
      ctx.fillRect(W / 2 - 1, y, 2, 5);
    }
  }

  function drawPlay() {
    drawCourt();
    ctx.fillStyle = "#e8f0e0";
    ctx.fillRect(12, Math.round(state.left.y), PADDLE_W, PADDLE_H);
    ctx.fillRect(W - 16, Math.round(state.right.y), PADDLE_W, PADDLE_H);
    ctx.fillRect(
      Math.round(state.ball.x),
      Math.round(state.ball.y),
      BALL,
      BALL
    );
  }

  function loop(now) {
    const dt = Math.min((now - state.lastTime) / 16.67, 2.5);
    state.lastTime = now;
    if (state.screen === "play") updatePlay(dt);
    if (state.screen === "play") {
      els.ready.classList.toggle("hidden", state.serveTimer <= 0);
    }
    if (state.screen === "menu") drawCourt();
    else drawPlay();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    // #region agent log
    fetch('http://127.0.0.1:7636/ingest/17d7fb7e-2bc3-4409-ac94-2e01da8a5e64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'224405'},body:JSON.stringify({sessionId:'224405',runId:'pre-fix',hypothesisId:'A,E',location:'game.js:keydown',message:'keydown',data:{key,rawKey:event.key,code:event.code,repeat:event.repeat,isComposing:event.isComposing,screen:state.screen,keysAfter:[...keys,key]},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    const upKey = event.key.toLowerCase();
    // #region agent log
    fetch('http://127.0.0.1:7636/ingest/17d7fb7e-2bc3-4409-ac94-2e01da8a5e64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'224405'},body:JSON.stringify({sessionId:'224405',runId:'pre-fix',hypothesisId:'C',location:'game.js:keyup',message:'keyup',data:{upKey,rawKey:event.key,code:event.code,keysBefore:[...keys],hadStored:keys.has(upKey)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    keys.delete(upKey);
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
  setScreen("menu");
  requestAnimationFrame((now) => {
    state.lastTime = now;
    loop(now);
  });
})();
