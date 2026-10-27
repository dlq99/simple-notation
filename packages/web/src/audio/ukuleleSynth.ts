/**
 * 尤克里里音色：Karplus-Strong 物理模型合成。
 *
 * 不引采样包——每个音现算一段 PCM，缓存起来重复用。
 * 好处是任意音高、任意定弦、任意时长都成立，体积为零。
 *
 * 弦号约定：1 = A，2 = E，3 = C，4 = G（与谱面一致）。
 */

/** High G：弦 4 → 弦 1 的空弦 MIDI */
const HIGH_G_TUNING = [67, 60, 64, 69];
/** Low G */
const LOW_G_TUNING = [55, 60, 64, 69];

export type UkeInstrument = 'ukulele-high-g' | 'ukulele-low-g';

function tuningOf(instrument: UkeInstrument): number[] {
  return instrument === 'ukulele-low-g' ? LOW_G_TUNING : HIGH_G_TUNING;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class UkuleleSynth {
  private ctx: AudioContext | null = null;
  private cache = new Map<string, AudioBuffer>();
  private master: GainNode | null = null;

  /** 必须在用户手势里调用一次（浏览器自动播放策略） */
  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  /**
   * 合成一个音的 PCM。
   *
   * y[n] = k * (y[n-N] + y[n-N-1]) / 2，延迟线长度 N = sampleRate / f0。
   * 尼龙弦衰减慢，k 取 0.9975；低音衰减再慢一点。
   */
  private renderNote(
    ctx: AudioContext,
    freq: number,
    seconds: number,
  ): AudioBuffer {
    const sr = ctx.sampleRate;
    const n = Math.max(2, Math.round(sr / freq));
    const total = Math.max(1, Math.floor(sr * seconds));
    const buffer = ctx.createBuffer(1, total, sr);
    const data = buffer.getChannelData(0);

    const delay = new Float32Array(n);
    for (let i = 0; i < n; i++) delay[i] = Math.random() * 2 - 1;

    // 低音衰减更慢
    const k = freq < 200 ? 0.9985 : 0.9975;
    let idx = 0;
    let prev = delay[0];
    for (let i = 0; i < total; i++) {
      const cur = delay[idx];
      data[i] = cur;
      delay[idx] = k * 0.5 * (cur + prev);
      prev = cur;
      idx = (idx + 1) % n;
    }

    // 掐掉尾巴，避免 buffer 末尾爆音
    const fade = Math.min(2200, total);
    for (let i = 0; i < fade; i++) {
      data[total - 1 - i] *= i / fade;
    }
    return buffer;
  }

  private noteBuffer(
    ctx: AudioContext,
    instrument: UkeInstrument,
    string: number,
    fret: number,
  ): AudioBuffer {
    const key = `${instrument}:${string}:${fret}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const tuning = tuningOf(instrument);
    const midi = tuning[4 - string] + fret; // tuning 是 弦4 → 弦1
    const freq = midiToFreq(midi);
    const seconds = 1.8;
    const buf = this.renderNote(ctx, freq, seconds);
    this.cache.set(key, buf);
    return buf;
  }

  /** 拨一根弦 */
  pluck(
    instrument: UkeInstrument,
    string: number,
    fret: number,
    when = 0,
    gain = 1,
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noteBuffer(ctx, instrument, string, fret);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start(when);
  }

  /**
   * 扫弦。
   *
   * @param shape 弦 4 → 弦 1 的品位（null / -1 = 闷弦），长度必须 4
   * @param dir   'd' 下扫（低音弦先响）/ 'u' 上扫（高音弦先响）
   * @param when  AudioContext 时间
   * @param spreadMs 相邻弦间隔，35ms 左右听感才像"扫"
   */
  strum(
    instrument: UkeInstrument,
    shape: (number | null)[],
    dir: 'd' | 'u' = 'd',
    when = 0,
    spreadMs = 35,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    // shape[0] 是弦 4（最粗），下扫从它开始；上扫反过来
    const order = [0, 1, 2, 3];
    const strings = dir === 'd' ? order : order.slice().reverse();
    const t0 = when || ctx.currentTime;
    strings.forEach((i, k) => {
      const fret = shape[i];
      if (fret === null || fret === undefined || fret < 0) return;
      const string = 4 - i; // 0 → 弦4
      this.pluck(
        instrument,
        string,
        fret,
        t0 + (k * spreadMs) / 1000,
        0.9 + 0.1 * Math.random(),
      );
    });
  }

  /** 一串和弦按拍子扫出来（试听用） */
  async playProgression(
    instrument: UkeInstrument,
    shapes: (number | null)[][],
    bpm = 80,
    pattern: ('d' | 'u')[] = ['d', 'd', 'u', 'u'],
  ) {
    const ctx = await this.ensure();
    const beat = 60 / bpm;
    let t = ctx.currentTime + 0.12;
    shapes.forEach((shape) => {
      pattern.forEach((dir) => {
        this.strum(instrument, shape, dir, t);
        t += beat;
      });
    });
  }

  stop() {
    this.cache.clear();
  }
}
