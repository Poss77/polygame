// --- Retro Synthesizer SFX Engine (Web Audio API) ---

export class RetroSynth {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.unlocked = false;
  }

  init() {
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.unlocked = true;
        }
      } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.unlocked = true;
      }).catch(() => {});
    }
  }

  toggle(forceState = null) {
    this.enabled = forceState !== null ? forceState : !this.enabled;
    const label = document.getElementById('sound-status-label');
    if (label) {
      label.innerText = this.enabled ? 'ON' : 'OFF';
      label.style.color = this.enabled ? 'var(--color-accent)' : 'var(--color-danger)';
    }
    if (this.enabled) this.init();
    return this.enabled;
  }

  // Double arpeggio tone for claims & rewards
  playSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Low gain to avoid ear-blasting
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.08, t);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    masterGain.connect(this.ctx.destination);

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      osc.connect(masterGain);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.2);
    });
  }

  playWin() {
    this.playSuccess();
  }

  // Triumphant multi-chord synth fanfare for Quantum Relic discoveries
  playRelicFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.12, t);
    masterGain.gain.linearRampToValueAtTime(0.001, t + 1.2);
    masterGain.connect(this.ctx.destination);

    // D4, F#4, A4, D5, F#5, A5 fanfare sequence
    const notes = [
      { f: 293.66, time: 0.00, dur: 0.18 }, // D4
      { f: 369.99, time: 0.12, dur: 0.18 }, // F#4
      { f: 440.00, time: 0.24, dur: 0.22 }, // A4
      { f: 587.33, time: 0.38, dur: 0.35 }, // D5
      { f: 739.99, time: 0.50, dur: 0.55 }, // F#5
      { f: 880.00, time: 0.50, dur: 0.65 }  // A5 harmonic
    ];

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t + n.time);
      osc.connect(masterGain);
      osc.start(t + n.time);
      osc.stop(t + n.time + n.dur);
    });
  }

  // Disappointing descending sweep for errors/cancels
  playError() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.12, t);
    masterGain.gain.linearRampToValueAtTime(0.001, t + 0.4);
    masterGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(80, t + 0.35);
    osc.connect(masterGain);
    
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Classic retro coin pickup chime
  playCoin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.06, t);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    masterGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.setValueAtTime(1318.51, t + 0.08); // E6
    
    osc.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // Quick cybernetic drum beat for Roshambo count downs
  playRoshamboDrum() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.15, t);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    masterGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.12);
    osc.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Frequency slide up for equips
  playPowerUp() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.07, t);
    masterGain.gain.linearRampToValueAtTime(0.001, t + 0.5);
    masterGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.4);

    osc.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  // White noise explosion with lowpass filter sweep for crash
  playExplosion() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const duration = 0.6;

    // Buffer generation
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + duration);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.12, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    noiseNode.start(t);
    noiseNode.stop(t + duration);
  }
}

export const sfx = new RetroSynth();
window.sfx = sfx;

if (typeof window !== 'undefined') {
  window._userHasInteracted = false;
  const unlockAudio = () => {
    window._userHasInteracted = true;
    if (window.sfx && typeof window.sfx.init === 'function') {
      window.sfx.init();
    }
  };
  ['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
    document.addEventListener(evt, unlockAudio, { capture: true, passive: true, once: true });
  });
}

