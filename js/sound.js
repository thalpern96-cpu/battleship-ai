/* Sound effects synthesised with the Web Audio API (no audio files needed). */
(function (root) {
  'use strict';

  const MUTE_KEY = 'battleship-ai-muted';
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* ignore */ }

  function context() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  function noiseBuffer(ac, seconds) {
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function envelope(ac, gainValue, attack, decay, start) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gainValue, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    g.connect(ac.destination);
    return g;
  }

  function noise(ac, { start, duration, gain, filter, from, to, q }) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, duration);
    const f = ac.createBiquadFilter();
    f.type = filter;
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(from, start);
    f.frequency.exponentialRampToValueAtTime(to, start + duration);
    src.connect(f);
    f.connect(envelope(ac, gain, 0.01, duration, start));
    src.start(start);
    src.stop(start + duration + 0.05);
  }

  function tone(ac, { start, duration, gain, type, from, to }) {
    const osc = ac.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to || from, start + duration);
    osc.connect(envelope(ac, gain, 0.01, duration, start));
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  const SOUNDS = {
    fire(ac, t) { tone(ac, { start: t, duration: 0.12, gain: 0.15, type: 'square', from: 220, to: 80 }); },
    miss(ac, t) {
      noise(ac, { start: t, duration: 0.45, gain: 0.35, filter: 'bandpass', from: 1800, to: 300, q: 0.8 });
      tone(ac, { start: t, duration: 0.25, gain: 0.08, from: 600, to: 200 });
    },
    hit(ac, t) {
      noise(ac, { start: t, duration: 0.6, gain: 0.6, filter: 'lowpass', from: 3000, to: 120 });
      tone(ac, { start: t, duration: 0.4, gain: 0.5, from: 120, to: 40 });
    },
    sunk(ac, t) {
      SOUNDS.hit(ac, t);
      noise(ac, { start: t + 0.25, duration: 1.2, gain: 0.3, filter: 'lowpass', from: 800, to: 60 });
      tone(ac, { start: t + 0.2, duration: 1.1, gain: 0.25, type: 'triangle', from: 300, to: 50 });
    },
    move(ac, t) {
      tone(ac, { start: t, duration: 0.15, gain: 0.12, type: 'triangle', from: 300, to: 500 });
      tone(ac, { start: t + 0.15, duration: 0.15, gain: 0.12, type: 'triangle', from: 500, to: 700 });
    },
    win(ac, t) {
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, { start: t + i * 0.15, duration: 0.3, gain: 0.2, type: 'triangle', from: f }));
    },
    lose(ac, t) {
      [392, 330, 262, 196].forEach((f, i) => tone(ac, { start: t + i * 0.22, duration: 0.4, gain: 0.2, type: 'sawtooth', from: f, to: f * 0.97 }));
    },
  };

  function play(name) {
    if (muted || !SOUNDS[name]) return;
    const ac = context();
    if (!ac) return;
    try {
      if (ac.state === 'suspended') ac.resume();
      SOUNDS[name](ac, ac.currentTime + 0.01);
    } catch (e) { /* audio is optional */ }
  }

  function setMuted(value) {
    muted = !!value;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  root.BattleshipSound = { play, setMuted, isMuted: () => muted };
})(typeof window !== 'undefined' ? window : this);
