<script setup lang="ts">
// AI 草稿助手：选业务线 + 类型 → POST /api/ai/generate → 本地打字机效果呈现
// 503（未配置 key）时给出明确指引：去 server/config.json 配智谱 key
// 待回评论点「回」会通过 store 的 aiDraft 预填这里
import { onBeforeUnmount, ref, watch } from 'vue'
import { api, ApiError } from '../api'
import { aiDraft, mats } from '../store'

const AI_LINES = [
  { id: 'xhs', n: '小红书微课' },
  { id: 'xy', n: '闲鱼微课' },
  { id: 'sph', n: '视频号带货' },
] as const
const AI_TYPES = [
  { id: 'script', n: '微课脚本' },
  { id: 'copy', n: '带货文案' },
  { id: 'reply', n: '评论回复' },
] as const

const generating = ref(false)
const typing = ref(false)
const typed = ref('')
const fullText = ref('')
const error = ref('')
const note = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)

let typeTimer: ReturnType<typeof setInterval> | undefined
let noteTimer: ReturnType<typeof setTimeout> | undefined

function stopType() {
  if (typeTimer) clearInterval(typeTimer)
  typeTimer = undefined
  typing.value = false
}

// 打字机：每 18ms 露出 3 个字符（同原型节奏）
function typeOut(text: string) {
  stopType()
  fullText.value = text
  typed.value = ''
  if (!text) return
  typing.value = true
  let i = 0
  typeTimer = setInterval(() => {
    i += 3
    typed.value = text.slice(0, i)
    if (i >= text.length) {
      typed.value = text
      stopType()
    }
  }, 18)
}

async function generate() {
  if (generating.value) return
  if (!aiDraft.prompt.trim()) {
    error.value = '先写点要求，比如主题、受众、口吻…'
    return
  }
  generating.value = true
  error.value = ''
  stopType()
  try {
    const r = await api.aiGenerate({
      line: aiDraft.line,
      type: aiDraft.type,
      prompt: aiDraft.prompt,
    })
    typeOut(r?.text ?? '')
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) {
      error.value =
        'AI 未配置（503）：后端没拿到大模型 Key。\n请编辑 server/config.json，填入智谱 API Key（参考 server/config.example.json 的 AI_BASE_URL / AI_API_KEY / AI_MODEL，默认指向 https://open.bigmodel.cn/api/paas/v4/，模型如 glm-4-flash），保存后重启 npm run dev 再试。'
    } else {
      error.value = e instanceof Error ? e.message : String(e)
    }
  } finally {
    generating.value = false
  }
}

function flashNote(msg: string) {
  note.value = msg
  if (noteTimer) clearTimeout(noteTimer)
  noteTimer = setTimeout(() => {
    note.value = ''
  }, 1600)
}

async function copy() {
  if (!fullText.value) return
  try {
    await navigator.clipboard?.writeText(fullText.value)
    flashNote('✅ 已复制')
  } catch {
    flashNote('复制失败，手动选中文本即可')
  }
}

function rewrite() {
  void generate()
}

// 收进素材库：POST /api/materials，直接推进共享 mats.list（素材库页即时可见）
async function saveToLib() {
  if (!fullText.value) {
    flashNote('还没有草稿')
    return
  }
  try {
    const m = await api.createMaterial({
      source: `AI 助手 · ${aiDraft.line}`,
      body: fullText.value,
      summary: aiDraft.prompt.trim().slice(0, 80),
      tags: ['#AI草稿', `#${aiDraft.line}`],
      fav: 3,
    })
    mats.list.unshift(m)
    flashNote('★ 已收进素材库（切到素材库页可见）')
  } catch (e) {
    flashNote('收进素材库失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

// 待回评论预填后聚焦输入框
watch(
  () => aiDraft.token,
  () => inputEl.value?.focus(),
)

onBeforeUnmount(() => {
  stopType()
  if (noteTimer) clearTimeout(noteTimer)
})
</script>

<template>
  <div class="panel">
    <div class="panel-title">AI 草稿助手</div>
    <div class="lbl">业务线</div>
    <div class="chips">
      <span
        v-for="l in AI_LINES"
        :key="l.id"
        class="chip"
        :class="{ on: aiDraft.line === l.id }"
        @click="aiDraft.line = l.id"
      >
        {{ l.n }}
      </span>
    </div>
    <div class="lbl">生成类型</div>
    <div class="chips">
      <span
        v-for="t in AI_TYPES"
        :key="t.id"
        class="chip"
        :class="{ on: aiDraft.type === t.id }"
        @click="aiDraft.type = t.id"
      >
        {{ t.n }}
      </span>
    </div>
    <textarea
      ref="inputEl"
      v-model="aiDraft.prompt"
      class="ai-input"
      placeholder="例：写一条小红书图文，主题「上班族用 AI 做副业微课，第 2 讲：选题」…"
    ></textarea>
    <button class="gen-btn" :disabled="generating" @click="generate">
      {{ generating ? '生成中…' : '✦ 生成草稿' }}
    </button>

    <div v-if="error" class="ai-err" role="alert">{{ error }}</div>

    <div class="ai-out">
      <span v-if="!typed && !typing && !error" class="ph">
        生成的草稿会出现在这里，可以复制 / 重写 / 收进素材库
      </span>
      <template v-else>{{ typed }}<span v-if="typing" class="caret"></span></template>
    </div>
    <div class="ai-note">{{ note }}</div>
    <div class="ai-actions">
      <button @click="copy">📋 复制</button>
      <button @click="rewrite">🔁 重写</button>
      <button @click="saveToLib">☆ 收进素材库</button>
    </div>
    <div class="ai-foot">⚙️ 模型：智谱 GLM · OpenAI 兼容可配置（server/config.json 里填 key）</div>
  </div>
</template>
