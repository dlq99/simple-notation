import { type RouteRecordRaw } from 'vue-router';
import Home from './pages/Home.vue';
import PianoRoll from './pages/PianoRoll.vue';
import Gallery from './pages/Gallery.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: Home },
  { path: '/gallery', name: 'Gallery', component: Gallery },
  { path: '/piano-roll', name: 'PianoRoll', component: PianoRoll },
];
