import titleSongURL from '../assets/music/alien-sky.mp3';
import ch1SongURL from '../assets/music/three-note-motif.mp3';
import ch2SongURL from '../assets/music/ch2.mp3';

/** 錄好的曲目：首頁主題曲、第 1～2 章配樂；其他情況播程序化配樂 */
const SONGS = { title: titleSongURL, ch1: ch1SongURL, ch2: ch2SongURL } as const;
/** 各章對應的錄音曲目（沒有列出的章用程序化配樂） */
const CHAPTER_SONG: Record<number, SongKey> = { 1: 'ch1', 2: 'ch2' };
type SongKey = keyof typeof SONGS;
// 程序化音樂與音效（Web Audio API，不需要任何音檔，打包後仍是單一 HTML）
// 音樂：慢速的太空氛圍——長音 pad、低音、帶回音的琶音；章節不同調性，襲擊預警時加入低頻脈動。
// 音效：採集、暴擊、建造、研究、通知、警報、槍聲、雷射、酸液、按鈕。
import { create } from 'zustand';

const KEY = 'lastlight-colony-audio';
interface AudioSettings { music: number; sfx: number; muted: boolean }
function loadSettings(): AudioSettings {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v) return { music: v.music ?? 0.5, sfx: v.sfx ?? 0.7, muted: !!v.muted }; } catch { /* 用預設 */ }
  return { music: 0.5, sfx: 0.7, muted: false };
}
export const useAudio = create<AudioSettings & { set: (p: Partial<AudioSettings>) => void }>((set, get) => ({
  ...loadSettings(),
  set: (p) => {
    set(p);
    const { music, sfx, muted } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ music, sfx, muted })); } catch { /* 只在本次生效 */ }
    engine.applyVolume();
  },
}));

/** 音樂狀態：遊戲每幾秒回報一次，排程器依此換調性與強度 */
export interface MusicMood { stage: number; raid: boolean; finished: boolean }

