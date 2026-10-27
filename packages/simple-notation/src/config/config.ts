import {
  SNChordType,
  SNContentOptions,
  SNDebugOptions,
  SNInfoOptions,
  SNInstrument,
  SNOptions,
  SNScoreOptions,
  SNScoreType,
} from '@types';
import DEBUG_OPTIONS from './debug-options';
import { Logger } from '@utils';
import { UKULELE_HIGH_G_TUNING, UKULELE_LOW_G_TUNING } from '@utils';

/** 吉他标准调弦（弦 6 → 弦 1：E2 A2 D3 G3 B3 E4） */
const GUITAR_TUNING = [40, 45, 50, 55, 59, 64];

/**
 * 兼容旧写法：以前把「乐器」塞在 `chordType` 里（`'ukulele-high-g'` 等）。
 * 现在统一到 `instrument`，并把 `chordType` 还原成「要不要画指位图」。
 */
function normalizeScore(
  opt?: Partial<SNScoreOptions>,
): Partial<SNScoreOptions> | undefined {
  if (!opt) return opt;
  const ct = opt.chordType;
  if (ct === SNChordType.UkuleleHighG || ct === SNChordType.UkuleleLowG) {
    return {
      ...opt,
      instrument:
        opt.instrument ??
        (ct === SNChordType.UkuleleLowG
          ? SNInstrument.UkuleleLowG
          : SNInstrument.UkuleleHighG),
      chordType: SNChordType.Guitar,
    };
  }
  return opt;
}

/**
 * 由 `instrument` 推导弦数 / 定弦 / 记谱八度。
 * 调用方显式给了对应字段就以显式值为准（手动调弦仍然优先）。
 */
function applyInstrument(
  score: SNScoreOptions,
  provided?: Partial<SNScoreOptions>,
) {
  const inst = score.instrument ?? SNInstrument.Guitar;
  const isHighG = inst === SNInstrument.UkuleleHighG;
  const isLowG = inst === SNInstrument.UkuleleLowG;
  const isUke = isHighG || isLowG;

  if (provided?.stringCount === undefined) score.stringCount = isUke ? 4 : 6;
  if (provided?.tuningMidi === undefined) {
    score.tuningMidi = isLowG
      ? UKULELE_LOW_G_TUNING
      : isHighG
        ? UKULELE_HIGH_G_TUNING
        : GUITAR_TUNING;
  }
  if (provided?.notationOctaveOffset === undefined) {
    score.notationOctaveOffset = isUke ? 0 : -12;
  }
}

/** 默认值：吉他 6 弦、简谱、和弦文字 */
function defaultScore(): SNScoreOptions {
  return {
    lineHeight: 50,
    lineSpace: 10,
    padding: 10,
    lyricHeight: 25,
    chordHeight: 0,
    lineWeight: 200,
    allowOverWeight: 40,
    chordType: SNChordType.Default,
    scoreType: SNScoreType.Simple,
    showChordLine: false,
    chordLineHeight: 0,
    stringCount: 6,
    tuningMidi: GUITAR_TUNING,
    notationOctaveOffset: -12,
    instrument: SNInstrument.Guitar,
  };
}

export class SNConfig {
  static width: number; //svg节点宽度
  static height: number; //svg节点高度
  static content: SNContentOptions; //内容整体配置
  static info: SNInfoOptions; //信息部分配置
  static score: SNScoreOptions; //乐谱部分配置
  static debug: SNDebugOptions = {};

  constructor(container: HTMLDivElement, options?: SNOptions) {
    Logger.debug('constructor 初始化配置', 'SNConfig');
    SNConfig.width = options?.width || container.clientWidth || 500;
    SNConfig.height = options?.height || container.clientHeight || 800;
    SNConfig.content = {
      infoShow: true,
      padding: 20,
      ...options?.content,
    };
    SNConfig.info = {
      height: 120,
      padding: 10,
      ...options?.info,
    };
    const scoreIn = normalizeScore(options?.score);
    SNConfig.score = {
      ...defaultScore(),
      ...scoreIn,
    };
    applyInstrument(SNConfig.score, scoreIn);
    SNConfig.debug = options?.debug ? DEBUG_OPTIONS : {};
    Logger.isDebugMode = options?.debug || false;
  }

  /**
   * 更新配置
   * @param options
   */
  static update(options: SNOptions) {
    Logger.debug('update 更新配置', 'SNConfig');
    SNConfig.width = options?.width || SNConfig.width;
    SNConfig.height = options?.height || SNConfig.height;
    SNConfig.content = options?.content || SNConfig.content;
    SNConfig.info = options?.info || SNConfig.info;
    const scoreIn = normalizeScore(options?.score);
    SNConfig.score = {
      ...SNConfig.score,
      ...scoreIn,
    };
    applyInstrument(SNConfig.score, scoreIn);
    SNConfig.debug = options?.debug ? DEBUG_OPTIONS : {};
    Logger.isDebugMode = options?.debug || false;
  }

  static reset(options?: SNOptions) {
    SNConfig.width = options?.width || 500;
    SNConfig.height = options?.height || 800;
    SNConfig.content = {
      infoShow: true,
      padding: 20,
      ...options?.content,
    };
    SNConfig.info = {
      height: 120,
      padding: 10,
      ...options?.info,
    };
    const scoreIn = normalizeScore(options?.score);
    SNConfig.score = {
      ...defaultScore(),
      ...scoreIn,
    };
    applyInstrument(SNConfig.score, scoreIn);
    SNConfig.debug = options?.debug ? DEBUG_OPTIONS : {};
    Logger.isDebugMode = options?.debug || false;
  }
}
