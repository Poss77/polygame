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

  // --- BACKGROUND MUSIC ENGINE (BGM) ---

  // Option 1: 16-Bit Cyber-Synthwave (FM Bass, Cyber Brass Chords & Electronic Drums)
  startSynthwaveLoop() {
    this.stopSynthwaveLoop();
    this.init();
    if (!this.ctx) return;

    this.isSynthwavePlaying = true;
    const tempo = 120; // 120 BPM Cyberpunk Synthwave
    const stepTime = (60 / tempo) / 4; // 16th note in seconds

    // Bassline Progression: A1 (55Hz), F1 (43.65Hz), D1 (36.71Hz), E1 (41.20Hz)
    const bassNotes = [
      55, 55, 110, 55, 55, 55, 110, 82.41,
      43.65, 43.65, 87.31, 43.65, 43.65, 43.65, 87.31, 65.41,
      36.71, 36.71, 73.42, 36.71, 36.71, 36.71, 73.42, 55,
      41.20, 41.20, 82.41, 41.20, 41.20, 41.20, 82.41, 98.00
    ];

    // Polyphonic Synth Chords (Am, F, Dm, Em)
    const chords = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [146.83, 174.61, 220], // Dm
      [164.81, 196.00, 246.94] // Em
    ];

    let step = 0;
    this.synthwaveTimer = setInterval(() => {
      if (!this.isSynthwavePlaying || !this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;
      const bassFreq = bassNotes[step % bassNotes.length];
      const barIndex = Math.floor((step % 32) / 8);
      const chord = chords[barIndex % chords.length];

      // 1. Heavy Analog Synth Bass (Dual Sawtooth + Lowpass filter sweep)
      if (bassFreq > 0) {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(bassFreq, t);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(bassFreq * 1.004, t); // Slight detune for analog warmth

        filter.type = 'lowpass';
        filter.Q.value = 4.0;
        filter.frequency.setValueAtTime(450, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + stepTime * 0.9);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepTime * 0.95);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + stepTime);
        osc2.stop(t + stepTime);
      }

      // 2. Cyberpunk Synth Brass Chords (Every 8 steps / half note)
      if (step % 8 === 0) {
        chord.forEach(freq => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, t);
          filter.frequency.exponentialRampToValueAtTime(250, t + stepTime * 7.5);

          gain.gain.setValueAtTime(0.025, t);
          gain.gain.exponentialRampToValueAtTime(0.0005, t + stepTime * 7.8);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + stepTime * 8);
        });
      }

      // 3. Electronic Kick (Beats 0 and 8 in 16th measure)
      if (step % 8 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(130, t);
        kickOsc.frequency.exponentialRampToValueAtTime(35, t + 0.14);

        kickGain.gain.setValueAtTime(0.12, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        kickOsc.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kickOsc.start(t);
        kickOsc.stop(t + 0.15);
      }

      // 4. Snare / Cyber Clap (Beats 4 and 12)
      if (step % 8 === 4) {
        const snareOsc = this.ctx.createOscillator();
        const snareGain = this.ctx.createGain();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(180, t);
        snareOsc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

        snareGain.gain.setValueAtTime(0.06, t);
        snareGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        snareOsc.connect(snareGain);
        snareGain.connect(this.ctx.destination);
        snareOsc.start(t);
        snareOsc.stop(t + 0.1);
      }

      step++;
    }, stepTime * 1000);
  }

  stopSynthwaveLoop() {
    this.isSynthwavePlaying = false;
    if (this.synthwaveTimer) {
      clearInterval(this.synthwaveTimer);
      this.synthwaveTimer = null;
    }
  }

  // Option 2: 100% Procedural 8-Bit Arcade Chiptune Synthesizer
  startChiptuneLoop() {
    this.stopChiptuneLoop();
    this.init();
    if (!this.ctx) return;

    this.isChiptunePlaying = true;
    const tempo = 135; // BPM
    const stepTime = (60 / tempo) / 4; // 16th note in seconds

    // Bassline note frequencies: A2 (110Hz), F2 (87.31Hz), C3 (130.81Hz), G2 (98Hz)
    const bassNotes = [
      110, 0, 110, 110, 110, 0, 110, 164.81, // A2 riff
      87.31, 0, 87.31, 87.31, 87.31, 0, 87.31, 130.81, // F2 riff
      130.81, 0, 130.81, 130.81, 130.81, 0, 130.81, 196.00, // C3 riff
      98.00, 0, 98.00, 98.00, 98.00, 0, 98.00, 146.83 // G2 riff
    ];

    // Arpeggio Lead Notes: Am, F, C, G
    const arpNotes = [
      440, 523.25, 659.25, 880, 659.25, 523.25, 659.25, 880,
      349.23, 440, 523.25, 698.46, 523.25, 440, 523.25, 698.46,
      523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 783.99, 1046.50,
      392, 493.88, 587.33, 783.99, 587.33, 493.88, 587.33, 783.99
    ];

    let step = 0;
    this.chiptuneTimer = setInterval(() => {
      if (!this.isChiptunePlaying || !this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;
      const bassFreq = bassNotes[step % bassNotes.length];
      const leadFreq = arpNotes[step % arpNotes.length];

      // 1. Synth Bass Note (Sawtooth)
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassFreq, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, t);

        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepTime * 0.9);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + stepTime);
      }

      // 2. Chiptune Lead Arpeggio (Square wave)
      if (leadFreq > 0 && (step % 2 === 0)) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(leadFreq, t);

        gain.gain.setValueAtTime(0.035, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepTime * 1.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + stepTime * 1.8);
      }

      // 3. Retro Hi-Hat Tick on 16th beats
      if (step % 2 === 1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2400, t);
        gain.gain.setValueAtTime(0.015, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.035);
      }

      step++;
    }, stepTime * 1000);
  }

  stopChiptuneLoop() {
    this.isChiptunePlaying = false;
    if (this.chiptuneTimer) {
      clearInterval(this.chiptuneTimer);
      this.chiptuneTimer = null;
    }
  }

  playBgm(mode = null) {
    if (!this.enabled) return;
    this.stopBgm();

    const selectedMode = mode || localStorage.getItem('astrododge_bgm_mode') || 'synthwave';
    this.currentBgmMode = selectedMode;

    if (selectedMode === 'chiptune' || selectedMode === 'synth') {
      this.startChiptuneLoop();
    } else {
      this.startSynthwaveLoop();
    }
  }

  stopBgm() {
    this.stopSynthwaveLoop();
    this.stopChiptuneLoop();
  }

  togglePreview(mode) {
    const isCurrentlyPreviewing = (this.previewingMode === mode);
    
    // Stop all audio first
    this.stopBgm();
    this.previewingMode = null;

    // Reset button states
    const btnSynthwave = document.getElementById('btn-preview-mp3');
    const btnChiptune = document.getElementById('btn-preview-synth');
    if (btnSynthwave) btnSynthwave.innerHTML = '▶️ 1. Cyber Synthwave';
    if (btnChiptune) btnChiptune.innerHTML = '▶️ 2. 8-Bit Arcade Chiptune';

    if (!isCurrentlyPreviewing) {
      this.previewingMode = mode;
      localStorage.setItem('astrododge_bgm_mode', mode);
      this.playBgm(mode);

      if ((mode === 'synthwave' || mode === 'mp3') && btnSynthwave) {
        btnSynthwave.innerHTML = '⏹️ Stop Synthwave';
      } else if ((mode === 'chiptune' || mode === 'synth') && btnChiptune) {
        btnChiptune.innerHTML = '⏹️ Stop Chiptune';
      }
    }
  }
}

export const sfx = new RetroSynth();
window.sfx = sfx;
window.toggleBgmSoundtrackPreview = function(mode) {
  if (window.sfx) window.sfx.togglePreview(mode);
};

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

