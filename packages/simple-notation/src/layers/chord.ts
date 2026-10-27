import { SNNote, SNStave } from '@components';
import { ChordTool, Logger, SvgUtils } from '@utils';
import { SNConfig } from '@config';
import { SNChordType, SNInstrument } from '@types';
import { UKULELE_CHORDS } from '@utils';

/** 当前乐器是不是尤克里里（4 弦，查 4 弦指位表） */
function isUkulele(): boolean {
  const inst = SNConfig.score?.instrument;
  if (inst === SNInstrument.UkuleleHighG || inst === SNInstrument.UkuleleLowG) {
    return true;
  }
  // 旧配置兜底：乐器曾经挂在 chordType 上
  const t = SNConfig.score?.chordType;
  return t === SNChordType.UkuleleHighG || t === SNChordType.UkuleleLowG;
}

/** 和弦指位：尤克里里查 4 弦表；其余优先用配置覆盖表，其次内置吉他表。 */
function chordPositionsOf(symbol: string): (number | null)[] | undefined {
  if (isUkulele()) {
    return (
      SNConfig.score?.chordPositions?.[symbol] ?? UKULELE_CHORDS[symbol] ?? undefined
    );
  }
  return (
    SNConfig.score?.chordPositions?.[symbol] ??
    ChordTool.guitarChordPositionsMap[symbol]
  );
}

export class SNChordLayer {
  /** SVG group 元素，作为内容的容器 */
  static el: SVGGElement;

  /** 和弦层map，用于存储和弦层元素，key为音符index用于定位，value为和弦层元素 */
  static chordMap: Map<number, SVGElement> = new Map();

  static defaultChordPositions = [null, null, null, null, null, null];

  constructor(svg: SVGElement) {
    Logger.debug('constructor 初始化和弦层', 'SNChordLayer');
    SNChordLayer.el = SvgUtils.createG({ tag: 'chord' });
    svg.appendChild(SNChordLayer.el);
  }

  static addChord(note: SNNote) {
    if (!Array.isArray(note.chord) || note.chord.length === 0) {
      return;
    }

    if (SNChordLayer.chordMap.has(note.index)) {
      SNChordLayer.chordMap.get(note.index)?.remove();
      SNChordLayer.chordMap.delete(note.index);
    }

    // 创建一个SVG group来包含所有绘制的符号
    const chordGroup = SvgUtils.createG({
      tag: `chord-group-${note.index}`,
    });

    // 根据和弦类型创建不同的显示元素
    const chordType = SNConfig.score.chordType ?? SNChordType.Default;

    // 遍历chord数组，绘制已知符号（和弦、分段符、换气符等）
    let drawnElementCount = 0; // 记录绘制的元素数量，用于调整位置
    const baseX = note.x + note.width / 2;
    // 和弦区高度由配置决定（解析器在有和弦且没配置时会按显示方式补一个默认值）
    // 调整基线位置，使其更靠近音符上方
    const baseY = note.y - (SNConfig.score.chordHeight ?? 0) / 2 + 5;

    // 检查是否含有分段符，如果含有则调整和弦的垂直位置
    const hasSectionRepeat = note.chord.some((symbol) =>
      symbol.match(/^\d+\.$/),
    );
    const verticalOffset = hasSectionRepeat ? -20 : 0; // 如果有分段符，向上偏移15像素

    note.chord.forEach((symbol: string) => {
      let elementToDraw: SVGElement | null = null;

      switch (symbol) {
        case 'v':
        case 'V': {
          // 绘制换气符 (使用Bravura字体对应的Unicode字符)
          // 换气符位置相对于当前音符中心
          const breathMarkX = note.x; // 根据已绘制元素数量调整位置
          const breathMarkY = baseY + 10; // 微调y坐标使其对齐
          elementToDraw = SvgUtils.createText({
            x: breathMarkX,
            y: breathMarkY,
            text: 'v', // Bravura字体中的换气符Unicode
            fontSize: 16,
            textAnchor: 'middle',
          });
          break;
        }
        default:
          // 判断是否是分段符 (e.g., "1.", "2.")
          if (symbol.match(/^\d+\.$/)) {
            // 创建一个新的group来包含分段符的数字和L型线
            const sectionRepeatGroup = SvgUtils.createG({
              tag: `section-repeat-${note.index}-${symbol}`,
            });

            // 绘制分段符数字
            const numberText = SvgUtils.createText({
              text: symbol,
              x: note.parent!.innerX,
              y: note.y,
              fontSize: 14,
              fontFamily:
                '"SimHei", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif',
              textAnchor: 'start',
            });
            sectionRepeatGroup.appendChild(numberText);

            // 绘制L型线
            const lineLength = 80; // L型线的长度
            const startX = note.parent!.x - SNStave.BAR_LINE_WIDTH; // L型线起始x坐标 (左下角)
            const startY = note.y - 15; // L型线起始y坐标 (顶部)

            // 创建path元素
            const lPath = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'path',
            );

            // 定义路径数据 (从左下角 M 到左上角 L 再到右上角 L)
            const pathData = `M ${startX},${startY + 15} L ${startX},${startY} L ${startX + lineLength},${startY}`;
            lPath.setAttribute('d', pathData);
            lPath.setAttribute('stroke', 'black');
            lPath.setAttribute('stroke-width', '1');
            lPath.setAttribute('fill', 'none'); // L型线不需要填充

            sectionRepeatGroup.appendChild(lPath);

            elementToDraw = sectionRepeatGroup;
          } else {
            // 和弦符号
            // 注意：以前这里要求「能在指位表里查到」才画，导致表外和弦（Bb、Cmaj9…）
            // 连文字都不显示；现在文字模式一律画，指位图模式查不到才退化成文字。
            const chordX = baseX;
            const chordY = baseY + verticalOffset; // 应用垂直偏移

            const positions =
              chordType === SNChordType.Guitar
                ? chordPositionsOf(symbol)
                : undefined;

            if (positions) {
              elementToDraw = SvgUtils.createGuitarChordDiagram(
                symbol,
                positions,
                chordX - 20, // 微调位置
                chordY - 40, // 微调位置（图高 66，往上多让一点，底边落在谱线之上）
              );
            } else {
              // 创建默认文本和弦
              elementToDraw = SvgUtils.createText({
                text: symbol,
                x: chordX,
                y: chordY,
                fontSize: 14,
                fontFamily:
                  '"SimHei", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif',
                textAnchor: 'middle',
              });
            }
          }
          break;
      }

      if (elementToDraw) {
        chordGroup.appendChild(elementToDraw);
        drawnElementCount++;
      }
    });

    // 如果绘制了任何符号，将group添加到和弦层map并添加到SVG中
    if (drawnElementCount > 0) {
      SNChordLayer.chordMap.set(note.index, chordGroup);
      SNChordLayer.el.appendChild(chordGroup);
    }
  }

  static removeChord(note: SNNote) {
    if (SNChordLayer.chordMap.has(note.index)) {
      SNChordLayer.chordMap.get(note.index)?.remove();
      SNChordLayer.chordMap.delete(note.index);
    }
  }

  static destroyed() {
    SNChordLayer.chordMap.forEach((chord) => {
      chord.remove();
    });
  }
}
