// All sound is synthesized locally; no recordings or remote media.
export class Sound {
  constructor() { this.enabled = true; this.ctx = null; }
  activate() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { this.enabled = false; return; }
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain(); this.master.gain.value = .14; this.master.connect(this.ctx.destination);
      const drone = frequency => {
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = frequency; gain.gain.value = .06;
        osc.connect(gain); gain.connect(this.master); osc.start();
      };
      drone(55); drone(82.41);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.activate();
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? .14 : 0, this.ctx.currentTime, .05);
    return this.enabled;
  }
  tone(kind) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, time = c.currentTime, osc = c.createOscillator(), gain = c.createGain();
    const frequency = kind === 'hit' ? 145 : kind === 'jump' ? 300 : kind === 'block' ? 720 : kind === 'special' ? 120 : kind === 'warning' ? 180 : 220;
    const duration = kind === 'special' ? .5 : kind === 'warning' ? .35 : .18;
    osc.type = kind === 'jump' || kind === 'block' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(kind === 'jump' ? 640 : 45, time + duration);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.4, time + .009);
    gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(time); osc.stop(time + duration + .02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}