// 各章節的和弦進行（MIDI 音高，每組是一個小節的和弦），越後面越明亮
const PROGS: number[][][] = [
  [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]],         // 1：A 小調，冷清
  [[45, 52, 57, 60], [41, 48, 55, 57], [48, 55, 60, 64], [43, 50, 55, 62]],         // 2：開始有希望
  [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]],         // 3：D 小調，工業感
  [[40, 47, 52, 55], [36, 43, 48, 52], [38, 45, 50, 57], [35, 42, 47, 54]],         // 4：E 小調，緊張
  [[43, 50, 55, 59], [40, 47, 52, 55], [36, 43, 48, 52], [38, 45, 50, 54]],         // 5：G 大調，政治與貿易
  [[48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 64], [43, 50, 55, 59, 62]], // 6：C 大調，星城
];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Engine {
  ctx: AudioContext | null = null;
  master!: GainNode; music!: GainNode; sfx!: GainNode; delay!: DelayNode; noiseBuf!: AudioBuffer;
  mood: MusicMood = { stage: 1, raid: false, finished: false };
  private nextBar = 0; private bar = 0; private timer: number | null = null;
  /** 首頁開著時播首頁主題曲（Alien Sky）；第 1、2 章播錄好的配樂（CHAPTER_SONG）；其他章播程序化配樂。切換時交叉淡入淡出 */
  title = false;
  private songs: Partial<Record<SongKey, { el: HTMLAudioElement; gain: GainNode }>> = {};
  private track: SongKey | null | undefined = undefined;
  private gameGain!: GainNode;
  private last: Record<string, number> = {};

  /** 瀏覽器要求使用者互動後才能發聲：第一次點擊時建立 AudioContext */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.connect(this.master);
    // 程序化配樂先經過 gameGain（首頁時靜音）；主題曲經過 songGain，兩者都跟著音樂音量
    this.gameGain = ctx.createGain(); this.gameGain.connect(this.music);
    for (const k of Object.keys(SONGS) as SongKey[]) {
      const el = new Audio(SONGS[k]); el.loop = true;
      const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(this.music);
      ctx.createMediaElementSource(el).connect(gain);
      this.songs[k] = { el, gain };
    }
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    // 太空感的回音：feedback delay，只接音樂的琶音與部分音效
    this.delay = ctx.createDelay(1.5); this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200;
    this.delay.connect(tone); tone.connect(fb); fb.connect(this.delay); tone.connect(this.gameGain);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolume();
    this.updateTrack();
    this.nextBar = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 200);
  }
  setTitle(on: boolean) { this.title = on; this.updateTrack(); }
  setMood(m: MusicMood) { this.mood = m; this.updateTrack(); }
  /** 依首頁／章節決定要播哪首；換曲時交叉淡入淡出（null＝程序化配樂） */
  private updateTrack() {
    const want: SongKey | null = this.title ? 'title' : this.mood.finished ? null : CHAPTER_SONG[this.mood.stage] ?? null;
    if (!this.ctx || want === this.track) return;
    this.track = want;
    const t = this.ctx.currentTime;
    for (const k of Object.keys(this.songs) as SongKey[]) {
      const s = this.songs[k]!, on = k === want;
      s.gain.gain.cancelScheduledValues(t);
      s.gain.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.6 : 0.8);
      if (on) { if (s.el.paused) { s.el.currentTime = 0; s.el.play().catch(() => {}); } }
      else if (!s.el.paused) window.setTimeout(() => { if (this.track !== k) s.el.pause(); }, 4000);
    }
    this.gameGain.gain.cancelScheduledValues(t);
    this.gameGain.gain.setTargetAtTime(want ? 0 : 1, t, want ? 0.3 : 1.2);
  }
  applyVolume() {
    if (!this.ctx) return;
    const s = useAudio.getState(), t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 0.8, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.55, t, 0.2);
    this.sfx.gain.setTargetAtTime(s.sfx * 0.7, t, 0.05);
  }

  // ── 音樂 ──
  private schedule() {
    const ctx = this.ctx!;
    if (ctx.state !== 'running') return;
    if (this.track) { this.nextBar = Math.max(this.nextBar, ctx.currentTime + 0.1); return; }
    const barLen = this.mood.raid ? 2.4 : 3.2;   // 襲擊時節奏加快
    while (this.nextBar < ctx.currentTime + 0.6) {
      this.playBar(this.nextBar, barLen);
      this.nextBar += barLen;
      this.bar++;
    }
  }
  private playBar(t0: number, len: number) {
    const prog = PROGS[Math.min(PROGS.length, Math.max(1, this.mood.stage)) - 1];
    const chord = prog[this.bar % prog.length];
    const raid = this.mood.raid;
    // pad：每個和弦音兩顆微微走音的振盪器，緩起緩收
    for (const n of chord.slice(1)) this.pad(t0, len, hz(n + (raid ? -12 : 0) + 12), raid ? 0.05 : 0.07);
    // 低音
    this.tone(t0, len * 0.95, hz(chord[0] - 12), 'sine', raid ? 0.22 : 0.16, 0.08, len * 0.5);
    // 琶音：八分音符，隨機跳過一些，帶回音
    const steps = 8, st = len / steps, pool = [...chord.slice(1), chord[1] + 12, chord[2] + 12];
    for (let i = 0; i < steps; i++) {
      if (Math.random() < (this.mood.finished ? 0.35 : 0.5)) continue;
      const n = pool[Math.floor(Math.random() * pool.length)] + 12;
      this.pluck(t0 + i * st, hz(n), 0.05);
    }
    // 襲擊：低頻脈動（像心跳）
    if (raid) for (let i = 0; i < 4; i++) this.thump(t0 + (i * len) / 4, i % 2 ? 0.25 : 0.4);
  }
  private pad(t: number, len: number, f: number, vol: number) {
    const ctx = this.ctx!, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = this.mood.raid ? 900 : 1400; lp.Q.value = 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + len * 0.35);
    g.gain.linearRampToValueAtTime(0, t + len * 1.15);
    g.connect(lp); lp.connect(this.gameGain);
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + len * 1.2);
    }
  }
  private pluck(t: number, f: number, vol: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
    o.connect(g); g.connect(this.gameGain); g.connect(this.delay);
    o.start(t); o.stop(t + 1);
  }
  private thump(t: number, vol: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(this.gameGain); o.start(t); o.stop(t + 0.4);
  }
  private tone(t: number, len: number, f: number, type: OscillatorType, vol: number, att: number, rel: number, out: AudioNode = this.gameGain) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + Math.max(att, len - rel)); g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.05);
  }

  // ── 音效 ──
  /** 同一種音效太密集時略過（例如按住採集、交火） */
  private gate(name: string, gap: number) {
    const now = performance.now();
    if (now - (this.last[name] ?? 0) < gap * 1000) return false;
    this.last[name] = now; return true;
  }
  private blip(f0: number, f1: number, len: number, type: OscillatorType, vol: number, echo = false, at = 0) {
    const ctx = this.ctx!, t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    o.connect(g); g.connect(this.sfx); if (echo) g.connect(this.delay);
    o.start(t); o.stop(t + len + 0.02);
  }
  private noise(len: number, vol: number, freq: number, q = 1, at = 0, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!, t = ctx.currentTime + at, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + len + 0.02);
  }
  play(name: Sfx) {
    if (!this.ctx || this.ctx.state !== 'running' || useAudio.getState().muted) return;
    const r = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case 'collect': if (this.gate(name, 0.09)) { this.blip(660 * r, 990 * r, 0.08, 'triangle', 0.18); this.noise(0.04, 0.05, 3000, 2); } break;
      case 'crit': this.blip(880, 1760, 0.12, 'square', 0.08); this.blip(1320, 2640, 0.25, 'triangle', 0.12, true, 0.06); break;
      case 'empty': if (this.gate(name, 0.3)) this.blip(220, 160, 0.1, 'square', 0.05); break;
      case 'ui': if (this.gate(name, 0.05)) this.blip(1200, 900, 0.04, 'triangle', 0.08); break;
      case 'assign': if (this.gate(name, 0.05)) this.blip(520 * r, 780 * r, 0.06, 'triangle', 0.12); break;
      case 'build':
        this.noise(0.18, 0.12, 400, 0.8, 0, 'lowpass');
        [0, 0.08, 0.16].forEach((d, i) => this.blip([523, 659, 784][i], [523, 659, 784][i] * 1.01, 0.35, 'triangle', 0.14, true, d));
        break;
      case 'stage': [0, 0.12, 0.24, 0.36].forEach((d, i) => this.blip([392, 523, 659, 1047][i], [392, 523, 659, 1047][i], 0.8, 'triangle', 0.13, true, d)); break;
      case 'research': [0, 0.1].forEach((d, i) => this.blip([880, 1175][i], [880, 1175][i], 0.5, 'sine', 0.13, true, d)); break;
      case 'good': if (this.gate(name, 0.4)) { this.blip(784, 784, 0.25, 'sine', 0.1, true); this.blip(1047, 1047, 0.35, 'sine', 0.08, true, 0.08); } break;
      case 'warn': if (this.gate(name, 0.4)) { this.blip(330, 300, 0.25, 'square', 0.06); this.blip(247, 230, 0.35, 'square', 0.06, false, 0.15); } break;
      case 'alarm': for (let i = 0; i < 3; i++) { this.blip(520, 780, 0.35, 'sawtooth', 0.06, false, i * 0.45); this.blip(780, 520, 0.35, 'sawtooth', 0.05, false, i * 0.45 + 0.2); } break;
      case 'shot': if (this.gate(name, 0.04)) { this.noise(0.07, 0.16, 1800 * r, 0.9); this.blip(900, 200, 0.05, 'square', 0.04); } break;
      case 'laser': if (this.gate(name, 0.1)) this.blip(2400, 300, 0.22, 'sawtooth', 0.07, true); break;
      case 'spit': if (this.gate(name, 0.12)) { this.noise(0.12, 0.08, 700, 3); this.blip(300, 120, 0.12, 'sine', 0.06); } break;
      case 'win': [0, 0.12, 0.24].forEach((d, i) => this.blip([523, 784, 1047][i], [523, 784, 1047][i], 0.6, 'triangle', 0.14, true, d)); break;
      case 'lose': [0, 0.2].forEach((d, i) => this.blip([330, 247][i], [320, 220][i], 0.6, 'sawtooth', 0.06, false, d)); break;
      case 'boost': this.blip(300, 1200, 0.6, 'sine', 0.12, true); this.noise(0.5, 0.05, 2500, 4); break;
      case 'finale': [0, 0.2, 0.4, 0.6, 0.9].forEach((d, i) => this.blip([523, 659, 784, 1047, 1319][i], [523, 659, 784, 1047, 1319][i], 1.6, 'triangle', 0.13, true, d)); break;
    }
  }
}
export type Sfx = 'collect' | 'crit' | 'empty' | 'ui' | 'assign' | 'build' | 'stage' | 'research' | 'good' | 'warn' | 'alarm' | 'shot' | 'laser' | 'spit' | 'win' | 'lose' | 'boost' | 'finale';

const engine = new Engine();
export const sfx = (name: Sfx) => engine.play(name);
export const setMood = (m: MusicMood) => engine.setMood(m);
/** 首頁開關時呼叫：首頁播主題曲，遊戲中播程序化配樂 */
export const setTitleMusic = (on: boolean) => engine.setTitle(on);
/** 第一次互動時啟動音訊；也讓所有按鈕有輕微的點擊聲 */
export function installAudio() {
  const unlock = () => engine.unlock();
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  addEventListener('click', (e) => { if ((e.target as HTMLElement)?.closest?.('button')) sfx('ui'); }, { capture: true });
}
