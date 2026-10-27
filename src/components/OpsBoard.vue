<script setup lang="ts">
// 中列运营看板：业务线 Tab（xhs/xy/sph）+ 三张数据卡（含 SVG 走势线）
// + 发布排期（新增 POST / 改状态 PATCH）+ 待回评论（「回」→ AI 助手预填，✓ → PATCH handled）
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import { prefillAiDraft } from '../store'
import type { Cm, Line, Pub } from '../types'
import SparkLine from './SparkLine.vue'

const LINE_COLOR: Record<string, string> = {
  xhs: 'var(--xhs)',
  xy: 'var(--xy)',
  sph: 'var(--sph)',
}
const color = (id: string) => LINE_COLOR[id] ?? 'var(--accent)'

const ST_OPTIONS = ['待发', '待办', '待剪', '选题', '已发', '完成']
const ST_CLASS: Record<string, string> = {
  待发: 'st-todo',
  待办: 'st-todo',
  选题: 'st-todo',
  待剪: 'st-warn',
  已发: 'st-done',
  完成: 'st-done',
}
const stClass = (st: string) => ST_CLASS[st] ?? 'st-todo'
const stOptions = (st: string) => (ST_OPTIONS.includes(st) ? ST_OPTIONS : [st, ...ST_OPTIONS])

const lines = ref<Line[]>([])
const cur = ref('xhs')
const loading = ref(true)
const error = ref('')

const active = computed(() => lines.value.find((l) => l.id === cur.value))
const statEntries = computed(() =>
  active.value ? Object.entries(active.value.stats ?? {}) : [],
)
const unhandledCount = computed(() =>
  active.value ? active.value.cms.filter((c) => !c.handled).length : 0,
)

// 固定 zh-CN：分组符恒为逗号，避免运行环境区域设置不同导致显示与测试断言漂移
const fmt = (n: number) => Number(n ?? 0).toLocaleString('zh-CN')
const deltaStr = (d: number) => `${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}% 较上周`
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

// 新增排期表单
const npWhen = ref('今天')
const npTt = ref('')
const npSt = ref('待发')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const ls = await api.getLines()
    lines.value = ls
    if (ls.length && !ls.some((l) => l.id === cur.value)) cur.value = ls[0].id
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function addPub() {
  if (!active.value || !npTt.value.trim()) return
  try {
    const p = await api.createPub(active.value.id, {
      when: npWhen.value || '今天',
      tt: npTt.value.trim(),
      st: npSt.value,
    })
    active.value.pubs.push(p)
    npTt.value = ''
  } catch (e) {
    error.value = errMsg(e)
  }
}

async function changeSt(p: Pub, ev: Event) {
  const st = (ev.target as HTMLSelectElement).value
  const old = p.st
  p.st = st
  try {
    await api.patchPub(cur.value, p.id, { st })
  } catch (e) {
    p.st = old
    error.value = errMsg(e)
  }
}

// 点「回」：把评论塞进 AI 助手（line + type=reply + 预填 prompt）
function reply(c: Cm) {
  if (!active.value) return
  prefillAiDraft({
    line: active.value.id,
    type: 'reply',
    prompt: `帮我回复这条评论（${active.value.name}）：${c.who}：${c.txt}`,
  })
}

async function markHandled(c: Cm) {
  if (!active.value) return
  const next = !c.handled
  c.handled = next
  try {
    await api.patchCm(active.value.id, c.id, { handled: next })
  } catch (e) {
    c.handled = !next
    error.value = errMsg(e)
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="panel"><div class="state">看板加载中…</div></div>
    <div v-else-if="error" class="panel"><div class="state err">{{ error }}</div></div>
    <div v-else-if="!lines.length" class="panel"><div class="state">没有业务线数据（GET /api/lines）</div></div>
    <template v-else>
      <!-- 业务线 Tab -->
      <div class="line-tabs">
        <button
          v-for="l in lines"
          :key="l.id"
          class="line-tab"
          :class="{ active: l.id === cur }"
          :style="{ '--line-c': color(l.id) }"
          @click="cur = l.id"
        >
          <div class="ln"><span class="st" :style="{ background: color(l.id) }"></span>{{ l.name }}</div>
          <div class="sub">{{ l.sub }}</div>
        </button>
      </div>

      <!-- 三张数据卡 -->
      <div v-if="active" class="stat-row">
        <div v-for="[k, pair] in statEntries" :key="k" class="stat">
          <div class="k">{{ k }}</div>
          <div class="v">{{ fmt(pair[0]) }}</div>
          <div class="d" :class="pair[1] >= 0 ? 'up' : 'down'">{{ deltaStr(pair[1]) }}</div>
          <SparkLine :data="active.spark" :color="color(active.id)" />
        </div>
      </div>

      <div v-if="active" class="ops-cols">
        <!-- 发布排期 -->
        <div class="panel" style="margin: 0">
          <div class="panel-title">发布排期<span class="right">点状态可改</span></div>
          <div v-if="!active.pubs.length" class="state">暂无排期</div>
          <div v-for="p in active.pubs" :key="p.id" class="item">
            <div class="when" :style="{ color: color(active.id) }">{{ p.when }}</div>
            <div class="tt">{{ p.tt }}</div>
            <select
              class="st2"
              :class="stClass(p.st)"
              :value="p.st"
              title="改状态（PATCH）"
              @change="changeSt(p, $event)"
            >
              <option v-for="s in stOptions(p.st)" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="input-line" style="margin-top: 10px">
            <input v-model="npWhen" class="txt" style="width: 84px; flex: none" placeholder="时间" />
            <input
              v-model="npTt"
              class="txt"
              style="flex: 1"
              placeholder="新排期标题，如：第 4 讲图文"
              @keyup.enter="addPub"
            />
            <select v-model="npSt" class="sel">
              <option v-for="s in ST_OPTIONS" :key="s" :value="s">{{ s }}</option>
            </select>
            <button class="mini-btn" @click="addPub">＋</button>
          </div>
        </div>

        <!-- 待回评论 -->
        <div class="panel" style="margin: 0">
          <div class="panel-title">待回评论 <span class="count">{{ unhandledCount }} 条</span></div>
          <div v-if="!active.cms.length" class="state">没有待回评论 🎉</div>
          <div
            v-for="c in active.cms"
            :key="c.id"
            class="item comment-item"
            :class="{ handled: c.handled }"
            style="align-items: flex-start"
          >
            <div style="flex: 1">
              <div class="who">{{ c.who }}</div>
              <div class="txt">{{ c.txt }}</div>
            </div>
            <button class="reply-btn" :style="{ background: color(active.id) }" @click="reply(c)">回</button>
            <button
              class="ok-btn"
              :class="{ on: c.handled }"
              :title="c.handled ? '已处理' : '回复后勾掉（PATCH handled）'"
              @click="markHandled(c)"
            >
              ✓
            </button>
          </div>
          <div class="manual-note">一期：手动处理，回来勾掉 · 二期：安卓自动化接管 ↗</div>
        </div>
      </div>
    </template>
  </div>
</template>
