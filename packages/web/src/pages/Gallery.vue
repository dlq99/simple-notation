<template>
  <div class="px-6 py-8 max-w-[1180px] mx-auto flex flex-col gap-5">
    <header>
      <h1 class="text-2xl font-semibold text-[#333]">曲谱显示对比</h1>
      <p class="text-sm text-[#777] mt-1">
        同一份谱，换成不同乐器 / 谱面时的渲染结果。URL 带
        <code class="px-1 rounded bg-[#eee]">?preset=</code> /
        <code class="px-1 rounded bg-[#eee]">?song=</code> 可直接分享某一种。
      </p>
    </header>

    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-[#666] w-[68px]">乐器</span>
        <button
          v-for="i in INSTS"
          :key="i.id"
          class="px-3 py-1.5 rounded border text-sm transition"
          :class="
            i.id === instId
              ? 'bg-[#333] text-white border-[#333]'
              : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="instId = i.id"
        >
          {{ i.label }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-[#666] w-[68px]">谱面</span>
        <button
          v-for="t in TYPES"
          :key="t.id"
          class="px-3 py-1.5 rounded border text-sm transition"
          :class="
            t.id === typeId
              ? 'bg-[#333] text-white border-[#333]'
              : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="typeId = t.id"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-[#666] w-[68px]">曲目</span>
        <button
          v-for="s in SONGS"
          :key="s.id"
          class="px-3 py-1.5 rounded border text-sm transition"
          :class="
            s.id === songId
              ? 'bg-[#333] text-white border-[#333]'
              : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="songId = s.id"
        >
          {{ s.label }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-[#666] w-[68px]">和弦</span>
        <button
          v-for="c in [{ id: 'guitar', label: '指位图' }, { id: 'default', label: '文字' }, { id: 'none', label: '无' }]"
          :key="c.id"
          class="px-3 py-1.5 rounded border text-sm transition"
          :class="
            c.id === chordMode
              ? 'bg-[#333] text-white border-[#333]'
              : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="pickChord(c.id as 'guitar' | 'default' | 'none')"
        >
          {{ c.label }}
        </button>
        <button
          class="ml-2 px-3 py-1.5 rounded border text-sm transition"
          :class="
            playing
              ? 'bg-[#21B573] text-white border-[#21B573]'
              : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="previewStrum"
        >
          {{ playing ? '♪ 扫弦中…' : '▶ 扫弦试听' }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-[#666] w-[68px]">歌词</span>
        <button
          v-for="l in [{ id: true, label: '显示' }, { id: false, label: '不显示' }]"
          :key="String(l.id)"
          class="px-3 py-1.5 rounded border text-sm transition"
          :class="
            l.id === showLyric
              ? 'bg-[#333] text-white border-[#333]'
              : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="showLyric = l.id"
        >
          {{ l.label }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-[#666] w-[68px]">节奏</span>
        <button
          v-for="r in RHYTHMS"
          :key="r.id"
          class="px-3 py-1.5 rounded border text-sm transition"
          :disabled="songMelody"
          :title="songMelody ? '这份谱有旋律（品位数字），右手记号会和数字抢同一行，已禁用' : ''"
          :class="
            songMelody
              ? 'bg-[#f7f7f7] text-[#bbb] border-[#eee] cursor-not-allowed'
              : r.id === patternMode
                ? 'bg-[#333] text-white border-[#333]'
                : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="patternMode = r.id"
        >
          {{ r.label }}
        </button>
        <span v-if="songMelody" class="text-xs text-[#a07]">
          这份谱带旋律，节奏记号不可用（换「弹唱」类曲目试试）
        </span>
      </div>
      <p class="text-xs text-[#888]">{{ activePreset.detail }} · {{ activeSong.hint }}</p>
    </div>

    <div class="border border-[#ddd] rounded-md bg-white p-4">
      <div
        ref="container"
        :style="{ width: CANVAS_WIDTH + 'px', height: activeHeight + 'px' }"
      ></div>
    </div>

    <p class="text-xs text-[#999] leading-relaxed">
      注：「简谱 + 四线谱」同屏（<code class="px-1 rounded bg-[#eee]">SNScoreType.SimpleGuirar</code>）
      上游还没做完——第二行只出数字、不出谱线，所以暂未放进上面的选项。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  SimpleNotation,
  SNDataType,
  SNInstrument,
  SNScoreType,
  UKULELE_CHORDS,
  type SNOptions,
  type SNTemplate,
} from 'simple-notation';
import { PRESETS, presetById, type PresetId } from '../data/instrumentPresets';
import { UkuleleSynth, type UkeInstrument } from '../audio/ukuleleSynth';

const synth = new UkuleleSynth();
const playing = ref(false);
let currentData: SNTemplate | null = null;

const CANVAS_WIDTH = 1100;

/** 每种谱面需要的最小高度（单行谱）——整首谱会由 syncCanvasHeight 撑高 */
const CANVAS_HEIGHT: Record<PresetId, number> = {
  simple: 500,
  guitar: 500,
  'uke-high-g': 500,
  'uke-low-g': 500,
  'uke-dual': 500,
};

interface Song {
  id: string;
  label: string;
  hint: string;
  data?: SNTemplate;
  /** 从 public/ 下现成示例加载，避免把整首谱抄进源码 */
  url?: string;
  /** 扫弦记号（d 下扫 / u 上扫），按拍循环 */
  strum?: string;
}

const SONGS: Song[] = [
  {
    id: 'star',
    label: '小星星',
    hint: '四分音符旋律 + 歌词，1=C4',
    data: {
      info: { title: '' },
      score: '1,1,5,5|6,6,5,-|4,4,3,3|2,2,1,-',
      lyric: '一闪一闪亮晶晶-\n满天都是小星星-',
    },
  },
  {
    id: 'eighth',
    label: '八分音符',
    hint: '带符杠的八分音符，看四线谱的时值线',
    data: {
      info: { title: '' },
      score: '1/8,1/8,5/8,5/8,6/8,6/8,5/8,5/8|4/8,4/8,3/8,3/8,2/8,2/8,1/4',
      lyric: '一 闪 一 闪 亮 晶 晶 -|满 天 都 是 小 星 星',
    },
  },
  {
    id: 'chord',
    label: '弹唱（和弦）',
    hint: 'C → C → F → G，四弦和弦图 + 四线谱',
    data: {
      info: { title: '' },
      score: '{C}1,1,5,5|{C}6,6,5,-|{F}4,4,3,3|{G}2,2,1,-',
      lyric: '一闪一闪亮晶晶-\n满天都是小星星-\n挂在天空放光明-\n好像千颗小眼睛-',
    },
  },
  {
    id: 'zengjingdeni',
    label: '曾经的你（完整）',
    hint: '许巍 · 前奏 + 主歌，带 F/C/G/Am 和弦的完整谱',
    url: '/score/template/【Simple-Notation】曾经的你.json',
  },
  {
    // 弹唱谱（和弦 + 节奏记号）：只有和弦与歌词，人声旋律不画
    id: 'arpeggio',
    label: '弹唱（分解示范）',
    hint: 'C–G–Am–Em，只有和弦与右手记号，没有旋律',
    strum: 'r 3 2 3',
    data: {
      info: { title: '' },
      score:
        '{C}0,0,0,0|{G}0,0,0,0|{Am}0,0,0,0|{Em}0,0,0,0\n' +
        '{F}0,0,0,0|{C}0,0,0,0|{G}0,0,0,0|{C}0,0,0,0',
      lyric:
        '一 闪 一 闪 亮 晶 晶 满 天 都 是 小 星 星 呀 呀\n' +
        '挂 在 天 空 放 光 明 好 像 千 颗 小 眼 睛 呀 呀',
    },
  },
  {
    // 真实尤克编配：来自 mjrainwater/ukulele_chorpro 的 ChordPro 歌本
    // （0003 - Amazing Grace.onsong，key G / 3-4 / tempo 60）
    // 弹唱谱只画和弦与扫弦，人声旋律不画；`0` 是"这一拍不弹旋律"的休止。
    id: 'amazing-grace',
    label: 'Amazing Grace（弹唱）',
    hint: '公有领域 · G 调 3/4 · G–C–G–D / G–C–D7–G · 扫弦 d-u-u',
    strum: 'duu',
    data: {
      info: {
        title: 'Amazing Grace',
        composer: 'John Newton',
        lyricist: '',
        time: '3',
        tempo: '60',
        key: 'G',
        beat: '3',
        author: '',
      },
      score:
        '{G}0,0,0|{C}0,0,0|{G}0,0,0|{D}0,0,0\n{G}0,0,0|{C}0,0,0|{D7}0,0,0|{G}0,0,0',
      lyric: '',
    },
  },
];

const route = useRoute();
const router = useRouter();

const container = ref<HTMLDivElement | null>(null);
let sn: SimpleNotation | null = null;

const initialPreset = route.query.preset as PresetId | undefined;
const initialSong = route.query.song as string | undefined;

/** 乐器：决定弦数、定弦、以及和弦指位图用哪张表。不指定时只能显示简谱 */
const INSTS = [
  { id: 'none', label: '不指定' },
  { id: 'guitar', label: '吉他（6 弦）' },
  { id: 'ukulele-high-g', label: '尤克 · High G' },
  { id: 'ukulele-low-g', label: '尤克 · Low G' },
] as const;
type InstId = (typeof INSTS)[number]['id'];

/** 谱面：简谱 / 指板谱（几线由乐器定） */
const TYPES = [
  { id: 'simple', label: '简谱' },
  { id: 'guitar', label: '指板谱' },
] as const;
type TypeId = (typeof TYPES)[number]['id'];

const instId = ref<InstId>((route.query.inst as InstId) ?? 'ukulele-high-g');
const typeId = ref<TypeId>(
  (route.query.type as TypeId) ?? (initialPreset === 'simple' ? 'simple' : 'guitar'),
);

/** 布局参数仍然借预设（简谱一行矮、指板谱一行高），乐器/谱面各自独立 */
const presetId = computed(() => {
  if (typeId.value === 'simple') return 'simple' as PresetId;
  if (instId.value === 'guitar' || instId.value === 'none') return 'guitar' as PresetId;
  return instId.value as PresetId;
});
const chordMode = ref<'guitar' | 'default' | 'none'>(
  route.query.chords === 'text'
    ? 'default'
    : route.query.chords === 'none'
      ? 'none'
      : 'guitar',
);
/** 歌词显示开关 */
const showLyric = ref(route.query.lyric !== 'off');
/** 当前曲目里有没有和弦标记（没有就不留和弦区，免得顶出一块空白） */
const songHasChord = ref(true);

/** 节奏记号：'' = 跟曲目；其余是手动指定的型 */
const RHYTHMS = [
  { id: '', label: '无' },
  { id: 'd d u u', label: '扫弦 ↓↓↑↑' },
  { id: 'r 3 2 3', label: '分解（根音）' },
  { id: 'd+u d+u | r 3 2 3', label: '混合（八分扫 / 分解）' },
] as const;
const patternMode = ref<string>((route.query.rhythm as string) ?? '');
/** 当前曲目里有没有真实旋律（有 → 右手记号与品位数字互斥，必须禁用） */
const songMelody = ref(false);
const songId = ref<string>(
  initialSong && SONGS.some((s) => s.id === initialSong) ? initialSong : 'star',
);

const activePreset = computed(() => presetById(presetId.value));
const visiblePresets = computed(() => PRESETS.filter((p) => !p.disabled));
const activeSong = computed(
  () => SONGS.find((s) => s.id === songId.value) ?? SONGS[0],
);
const activeHeight = computed(() => CANVAS_HEIGHT[presetId.value]);

/** 选「指位图」必须知道乐器：没指定就自动挑一个（尤克 High G） */
function pickChord(mode: 'guitar' | 'default' | 'none') {
  if (mode === 'guitar' && instId.value === 'none') instId.value = 'ukulele-high-g';
  chordMode.value = mode;
}

function options(): SNOptions {
  const noInst = instId.value === 'none';
  const noChord = chordMode.value === 'none';
  const diagram = chordMode.value === 'guitar' && !noInst && songHasChord.value;
  return {
    // 不用 clientWidth：布局还没稳定时量到的是错的值，SVG 尺寸会锁死在错的宽度上
    width: CANVAS_WIDTH,
    height: activeHeight.value,
    resize: false,
    // infoShow 只跳过标题绘制，信息区仍然占高度；这里把它的高度压成 0
    info: { height: 0, padding: 0 },
    content: { padding: 8, infoShow: false },
    score: {
      ...activePreset.value.score,
      // 「不指定乐器」就整条不传，让库自己用默认值；显式传 undefined 会把默认值打掉
      ...(noInst
        ? {}
        : {
            instrument:
              instId.value === 'guitar'
                ? SNInstrument.Guitar
                : instId.value === 'ukulele-high-g'
                  ? SNInstrument.UkuleleHighG
                  : SNInstrument.UkuleleLowG,
          }),
      scoreType:
        typeId.value === 'simple' ? SNScoreType.Simple : SNScoreType.Guitar,
      chordType: noChord || noInst ? 'default' : chordMode.value,
      // 不显示歌词就把歌词带压掉，行距也更紧凑
      ...(showLyric.value ? {} : { lyricHeight: 0, lineSpace: 12 }),
      // 指位图高 66，简谱只给 12 撑不住；不给指位图就别覆盖（undefined 会打掉默认值）
      ...(diagram ? { chordHeight: 72 } : {}),
      // 指板谱 + 指位图 + 歌词：和弦图要占 66px，行距给足，否则压到上一行歌词
      ...(diagram && typeId.value === 'guitar' ? { lineSpace: 34 } : {}),
      // 节奏记号：手动选了就用选中的，否则跟曲目自带的 pattern/strum
      pattern: songMelody.value ? undefined : patternMode.value || undefined,
      strum:
        songMelody.value || patternMode.value
          ? undefined
          : activeSong.value.strum,
    },
  } as SNOptions;
}

/** 尺寸随预设变，直接重建实例最省事（SNConfig 是静态的，尺寸只在构造时生效） */
async function loadSongData(song: Song): Promise<SNTemplate> {
  if (song.data) {
    currentData = song.data;
    return song.data;
  }
  if (!song.url) return { info: { title: '' }, score: '', lyric: '' };
  const res = await fetch(song.url);
  const json = (await res.json()) as SNTemplate;
  currentData = json;
  return json;
}

/** 从当前谱面里抠出和弦符号，按顺序扫一遍（试听用） */
async function previewStrum() {
  if (playing.value) return;
  const score = currentData?.score ?? '';
  const names = [...score.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  const shapes = names
    .map((n) => UKULELE_CHORDS[n])
    .filter((s): s is (number | null)[] => Array.isArray(s));
  if (!shapes.length) return;

  const inst: UkeInstrument =
    activePreset.value.score.instrument === SNInstrument.UkuleleLowG
      ? 'ukulele-low-g'
      : 'ukulele-high-g';
  const bpm = Number(currentData?.info?.tempo) || 80;

  playing.value = true;
  try {
    // 试听只放前 8 个和弦，够听出音色就行
    await synth.playProgression(inst, shapes.slice(0, 8), bpm, ['d', 'd', 'u', 'u']);
  } finally {
    window.setTimeout(() => {
      playing.value = false;
    }, 1200);
  }
}

async function mount() {
  if (!container.value) return;
  const data = await loadSongData(activeSong.value);
  if (!container.value) return;
  // 旋律与右手记号互斥：有品位数字就不给画节奏记号
  const melody = /[1-7]/.test(data.score ?? '');
  songMelody.value = melody;
  songHasChord.value = /\{[^}]+\}/.test(data.score ?? '');
  if (melody) patternMode.value = '';

  // 「和弦=无」= 把谱面里的 {C} 标记整段去掉；歌词开关同理，直接置空
  const payload = {
    ...data,
    score:
      chordMode.value === 'none'
        ? (data.score ?? '').replace(/\{[^}]*\}/g, '')
        : data.score,
    lyric: showLyric.value ? (data.lyric ?? '') : '',
  };

  sn?.destroy();
  container.value.innerHTML = '';
  sn = new SimpleNotation(container.value, options());
  sn.loadData(payload, SNDataType.TEMPLATE);
  syncCanvasHeight();
}

/** 整首谱会占很多行，画布高度按渲染结果回填，避免被裁掉 */
function syncCanvasHeight() {
  const el = container.value;
  const svg = el?.querySelector('svg');
  const h = svg ? parseFloat(svg.getAttribute('height') || '0') : 0;
  if (el && h > 0) el.style.height = `${Math.ceil(h) + 8}px`;
}

onMounted(async () => {
  await nextTick();
  await mount();
});

watch([instId, typeId], async () => {
  await mount();
  router.replace({
    query: { ...route.query, inst: instId.value, type: typeId.value, preset: undefined },
  });
});

watch(chordMode, () => {
  mount();
  router.replace({ query: { ...route.query, chords: chordMode.value === 'default' ? 'text' : chordMode.value === 'none' ? 'none' : 'diagram' } });
});

watch(showLyric, () => {
  mount();
  router.replace({ query: { ...route.query, lyric: showLyric.value ? undefined : 'off' } });
});

watch(patternMode, () => {
  mount();
  router.replace({ query: { ...route.query, rhythm: patternMode.value || undefined } });
});

watch(songId, async () => {
  const data = await loadSongData(activeSong.value);
  sn?.loadData(data, SNDataType.TEMPLATE);
  syncCanvasHeight();
  router.replace({ query: { ...route.query, song: songId.value } });
});

onBeforeUnmount(() => {
  sn?.destroy();
  sn = null;
});
</script>
