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
        <span class="text-sm text-[#666] w-[68px]">谱面</span>
        <button
          v-for="p in visiblePresets"
          :key="p.id"
          class="px-3 py-1.5 rounded border text-sm transition"
          :class="
            p.id === presetId
              ? 'bg-[#333] text-white border-[#333]'
              : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="presetId = p.id"
        >
          {{ p.label }}
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
          v-for="c in [{ id: 'guitar', label: '指位图' }, { id: 'default', label: '文字' }]"
          :key="c.id"
          class="px-3 py-1.5 rounded border text-sm transition"
          :class="
            c.id === chordMode
              ? 'bg-[#333] text-white border-[#333]'
              : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f5f5f5]'
          "
          @click="chordMode = c.id as 'guitar' | 'default'"
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
];

const route = useRoute();
const router = useRouter();

const container = ref<HTMLDivElement | null>(null);
let sn: SimpleNotation | null = null;

const initialPreset = route.query.preset as PresetId | undefined;
const initialSong = route.query.song as string | undefined;

const presetId = ref<PresetId>(
  initialPreset && PRESETS.some((p) => p.id === initialPreset)
    ? initialPreset
    : 'uke-high-g',
);
const chordMode = ref<'guitar' | 'default'>(
  route.query.chords === 'text' ? 'default' : 'guitar',
);
const songId = ref<string>(
  initialSong && SONGS.some((s) => s.id === initialSong) ? initialSong : 'star',
);

const activePreset = computed(() => presetById(presetId.value));
const visiblePresets = computed(() => PRESETS.filter((p) => !p.disabled));
const activeSong = computed(
  () => SONGS.find((s) => s.id === songId.value) ?? SONGS[0],
);
const activeHeight = computed(() => CANVAS_HEIGHT[presetId.value]);

function options(): SNOptions {
  return {
    // 不用 clientWidth：布局还没稳定时量到的是错的值，SVG 尺寸会锁死在错的宽度上
    width: CANVAS_WIDTH,
    height: activeHeight.value,
    resize: false,
    // infoShow 只跳过标题绘制，信息区仍然占高度；这里把它的高度压成 0
    info: { height: 0, padding: 0 },
    content: { padding: 8, infoShow: false },
    score: { ...activePreset.value.score, chordType: chordMode.value },
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
  sn?.destroy();
  container.value.innerHTML = '';
  sn = new SimpleNotation(container.value, options());
  sn.loadData(data, SNDataType.TEMPLATE);
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

watch(presetId, async () => {
  await mount();
  router.replace({ query: { ...route.query, preset: presetId.value } });
});

watch(chordMode, () => {
  mount();
  router.replace({ query: { ...route.query, chords: chordMode.value === 'default' ? 'text' : 'diagram' } });
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
