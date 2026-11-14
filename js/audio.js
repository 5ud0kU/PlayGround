// Procedural audio engine — no external assets.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.muted = false;
    this.nodes = {};
    this.lastStep = 0;
    this.lastHeart = 0;
    this.lastWhisper = 0;
    this.inside = false;
    this.raining = false;
    this.night = false;
    this.stress = 0;
    this.started = false;
  }

  init() {
    if (this.started) return;
    this.started = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.buildAmbient();
      this.ready = true;
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { console.warn('Audio unavailable', e); }
  }

  noiseBuffer(seconds = 2) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  buildAmbient() {
    const ctx = this.ctx;
    // Low drone bed
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.06;
    const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 220;
    droneGain.connect(droneFilter); droneFilter.connect(this.master);
    const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = 43.65;
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 65.41;
    const osc3 = ctx.createOscillator(); osc3.type = 'triangle'; osc3.frequency.value = 87.31;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    osc1.connect(droneGain); osc2.connect(g2); g2.connect(droneGain); osc3.connect(droneGain);
    osc1.start(); osc2.start(); osc3.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.022;
    lfo.connect(lfoGain); lfoGain.connect(droneGain.gain); lfo.start();
    this.nodes.drone = droneGain;

    // Wind / air bed
    const wind = this.loopNoise('wind');
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 480; wf.Q.value = 0.6;
    this.nodes.windGain = ctx.createGain(); this.nodes.windGain.gain.value = 0.02;
    wind.connect(wf); wf.connect(this.nodes.windGain); this.nodes.windGain.connect(this.master);

    // Rain bed
    const rain = this.loopNoise('rain');
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 700;
    this.nodes.rainGain = ctx.createGain(); this.nodes.rainGain.gain.value = 0;
    rain.connect(rf); rf.connect(this.nodes.rainGain); this.nodes.rainGain.connect(this.master);

    // Mains hum for interiors
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 60;
    this.nodes.humGain = ctx.createGain(); this.nodes.humGain.gain.value = 0;
    hum.connect(this.nodes.humGain); this.nodes.humGain.connect(this.master); hum.start();

    // Distant siren (rare)
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'sawtooth'; this.sirenOsc.frequency.value = 380;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 700;
    this.sirenOsc.connect(sf); sf.connect(this.sirenGain); this.sirenGain.connect(this.master); this.sirenOsc.start();
  }

  loopNoise(kind) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3);
    src.loop = true;
    src.start(0, Math.random() * 2);
    return src;
  }

  setScene({ inside, raining, night }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.inside = inside; this.raining = raining; this.night = night;
    this.nodes.rainGain.gain.setTargetAtTime(raining ? (inside ? 0.035 : 0.11) : 0.0, t, 0.8);
    this.nodes.windGain.gain.setTargetAtTime(inside ? 0.008 : (raining ? 0.035 : 0.018), t, 0.8);
    this.nodes.humGain.gain.setTargetAtTime(inside ? 0.009 : 0.0, t, 0.6);
    this.nodes.drone.gain.setTargetAtTime(night ? 0.085 : 0.05, t, 1.2);
  }

  setStress(v) { this.stress = v; }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.1);
  }

  tick(dt, moving, sprint) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    // footsteps
    const interval = sprint ? 0.32 : 0.52;
    if (moving && now - this.lastStep > interval) {
      this.lastStep = now;
      this.footstep(sprint);
    }
    // heartbeat under stress
    if (this.stress > 55 && now - this.lastHeart > Math.max(0.55, 1.5 - this.stress / 90)) {
      this.lastHeart = now;
      this.heartbeat();
    }
    // whispers
    if (this.stress > 45 && now - this.lastWhisper > 14 + Math.random() * 20) {
      this.lastWhisper = now;
      if (Math.random() < 0.55) this.whisper();
    }
    // siren drift
    if (this.sirenOsc) {
      const target = (this.night && Math.random() < 0.02) ? 0.006 : 0;
      this.sirenGain.gain.setTargetAtTime(target, now, 2);
      this.sirenOsc.frequency.setTargetAtTime(320 + Math.sin(now * 0.3) * 90, now, 0.8);
    }
  }

  footstep(sprint) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.12);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.inside ? 380 : 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(this.inside ? 0.07 : 0.13, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + (sprint ? 0.1 : 0.15));
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.18);
  }

  heartbeat() {
    const ctx = this.ctx, t = ctx.currentTime;
    const mk = (delay, vol) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(58, t + delay);
      o.frequency.exponentialRampToValueAtTime(34, t + delay + 0.16);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(vol, t + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.22);
      o.connect(g); g.connect(this.master); o.start(t + delay); o.stop(t + delay + 0.3);
    };
    mk(0, 0.09); mk(0.18, 0.055);
  }

  whisper() {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(1.4);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 900; f.Q.value = 7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045 + Math.random() * 0.03, t + 0.25);
    g.gain.linearRampToValueAtTime(0, t + 1.2);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.random() * 2 - 1; src.connect(f); f.connect(g); g.connect(p); p.connect(this.master); }
    else { src.connect(f); f.connect(g); g.connect(this.master); }
    src.start(t); src.stop(t + 1.4);
    // faint formant tone
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 180 + Math.random() * 160;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.012, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 1.2);
  }

  ui(kind = 'click') {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = kind === 'confirm' ? 720 : kind === 'error' ? 180 : 460;
    g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.14);
  }

  shutter() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [delay, dur, freq] of [[0, 0.05, 2600], [0.07, 0.08, 1400]]) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.12);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.13, t + delay); g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      src.connect(f); f.connect(g); g.connect(this.master); src.start(t + delay); src.stop(t + delay + dur + 0.02);
    }
  }

  stinger() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 1.1);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.5);
  }

  bell(times = 3) {
    if (!this.ready) return;
    const ctx = this.ctx;
    for (let n = 0; n < times; n++) {
      const t = ctx.currentTime + n * 1.6;
      [196, 392, 588, 784].forEach((freq, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * (1 + Math.random() * 0.002);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.045 / (i + 1), t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 3.4);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 3.6);
      });
    }
  }

  thunder() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(3);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(240, t); f.frequency.exponentialRampToValueAtTime(80, t + 2.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 3);
  }

  scream() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(600, t); o.frequency.linearRampToValueAtTime(420, t + 0.5);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.028, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.random() * 2 - 1; o.connect(f); f.connect(g); g.connect(p); p.connect(this.master); }
    else { o.connect(f); f.connect(g); g.connect(this.master); }
    o.start(t); o.stop(t + 1.2);
  }
}
