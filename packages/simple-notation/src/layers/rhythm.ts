import type { SNMeasure } from '@components';
import { SNConfig } from '@config';
import { SNRuntime } from '@config';
import { SNScoreType } from '@types';
import { SvgUtils, UKULELE_CHORDS } from '@utils';

/**
 * 节奏记号层：弹唱谱的「右手怎么弹」。
 *
 * `score.pattern`（或旧名 `score.strum`）的每个**格 = 一拍**：
 *   `1`~`4`  拨这几根弦        → 弦线上画 x
 *   `r`      当前和弦的根音弦   → 自动算（见 resolveRootString）
 *   `d` / `u` 下扫 / 上扫       → 贯穿四弦的箭头
 *   `x`      切音（沿用旧义）   → 四根弦上一个 ×（与分解的 x 区分：这个是「叉」形）
 *   `-`      这拍不弹
 *   `a+b`    一拍内均分（`d+u` = 八分扫两下）
 *   `|`      小节分组，按小节轮换（`4 3 2 3 | d d u u`）
 *
 * **兼容旧写法**：不带空格的 `d-du-udu` 仍按「一个字符 = 一拍」解析。
 * 有空格才走新的分格语法——旧文件不用改。
 */
export class SNRhythmLayer {
  static draw(measures: SNMeasure[], parent: SVGElement) {
    const raw = SNConfig.score.pattern ?? SNConfig.score.strum ?? '';
    const groups = parsePattern(raw);
    if (!groups.length || !measures.length) return;

    // 只有指板谱才有弦线可标；简谱上画节奏记号没有意义
    if (SNConfig.score.scoreType === SNScoreType.Simple) return;

    // 旋律（品位数字）和节奏记号抢同一行弦线，画在一起就是一锅粥。
    // 现实里的谱子二选一：要么是带旋律的独奏谱，要么是只有和弦+右手的弹唱谱。
    if (hasMelody(measures)) return;

    const group = SvgUtils.createG({ tag: 'rhythm' });
    parent.appendChild(group);

    const beats = beatsPerBar();
    const stringCount = SNConfig.score.stringCount;
    const staffTop = SNConfig.score.chordHeight + 11;
    const topPad = 7;
    const bottomPad = 13;

    measures.forEach((m, mi) => {
      const cells = groups[mi % groups.length];
      const yTop = m.y + staffTop + topPad;
      const yBottom = m.y + staffTop + SNConfig.score.lineHeight - bottomPad;
      if (yBottom <= yTop) return;
      const lineHeight = (SNConfig.score.lineHeight - 4) / stringCount;
      const yOf = (s: number) => m.y + staffTop + lineHeight * (s - 1);

      const chordName = firstChordOf(m);
      const rootString = chordName ? resolveRootString(chordName) : null;

      for (let i = 0; i < beats; i++) {
        const atoms = cells[i % cells.length] ?? [];
        if (!atoms.length) continue;
        const beatX = m.x + (i * m.width) / beats;
        const beatW = m.width / beats;

        atoms.forEach((atom, j) => {
          const x = beatX + ((j + 0.5) * beatW) / atoms.length;
          switch (atom.kind) {
            case 'strum':
              drawArrow(group, x, yTop, yBottom, atom.dir);
              break;
            case 'pluck':
              atom.strings.forEach((s) => drawCross(group, x, yOf(s)));
              break;
            case 'root':
              if (rootString) drawCross(group, x, yOf(rootString));
              break;
            case 'chuck':
              drawChuck(group, x, yTop, yBottom);
              break;
            case 'rest':
              break;
          }
        });
      }
    });
  }
}

/** 这一份谱里有没有真实旋律（`0` / `-` 之外的音） */
function hasMelody(measures: SNMeasure[]): boolean {
  return measures.some((m) =>
    m.options.noteOptions.some((n) => n.note && n.note !== '0' && n.note !== '-'),
  );
}

type Atom =
  | { kind: 'strum'; dir: 'd' | 'u' }
  | { kind: 'pluck'; strings: number[] }
  | { kind: 'root' }
  | { kind: 'chuck' }
  | { kind: 'rest' };

/** 返回：按小节分组的一组「每拍若干动作」 */
function parsePattern(raw: string): Atom[][][] {
  const text = raw.trim();
  if (!text) return [];

  const hasSpace = /\s/.test(text);
  // 旧写法：d-du-udu —— 一个字符一拍，没有空格
  const groupsRaw = hasSpace
    ? text.split('|').map((g) => g.trim().split(/\s+/).filter(Boolean))
    : text.split('|').map((g) => [...g.trim()].filter(Boolean));

  return groupsRaw
    .map((tokens) => tokens.map(parseCell).filter((c) => c.length))
    .filter((g) => g.length);
}

