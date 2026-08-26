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

  // --- BACKGROUND MUSIC ENGINE (BGM) ---

  // Option 1: 16-Bit Cyber-Synthwave (Progressive Layering & 3-Loop Variation Engine)
  startSynthwaveLoop() {
    this.stopSynthwaveLoop();
    this.init();
    if (!this.ctx) return;

    this.isSynthwavePlaying = true;
    const tempo = 124; // 124 BPM Cyberpunk Synthwave
    const stepTime = (60 / tempo) / 4; // 16th note in seconds (~121ms)

    // 3 Distinct Chord Progressions for Loop Variations A, B, and C
    const loopChords = [
      // Loop 1 (Cosmic Voyage): Am -> F -> C -> G
      [
        [220, 261.63, 329.63],    // Am
        [174.61, 220, 261.63],    // F
        [261.63, 329.63, 392.00], // C
        [196.00, 246.94, 293.66]  // G
      ],
      // Loop 2 (Neon Chorus): F -> G -> Em -> Am
      [
        [174.61, 220, 261.63],    // F
        [196.00, 246.94, 293.66], // G
        [164.81, 196.00, 246.94], // Em
        [220, 261.63, 329.63]     // Am
      ],
      // Loop 3 (Apex Climax): Dm -> G -> C -> E7
      [
        [146.83, 174.61, 220],    // Dm
        [196.00, 246.94, 293.66], // G
        [261.63, 329.63, 392.00], // C
        [164.81, 207.65, 246.94]  // E7 (E-G#-B)
      ]
    ];

    // Bassline note frequencies across the 3 loops
    const bassPatterns = [
      // Loop 1 Bass (A, F, C, G)
      [
        55, 55, 110, 55, 55, 55, 110, 82.41,
        43.65, 43.65, 87.31, 43.65, 43.65, 43.65, 87.31, 65.41,
        65.41, 65.41, 130.81, 65.41, 65.41, 65.41, 130.81, 98.00,
        49.00, 49.00, 98.00, 49.00, 49.00, 49.00, 98.00, 110.00
      ],
      // Loop 2 Bass (F, G, Em, Am)
      [
        43.65, 43.65, 87.31, 43.65, 43.65, 43.65, 87.31, 65.41,
        49.00, 49.00, 98.00, 49.00, 49.00, 49.00, 98.00, 73.42,
        41.20, 41.20, 82.41, 41.20, 41.20, 41.20, 82.41, 61.74,
        55.00, 55.00, 110.0, 55.00, 55.00, 55.00, 110.0, 82.41
      ],
      // Loop 3 Bass (Dm, G, C, E7)
      [
        36.71, 36.71, 73.42, 36.71, 36.71, 36.71, 73.42, 55.00,
        49.00, 49.00, 98.00, 49.00, 49.00, 49.00, 98.00, 73.42,
        65.41, 65.41, 130.81, 65.41, 65.41, 65.41, 130.81, 98.00,
        41.20, 41.20, 82.41, 41.20, 82.41, 98.00, 110.0, 123.47
      ]
    ];

    // Melodic Lead Arpeggios across the 3 loops
    const leadPatterns = [
      // Loop 1 Melody (Space Exploration)
      [
        440, 0, 523.25, 0, 659.25, 0, 523.25, 659.25,
        349.23, 0, 440, 0, 523.25, 0, 440, 523.25,
        523.25, 0, 659.25, 0, 783.99, 0, 659.25, 783.99,
        392.00, 0, 493.88, 0, 587.33, 0, 493.88, 440
      ],
      // Loop 2 Melody (Uplifting Neon Chorus)
      [
        698.46, 659.25, 523.25, 440, 523.25, 659.25, 698.46, 880,
        783.99, 698.46, 587.33, 493.88, 587.33, 698.46, 783.99, 987.77,
        659.25, 587.33, 493.88, 392, 493.88, 587.33, 659.25, 783.99,
        880, 783.99, 659.25, 523.25, 659.25, 783.99, 880, 1046.50
      ],
      // Loop 3 Melody (Apex High-Speed Solo)
      [
        587.33, 659.25, 698.46, 880, 698.46, 659.25, 587.33, 440,
        783.99, 880, 987.77, 1174.66, 987.77, 880, 783.99, 587.33,
        1046.50, 987.77, 880, 783.99, 880, 987.77, 1046.50, 1318.51,
        1318.51, 1244.51, 1174.66, 1046.50, 987.77, 880, 830.61, 880
      ]
    ];

    let globalStep = 0;
    this.synthwaveTimer = setInterval(() => {
      if (!this.isSynthwavePlaying || !this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;

      // 3-Loop Cycling: Loop 0 (Cosmic Drive) -> Loop 1 (Neon Chorus) -> Loop 2 (Apex Climax)
      const loopIndex = Math.floor((globalStep / 32) % 3);
      const stepInLoop = globalStep % 32;
      const barInLoop = Math.floor(stepInLoop / 8);

      const bassNotes = bassPatterns[loopIndex];
      const chords = loopChords[loopIndex];
      const leads = leadPatterns[loopIndex];

      const bassFreq = bassNotes[stepInLoop];
      const chord = chords[barInLoop % chords.length];
      const leadFreq = leads[stepInLoop];

      // PROGRESSIVE LAYER LOGIC:
      // Steps 0-15:   Layer 1 - Bass + Hi-Hats only (Smooth Intro Pulse)
      // Steps 16-31:  Layer 2 - Electronic Kick Drum enters
      // Steps 32-63:  Layer 3 - Snare / Claps + Ambient Synth Pads enter
      // Steps 64+:    Layer 4 - Full Melody Lead Arp & Climax solos unlock!
      const isKickActive = globalStep >= 16;
      const isSnareActive = globalStep >= 32;
      const isChordsActive = globalStep >= 32;
      const isLeadActive = globalStep >= 64;

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
        filter.frequency.setValueAtTime(480, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + stepTime * 0.9);

        gain.gain.setValueAtTime(0.085, t);
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
      if (isChordsActive && (stepInLoop % 8 === 0)) {
        chord.forEach(freq => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(650, t);
          filter.frequency.exponentialRampToValueAtTime(250, t + stepTime * 7.5);

          gain.gain.setValueAtTime(0.024, t);
          gain.gain.exponentialRampToValueAtTime(0.0005, t + stepTime * 7.8);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + stepTime * 8);
        });
      }

      // 3. Melodic Synth Lead Arp (16th note runs)
      if (isLeadActive && leadFreq > 0) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        const leadFilter = this.ctx.createBiquadFilter();

        leadOsc.type = (loopIndex === 2) ? 'sawtooth' : 'square';
        leadOsc.frequency.setValueAtTime(leadFreq, t);

        leadFilter.type = 'bandpass';
        leadFilter.Q.value = 2.5;
        leadFilter.frequency.setValueAtTime(1400, t);

        leadGain.gain.setValueAtTime(0.028, t);
        leadGain.gain.exponentialRampToValueAtTime(0.001, t + stepTime * 1.6);

        leadOsc.connect(leadFilter);
        leadFilter.connect(leadGain);
        leadGain.connect(this.ctx.destination);

        leadOsc.start(t);
        leadOsc.stop(t + stepTime * 1.8);
      }

      // 4. Electronic Kick Drum (On beats 0 and 8, plus syncopated beat 14 in Loops 2 & 3)
      const hasDoubleKick = (loopIndex >= 1 && stepInLoop % 16 === 14);
      if (isKickActive && ((stepInLoop % 8 === 0) || hasDoubleKick)) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(135, t);
        kickOsc.frequency.exponentialRampToValueAtTime(35, t + 0.14);

        kickGain.gain.setValueAtTime(0.12, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        kickOsc.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kickOsc.start(t);
        kickOsc.stop(t + 0.15);
      }

      // 5. Snare / Cyber Clap (On beats 4 and 12, with turnaround snare fills)
      const isTurnaroundFill = (stepInLoop >= 28 && (stepInLoop % 2 === 0));
      if (isSnareActive && ((stepInLoop % 8 === 4) || (loopIndex === 2 && isTurnaroundFill))) {
        const snareOsc = this.ctx.createOscillator();
        const snareGain = this.ctx.createGain();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(190, t);
        snareOsc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

        snareGain.gain.setValueAtTime(0.065, t);
        snareGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        snareOsc.connect(snareGain);
        snareGain.connect(this.ctx.destination);
        snareOsc.start(t);
        snareOsc.stop(t + 0.1);
      }

      // 6. Neon Hi-Hats (Ticking 16th notes with accent on off-beats)
      if (stepInLoop % 2 === 1) {
        const hatOsc = this.ctx.createOscillator();
        const hatGain = this.ctx.createGain();
        hatOsc.type = 'square';
        hatOsc.frequency.setValueAtTime(2800, t);
        hatGain.gain.setValueAtTime(0.016, t);
        hatGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
        hatOsc.connect(hatGain);
        hatGain.connect(this.ctx.destination);
        hatOsc.start(t);
        hatOsc.stop(t + 0.04);
      }

      globalStep++;
    }, stepTime * 1000);
  }

  stopSynthwaveLoop() {
    this.isSynthwavePlaying = false;
    if (this.synthwaveTimer) {
      clearInterval(this.synthwaveTimer);
      this.synthwaveTimer = null;
    }
  }

  // Option 2: 100% Procedural 8-Bit Arcade Chiptune Synthesizer (Multi-Loop Dynamic Engine)
  startChiptuneLoop() {
    this.stopChiptuneLoop();
    this.init();
    if (!this.ctx) return;

    this.isChiptunePlaying = true;
    const tempo = 136; // 136 BPM Classic Arcade
    const stepTime = (60 / tempo) / 4; // 16th note in seconds

    // 3 Loops of 8-Bit Arpeggio Leads
    const arpPatterns = [
      // Loop 1: Am, F, C, G
      [
        440, 523.25, 659.25, 880, 659.25, 523.25, 659.25, 880,
        349.23, 440, 523.25, 698.46, 523.25, 440, 523.25, 698.46,
        523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 783.99, 1046.50,
        392, 493.88, 587.33, 783.99, 587.33, 493.88, 587.33, 783.99
      ],
      // Loop 2: F, G, Em, Am
      [
        698.46, 880, 1046.50, 1396.91, 1046.50, 880, 1046.50, 1396.91,
        783.99, 987.77, 1174.66, 1567.98, 1174.66, 987.77, 1174.66, 1567.98,
        659.25, 783.99, 987.77, 1318.51, 987.77, 783.99, 987.77, 1318.51,
        880, 1046.50, 1318.51, 1760.00, 1318.51, 1046.50, 1318.51, 1760.00
      ],
      // Loop 3: Dm, G, C, E7 Climax
      [
        587.33, 698.46, 880, 1174.66, 880, 698.46, 880, 1174.66,
        783.99, 987.77, 1174.66, 1567.98, 1174.66, 987.77, 1174.66, 1567.98,
        1046.50, 1318.51, 1567.98, 2093.00, 1567.98, 1318.51, 1567.98, 2093.00,
        1318.51, 1661.22, 1975.53, 2637.02, 1975.53, 1661.22, 1975.53, 2637.02
      ]
    ];

    const bassPatterns = [
      [110, 0, 110, 110, 110, 0, 110, 164.81, 87.31, 0, 87.31, 87.31, 87.31, 0, 87.31, 130.81, 130.81, 0, 130.81, 130.81, 130.81, 0, 130.81, 196.00, 98.00, 0, 98.00, 98.00, 98.00, 0, 98.00, 146.83],
      [87.31, 0, 87.31, 87.31, 87.31, 0, 87.31, 130.81, 98.00, 0, 98.00, 98.00, 98.00, 0, 98.00, 146.83, 82.41, 0, 82.41, 82.41, 82.41, 0, 82.41, 123.47, 110, 0, 110, 110, 110, 0, 110, 164.81],
      [73.42, 0, 73.42, 73.42, 73.42, 0, 73.42, 110.00, 98.00, 0, 98.00, 98.00, 98.00, 0, 98.00, 146.83, 130.81, 0, 130.81, 130.81, 130.81, 0, 130.81, 196.00, 82.41, 0, 82.41, 82.41, 164.81, 0, 207.65, 246.94]
    ];

    let globalStep = 0;
    this.chiptuneTimer = setInterval(() => {
      if (!this.isChiptunePlaying || !this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;

      const loopIndex = Math.floor((globalStep / 32) % 3);
      const stepInLoop = globalStep % 32;

      const bassNotes = bassPatterns[loopIndex];
      const arpNotes = arpPatterns[loopIndex];

      const bassFreq = bassNotes[stepInLoop];
      const leadFreq = arpNotes[stepInLoop];

      // Progressive Layering
      const isLeadActive = globalStep >= 16;
      const isHiHatActive = globalStep >= 8;

      // 1. Synth Bass Note (Sawtooth)
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassFreq, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(340, t);

        gain.gain.setValueAtTime(0.065, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepTime * 0.9);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + stepTime);
      }

      // 2. Chiptune Lead Arpeggio (Square wave)
      if (isLeadActive && leadFreq > 0 && (stepInLoop % 2 === 0)) {
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
      if (isHiHatActive && (stepInLoop % 2 === 1)) {
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

      globalStep++;
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

  // ==============================================================================
  // CYBER SKEET: Playful Retro Toy Blaster Synthesizer Sound Engine
  // ==============================================================================

  // Playful sci-fi toy laser pew-pew pop
  playToyBlasterShot() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    gain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    // Bubbly downward frequency sweep from 980Hz to 180Hz
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.12);

    // Subtle secondary sub-pop
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(320, t);
    subOsc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    subOsc.connect(gain);
    subOsc.start(t);
    subOsc.stop(t + 0.08);
  }

  // Playful mechanical trap release boing-whoosh
  playSkeetTrapLaunch() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    gain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    // Boing pitch rise then drop
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(540, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.18);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Arcade clay shatter pop-crackle with sparkling harmonics
  playClayShatter(isSpecial = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isSpecial ? 0.15 : 0.10, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    gain.connect(this.ctx.destination);

    // Pop oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isSpecial ? 880 : 640, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.15);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.15);

    // Sparkling chime tail
    const chime = this.ctx.createOscillator();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(isSpecial ? 1568 : 1046, t + 0.04);
    chime.frequency.exponentialRampToValueAtTime(300, t + 0.22);
    chime.connect(gain);
    chime.start(t + 0.04);
    chime.stop(t + 0.22);
  }

  // Ascending 8-bit musical combo arpeggio (1x to 10x)
  playComboChime(multiplier = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const mult = Math.min(10, Math.max(1, multiplier));
    const baseFreq = 440 + (mult * 65); // Scale upward pitch with multiplier

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    gain.connect(this.ctx.destination);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc1.connect(gain);
    osc1.start(t);
    osc1.stop(t + 0.12);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 1.25, t + 0.06);
    osc2.connect(gain);
    osc2.start(t + 0.06);
    osc2.stop(t + 0.24);
  }

  // Wobbly 8-bit wah-wah heart loss tone
  playHeartLost() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    gain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.linearRampToValueAtTime(260, t + 0.15);
    osc.frequency.linearRampToValueAtTime(160, t + 0.35);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // Upbeat 1-Up heart recovered synth sparkle
  playHeartGain() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.10, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    gain.connect(this.ctx.destination);

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.07);
      osc.connect(gain);
      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 0.14);
    });
  }

  // Chrono slow-mo warp sound
  playPowerupSlowmo() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    gain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  // Scatter blaster triple burst sound
  playPowerupScatter() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    gain.connect(this.ctx.destination);

    [0, 0.06, 0.12].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700 + idx * 100, t + offset);
      osc.frequency.exponentialRampToValueAtTime(200, t + offset + 0.08);
      osc.connect(gain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.08);
    });
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

