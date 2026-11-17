// Synthesized sound effects (WebAudio, no audio files): short oscillator and
// noise bursts, so the game has sound with zero network requests. The context
// is created lazily on the first user gesture, since browsers block audio
// before one; screenshot scenes never create it.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.14;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Resume the context after a user gesture (call from input handlers). */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone({ type = 'square', from = 440, to = null, duration = 0.08, volume = 1, delay = 0 }) {
    if (muted || !ensure()) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function noise({ duration = 0.12, volume = 0.7, lowpass = 1200, delay = 0 }) {
    if (muted || !ensure()) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone({ type: 'square', from: 880, to: 420, duration: 0.06, volume: 0.35 });
    },
    hit() {
      noise({ duration: 0.05, volume: 0.4, lowpass: 2400 });
    },
    enemyDie() {
      tone({ type: 'sawtooth', from: 320, to: 60, duration: 0.18, volume: 0.5 });
      noise({ duration: 0.14, volume: 0.5, lowpass: 900 });
    },
    pickup(combo) {
      const step = Math.min(combo, 12);
      tone({ type: 'sine', from: 520 + step * 36, to: 780 + step * 36, duration: 0.09, volume: 0.5 });
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone({ type: 'triangle', from: frequency, duration: 0.14, volume: 0.6, delay: index * 0.07 });
      });
    },
    dash() {
      noise({ duration: 0.16, volume: 0.45, lowpass: 3200 });
    },
    hurt() {
      tone({ type: 'sawtooth', from: 160, to: 70, duration: 0.22, volume: 0.7 });
    },
    waveClear() {
      [392, 523, 659].forEach((frequency, index) => {
        tone({ type: 'triangle', from: frequency, duration: 0.16, volume: 0.55, delay: index * 0.08 });
      });
    },
    victory() {
      [523, 659, 784, 1047, 1319].forEach((frequency, index) => {
        tone({ type: 'triangle', from: frequency, duration: 0.2, volume: 0.6, delay: index * 0.09 });
      });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((frequency, index) => {
        tone({ type: 'sawtooth', from: frequency, duration: 0.24, volume: 0.5, delay: index * 0.13 });
      });
    },
  };
}
