import type { SNMeasure } from '@components';
import { SNConfig } from '@config';
import { SvgUtils } from '@utils';

/**
 * 扫弦记号层。
 *
 * 在谱表上方按拍画上下箭头：`d` = 下扫 ↓，`u` = 上扫 ↑，其它字符忽略。
 * 拍位按「小节内音符个数」均分——这对一拍一个音的弹唱谱是准的；
 * 遇到一拍多音（八分/十六分）会多画箭头，属于已知限制（见 docs/10 §9）。
 */
export class SNStrumLayer {
  static draw(measures: SNMeasure[], parent: SVGElement) {
    const raw = (SNConfig.score.strum ?? '').toLowerCase();
    const pattern = raw.split('').filter((c) => c === 'd' || c === 'u');
    if (!pattern.length || !measures.length) return;

    const group = SvgUtils.createG({ tag: 'strum' });
    parent.appendChild(group);

    const staffTopOffset = SNConfig.score.chordHeight + 11;
    const topPad = 6;
    const bottomPad = 12;

    measures.forEach((m) => {
      const beats = Math.max(1, m.options.noteOptions.length);
      const yTop = m.y + staffTopOffset + topPad;
      const yBottom =
        m.y + staffTopOffset + SNConfig.score.lineHeight - bottomPad;
      if (yBottom <= yTop) return;

      for (let i = 0; i < beats; i++) {
        const x = m.x + ((i + 0.5) * m.width) / beats;
        const dir = pattern[i % pattern.length];
        drawArrow(group, x, yTop, yBottom, dir);
      }
    });
  }
}

/** 一根箭头：竖线 + 两笔箭头 */
function drawArrow(
  parent: SVGGElement,
  x: number,
  yTop: number,
  yBottom: number,
  dir: string,
) {
  const down = dir === 'd';
  const yStart = down ? yTop : yBottom;
  const yEnd = down ? yBottom : yTop;

  parent.appendChild(
    SvgUtils.createLine({
      x1: x,
      y1: yStart,
      x2: x,
      y2: yEnd,
      stroke: 'black',
      strokeWidth: 1.2,
    }),
  );

  const head = 4; // 箭头张开的一半宽度
  const len = 6; // 箭头长度
  const baseY = down ? yEnd - len : yEnd + len;
  parent.appendChild(
    SvgUtils.createLine({
      x1: x - head,
      y1: baseY,
      x2: x,
      y2: yEnd,
      stroke: 'black',
      strokeWidth: 1.2,
    }),
  );
  parent.appendChild(
    SvgUtils.createLine({
      x1: x + head,
      y1: baseY,
      x2: x,
      y2: yEnd,
      stroke: 'black',
      strokeWidth: 1.2,
    }),
  );
}
