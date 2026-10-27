import { createApp } from 'vue';
import App from './App.vue';
import { initTheme } from './theme';
import './style.css';

// 挂载前先落主题，避免首屏闪烁（localStorage 记忆，默认暗色）
initTheme();

createApp(App).mount('#app');
