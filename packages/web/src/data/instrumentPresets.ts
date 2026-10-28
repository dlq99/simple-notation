import { SNChordType, SNInstrument, SNScoreType } from 'simple-notation';
import type { SNScoreOptions } from 'simple-notation';

/**
 * 乐器 / 谱面预设（演示页用的一组快捷组合）。
 *
 * 弦数、定弦、记谱八度都不在这里写——库里的 `SNInstrument` 会推导。
 * 这里只组合三个正交维度：乐器 × 显示类型 × 和弦显示。
 */
export type PresetId = 'simple' | 'guitar' | 'uke-high-g' | 'uke-low-g' | 'uke-dual';

export interface InstrumentPreset {
  id: PresetId;
  label: string;
  /** 显示在选项下方的一行说明 */
  detail: string;
  /** 选中该预设时写进 `snOptions.score` 的字段 */
  score: Partial<SNScoreOptions>;
  /** 上游还没做好的模式，先不在 UI 里露出 */
  disabled?: boolean;
}

const TAB_LAYOUT: Partial<SNScoreOptions> = {
  lineHeight: 66,
  // 和弦指位图高 66（含空弦/闷弦标记），chordHeight 给足才不会压到上一行歌词
  chordHeight: 72,
};

export const PRESETS: InstrumentPreset[] = [
  {
    id: 'simple',
    label: '简谱（默认）',
    detail: '数字谱，不含弦品',
    score: {
      instrument: SNInstrument.Guitar,
      scoreType: SNScoreType.Simple,
      chordType: SNChordType.Default,
    },
  },
  {
    id: 'guitar',
    label: '吉他 · 六线谱',
    detail: '6 弦 EADGBE，记谱高八度',
    score: {
      ...TAB_LAYOUT,
      instrument: SNInstrument.Guitar,
      scoreType: SNScoreType.Guitar,
      chordType: SNChordType.Guitar,
    },
  },
  {
    id: 'uke-high-g',
    label: '尤克里里 · High G 四线谱',
    detail: '4 弦 G4 C4 E4 A4，按实音记谱',
    score: {
      ...TAB_LAYOUT,
      instrument: SNInstrument.UkuleleHighG,
      scoreType: SNScoreType.Guitar,
      chordType: SNChordType.Guitar,
    },
  },
  {
    id: 'uke-low-g',
    label: '尤克里里 · Low G 四线谱',
    detail: '4 弦 G3 C4 E4 A4，同一份谱换定弦',
    score: {
      ...TAB_LAYOUT,
      instrument: SNInstrument.UkuleleLowG,
      scoreType: SNScoreType.Guitar,
      chordType: SNChordType.Guitar,
    },
  },
  {
    id: 'uke-dual',
    label: '尤克里里 · 简谱 + 四线谱',
    detail: '上下两行共用一条时间轴（上游 SimpleGuirar 模式未完成，暂不启用）',
    disabled: true,
    score: {
      ...TAB_LAYOUT,
      instrument: SNInstrument.UkuleleHighG,
      scoreType: SNScoreType.SimpleGuirar,
      chordType: SNChordType.Guitar,
      showChordLine: true,
      chordLineHeight: 50,
    },
  },
];

export function presetById(id: PresetId): InstrumentPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** 从当前 score 配置反推属于哪个预设（用于按钮组回显）。 */
export function detectPreset(score?: Partial<SNScoreOptions>): PresetId {
  if (!score) return 'simple';
  if (score.scoreType === SNScoreType.SimpleGuirar) return 'uke-dual';
  if (score.instrument === SNInstrument.UkuleleLowG) return 'uke-low-g';
  if (score.instrument === SNInstrument.UkuleleHighG) return 'uke-high-g';
  return score.scoreType === SNScoreType.Guitar ? 'guitar' : 'simple';
}
