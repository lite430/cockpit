<script setup lang="ts">
// 顶栏：品牌 / 视图切换 / 全局搜索（Ctrl+K 聚焦）/ 时钟 / 明暗主题切换
import { onMounted, onUnmounted, ref } from 'vue'
import { ui } from '../store'
import { useTheme } from '../theme'

const { theme, toggle } = useTheme()

const searchEl = ref<HTMLInputElement | null>(null)
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const dateStr = () => `${now.value.getMonth() + 1}月${now.value.getDate()}日 ${WD[now.value.getDay()]}`
const timeStr = () =>
  `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchEl.value?.focus()
  }
}

// 搜索词全局共享；在总览页输入时切到素材库页看结果
function onSearchInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  ui.search = v
  if (v && ui.view !== 'library') ui.view = 'library'
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 10000)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header class="topbar">
    <div class="brand"><span class="dot"></span>COCKPIT <span class="badge">LOCAL</span></div>
    <nav class="nav">
      <button :class="{ active: ui.view === 'overview' }" @click="ui.view = 'overview'">总览</button>
      <button :class="{ active: ui.view === 'library' }" @click="ui.view = 'library'">素材库</button>
    </nav>
    <div class="search">
      <input
        ref="searchEl"
        :value="ui.search"
        placeholder="搜索任务 / 素材 / 标签…   (Ctrl+K)"
        @input="onSearchInput"
      />
    </div>
    <div class="clock">
      <div class="date">{{ dateStr() }}</div>
      <div class="time">{{ timeStr() }}</div>
    </div>
    <button class="icon-btn" :title="theme === 'dark' ? '切换到亮色' : '切换到暗色'" @click="toggle">
      {{ theme === 'dark' ? '☀️' : '🌙' }}
    </button>
    <div class="avatar" title="单用户 · 本地运行">我</div>
  </header>
</template>
