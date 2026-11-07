export class AudioEngine {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.master = null;
    this.ambientGain = null;
    this.started = false;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.buildAmbience();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return true;
  }

  buildAmbience() {
    const ctx = this.ctx;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.42;
    this.ambientGain.connect(this.master);

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last * 2.8;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 720;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.08;
    noise.connect(noiseFilter).connect(noiseGain).connect(this.ambientGain);
    noise.start();

    const padGain = ctx.createGain();
    padGain.gain.value = 0.028;
    padGain.connect(this.ambientGain);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 540;
    filter.Q.value = 1.8;
    filter.connect(padGain);

    [55, 82.5, 110, 164.8].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = index % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (index - 1.5) * 4.5;
      const gain = ctx.createGain();
      gain.gain.value = index === 3 ? 0.08 : 0.16;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.035 + index * 0.017;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.035;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(gain).connect(filter);
      osc.start();
      lfo.start();
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled && !this.ensure()) return false;
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(enabled ? 0.2 : 0, now + 0.6);
    return true;
  }

  tone({ freq = 440, endFreq = freq, duration = 0.12, type = "sine", gain = 0.04, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(envelope).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  click() {
    this.tone({ freq: 820, endFreq: 610, duration: 0.065, type: "sine", gain: 0.035 });
  }

  select() {
    this.tone({ freq: 520, endFreq: 760, duration: 0.13, type: "triangle", gain: 0.035 });
    this.tone({ freq: 1040, endFreq: 1200, duration: 0.08, type: "sine", gain: 0.015, delay: 0.02 });
  }

  mutate() {
    this.tone({ freq: 180, endFreq: 690, duration: 0.48, type: "triangle", gain: 0.065 });
    this.tone({ freq: 460, endFreq: 290, duration: 0.6, type: "sine", gain: 0.04, delay: 0.08 });
    this.tone({ freq: 1280, endFreq: 1760, duration: 0.22, type: "sine", gain: 0.018, delay: 0.16 });
  }

  evolve() {
    [220, 277, 330, 440].forEach((freq, i) => {
      this.tone({ freq, endFreq: freq * 1.02, duration: 0.8, type: "sine", gain: 0.035, delay: i * 0.07 });
    });
    this.tone({ freq: 110, endFreq: 180, duration: 0.9, type: "triangle", gain: 0.05 });
  }

  error() {
    this.tone({ freq: 160, endFreq: 120, duration: 0.16, type: "square", gain: 0.025 });
  }

  dispose() {
    this.ctx?.close();
  }
}