function parseCell(tok: string): Atom[] {
  // 一拍多动作：a+b+c
  return tok
    .split('+')
    .map((t) => parseAtom(t.trim()))
    .filter((a): a is Atom => !!a);
}

function parseAtom(t: string): Atom | null {
  if (!t) return null;
  if (t === 'd' || t === 'u') return { kind: 'strum', dir: t };
  if (t === '-') return { kind: 'rest' };
  if (t === 'r') return { kind: 'root' };
  if (t === 'x') return { kind: 'chuck' };
  if (/^[1-4]+$/.test(t)) return { kind: 'pluck', strings: [...t].map(Number) };
  return null;
}

function beatsPerBar(): number {
  const beat = Number(SNRuntime.info?.beat);
  if (Number.isFinite(beat) && beat > 0) return Math.min(16, Math.floor(beat));
  return SNConfig.score.beatsPerBar || 4;
}

/** 这一小节的第一个和弦名 */
function firstChordOf(m: SNMeasure): string | null {
  for (const n of m.options.noteOptions) {
    if (n.chord?.length) return n.chord[0];
  }
  return null;
}

const NOTE_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/** 和弦根音的音级 */
function rootPitchClass(name: string): number | null {
  const m = /^([A-G])([#b]?)/.exec(name);
  if (!m) return null;
  let pc = NOTE_PC[m[1]];
  if (m[2] === '#') pc += 1;
  if (m[2] === 'b') pc -= 1;
  return ((pc % 12) + 12) % 12;
}

/**
 * 根音落在哪根弦：
 * 在指位表里取「音高 == 根音」的弦，选**发音最低**的那根；
 * 都取不到（闷弦/表外和弦）就退回和弦里最低的那根弦。
 */
function resolveRootString(chordName: string): number | null {
  const positions =
    SNConfig.score.chordPositions?.[chordName] ??
    (UKULELE_CHORDS as Record<string, (number | null)[]>)[chordName];
  const tuning = SNConfig.score.tuningMidi;
  if (!positions || !tuning?.length) return null;

  const pc = rootPitchClass(chordName);
  let best: { string: number; pitch: number } | null = null;
  let lowest: { string: number; pitch: number } | null = null;

  positions.forEach((fret, i) => {
    if (fret === null || fret < 0) return;
    const string = positions.length - i; // 表是「弦 N → 弦 1」
    const pitch = (tuning[i] ?? 0) + fret;
    if (!lowest || pitch < lowest.pitch) lowest = { string, pitch };
    if (pc !== null && pitch % 12 === pc) {
      if (!best || pitch < best.pitch) best = { string, pitch };
    }
  });

  return best?.string ?? lowest?.string ?? null;
}

/** 一根箭头：竖线 + 两笔箭头 */
function drawArrow(
  parent: SVGGElement,
  x: number,
  yTop: number,
  yBottom: number,
  dir: 'd' | 'u',
) {
  const down = dir === 'd';
  const yStart = down ? yTop : yBottom;
  const yEnd = down ? yBottom : yTop;

  parent.appendChild(
    SvgUtils.createLine({
      x1: x, y1: yStart, x2: x, y2: yEnd,
      stroke: 'black', strokeWidth: 1.2,
    }),
  );

  const head = 4;
  const len = 6;
  const baseY = down ? yEnd - len : yEnd + len;
  parent.appendChild(
    SvgUtils.createLine({
      x1: x - head, y1: baseY, x2: x, y2: yEnd,
      stroke: 'black', strokeWidth: 1.2,
    }),
  );
  parent.appendChild(
    SvgUtils.createLine({
      x1: x + head, y1: baseY, x2: x, y2: yEnd,
      stroke: 'black', strokeWidth: 1.2,
    }),
  );
}

/** 分解和弦的 x 标记 */
function drawCross(parent: SVGGElement, x: number, y: number) {
  const arm = 3;
  parent.appendChild(
    SvgUtils.createLine({
      x1: x - arm, y1: y - arm, x2: x + arm, y2: y + arm,
      stroke: 'black', strokeWidth: 1.2,
    }),
  );
  parent.appendChild(
    SvgUtils.createLine({
      x1: x - arm, y1: y + arm, x2: x + arm, y2: y - arm,
      stroke: 'black', strokeWidth: 1.2,
    }),
  );
}

/** 切音：贯穿四弦的一根斜线（与分解的 x 明显不同） */
function drawChuck(
  parent: SVGGElement,
  x: number,
  yTop: number,
  yBottom: number,
) {
  parent.appendChild(
    SvgUtils.createLine({
      x1: x - 5, y1: yBottom, x2: x + 5, y2: yTop,
      stroke: 'black', strokeWidth: 1.6,
    }),
  );
}
