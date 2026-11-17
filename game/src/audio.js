export function createAudio() {
  let ctx = null, master = null, muted = false, musicTimer = null, engineOsc = null, engineGain = null, engineOn = false;
  let radio = 0, volume = 0.5;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume * 0.28;
      master.connect(ctx.destination);
    } catch { return false; }
    return true;
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  function tone(o) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.from, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.duration);
    g.gain.setValueAtTime(o.volume || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + o.duration);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + o.duration + 0.02);
  }
  function noise(o) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + (o.delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * o.duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.volume || 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + o.duration);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }
  const SCALES = [
    [55, 65.41, 82.41, 98, 110, 130.81],
    [49, 58.27, 73.42, 87.31, 98, 116.54],
    [61.74, 73.42, 92.5, 110, 123.47, 146.83],
  ];
  let step = 0;
  function musicTick() {
    if (muted || !ctx) return;
    const scale = SCALES[radio % SCALES.length];
    const bar = Math.floor(step / 8) % 4;
    const root = scale[bar % scale.length];
    tone({ type: 'sawtooth', from: root, duration: 0.22, volume: 0.16 });
    tone({ type: 'sawtooth', from: root * 2, duration: 0.12, volume: 0.07 });
    if (step % 2 === 0) tone({ type: 'square', from: scale[(step * 3) % scale.length] * 4, duration: 0.1, volume: 0.05 });
    if (step % 4 === 0) noise({ duration: 0.05, volume: 0.12, lowpass: 6000 });
    step += 1;
  }
  return {
    unlock, ensure,
    setMuted(m) { muted = m; if (muted && engineOn) this.engine(0); },
    isMuted() { return muted; },
    setVolume(v) { volume = v; if (master) master.gain.value = v * 0.28; },
    setRadio(r) { radio = r; },
    cycleRadio() { radio = (radio + 1) % 3; return radio; },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(musicTick, 190);
    },
    engine(speed01, nitro) {
      if (muted || !ensure()) { if (engineOn) { try { engineOsc.stop(); } catch { /* off */ } engineOn = false; } return; }
      if (!engineOn) {
        engineOsc = ctx.createOscillator(); engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.0;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
        engineOsc.start(); engineOn = true;
      }
      const target = 55 + speed01 * 160 + (nitro ? 60 : 0);
      engineOsc.frequency.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06 + (nitro ? 0.03 : 0), ctx.currentTime, 0.1);
    },
    engineOff() { if (engineOn) { try { engineOsc.stop(); } catch { /* off */ } engineOn = false; } },
    shoot() { tone({ type: 'square', from: 920, to: 380, duration: 0.07, volume: 0.35 }); },
    rifle() { tone({ type: 'square', from: 1200, to: 500, duration: 0.05, volume: 0.3 }); },
    sniper() { tone({ type: 'sawtooth', from: 1600, to: 200, duration: 0.18, volume: 0.4 }); noise({ duration: 0.12, volume: 0.4, lowpass: 3000 }); },
    hit() { noise({ duration: 0.05, volume: 0.4, lowpass: 2400 }); },
    die() { tone({ type: 'sawtooth', from: 320, to: 60, duration: 0.18, volume: 0.5 }); noise({ duration: 0.14, volume: 0.5, lowpass: 900 }); },
    pickup() { tone({ type: 'sine', from: 660, to: 990, duration: 0.09, volume: 0.5 }); },
    cash() { [880, 1174].forEach((f, i) => tone({ type: 'triangle', from: f, duration: 0.12, volume: 0.5, delay: i * 0.06 })); },
    nitro() { noise({ duration: 0.5, volume: 0.5, lowpass: 2400 }); },
    crash() { noise({ duration: 0.25, volume: 0.7, lowpass: 700 }); tone({ type: 'sawtooth', from: 120, to: 40, duration: 0.2, volume: 0.5 }); },
    hurt() { tone({ type: 'sawtooth', from: 160, to: 70, duration: 0.22, volume: 0.7 }); },
    thunder() { noise({ duration: 1.2, volume: 0.5, lowpass: 220 }); },
    siren(on) { /* police siren is visual only in this build */ },
    victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', from: f, duration: 0.2, volume: 0.6, delay: i * 0.09 })); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => tone({ type: 'sawtooth', from: f, duration: 0.24, volume: 0.5, delay: i * 0.13 })); },
  };
}
