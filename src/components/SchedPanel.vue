<script setup lang="ts">
// 今日日程时间线：当前时段高亮（最后一个 time <= 现在的条目）
// 一期手动维护：新增（POST /api/schedule）/ 删除（DELETE），二期接飞书日历源
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from '../api'
import type { SchedItem } from '../types'

const items = ref<SchedItem[]>([])
const loading = ref(true)
const error = ref('')
const nowMin = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function toMin(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? '').trim())
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}
function tick() {
  const d = new Date()
  nowMin.value = d.getHours() * 60 + d.getMinutes()
}

// 当前时段 = 已开始的最近一条（没有已开始的则暂不高亮）
const currentId = computed<string | null>(() => {
  const past = items.value
    .filter((s) => Number.isFinite(toMin(s.time)) && toMin(s.time) <= nowMin.value)
    .sort((a, b) => toMin(a.time) - toMin(b.time))
  return past.length ? past[past.length - 1].id : null
})

// 新增日程表单
const npTime = ref('')
const npTitle = ref('')

function sortByTime(list: SchedItem[]) {
  return [...list].sort((a, b) => toMin(a.time) - toMin(b.time))
}

async function addSched() {
  const title = npTitle.value.trim()
  if (!title) return
  try {
    const s = await api.createSchedule({ time: npTime.value.trim() || '12:00', title })
    items.value = sortByTime([...items.value, s])
    npTitle.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function removeSched(s: SchedItem) {
  const old = items.value
  items.value = old.filter((x) => x.id !== s.id)
  try {
    await api.deleteSchedule(s.id)
  } catch (e) {
    items.value = old
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(async () => {
  tick()
  timer = setInterval(tick, 30000)
  try {
    items.value = sortByTime(await api.getSchedule())
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="panel">
    <div class="panel-title">
      今日日程 <span class="phase2" title="二期：可插拔日历源，接飞书">飞书同步 ·二期</span>
    </div>
    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>
    <div v-else-if="!items.length" class="state">今天没有日程</div>
    <template v-else>
      <div
        v-for="s in items"
        :key="s.id"
        class="sched"
        :class="{ now: s.id === currentId }"
        :title="s.id === currentId ? '当前时段' : ''"
      >
        <div class="when">{{ s.time }}</div>
        <div>
          <div class="what">{{ s.title }}</div>
          <div v-if="s.note" class="sub">{{ s.note }}</div>
        </div>
        <button class="sched-x" title="删除这条日程" @click="removeSched(s)">✕</button>
      </div>
      <div style="text-align: center; margin-top: 8px">
        <span class="phase2" title="二期：从飞书日历拉取">＋ 从飞书日历拉取 · 二期</span>
      </div>
    </template>
    <div class="input-line" style="margin-top: 10px">
      <input v-model="npTime" class="txt" style="width: 64px; flex: none" placeholder="19:00" />
      <input
        v-model="npTitle"
        class="txt"
        style="flex: 1"
        placeholder="新日程标题，如：视频号选题会"
        @keyup.enter="addSched"
      />
      <button class="mini-btn" title="添加日程（POST /api/schedule）" @click="addSched">＋</button>
    </div>
  </div>
</template>

<style scoped>
.sched-x {
  margin-left: auto;
  align-self: center;
  background: none;
  border: none;
  color: var(--faint);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 5px;
}
.sched-x:hover {
  color: var(--danger);
  background: rgba(255, 107, 107, 0.12);
}
</style>
