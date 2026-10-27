<script setup lang="ts">
// 速记：GET 载入，输入 600ms 防抖 PUT 保存，卸载时兜底 flush
// 加载完成前用户已输入时，用户内容优先：不被服务端旧值覆盖，并在加载完成后立即补存
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '../api'

type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const text = ref('')
const status = ref<Status>('idle')
const savedAt = ref('')
const loadError = ref('')

let loaded = false
let typedBeforeLoad = false
let timer: ReturnType<typeof setTimeout> | undefined

function fmt() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function save() {
  if (!loaded) return
  status.value = 'saving'
  try {
    await api.putScratch(text.value)
    status.value = 'saved'
    savedAt.value = fmt()
  } catch {
    status.value = 'error'
  }
}

function onInput(e: Event) {
  text.value = (e.target as HTMLTextAreaElement).value
  typedBeforeLoad = true
  status.value = 'dirty'
  if (timer) clearTimeout(timer)
  timer = setTimeout(save, 600)
}

onMounted(async () => {
  try {
    const r = await api.getScratch()
    if (!typedBeforeLoad) text.value = r?.text ?? ''
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
  loaded = true
  if (typedBeforeLoad) void save()
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  if (status.value === 'dirty' || status.value === 'saving') void save()
})
</script>

<template>
  <div class="panel">
    <div class="panel-title">
      速记<span class="right">600ms 防抖自动保存</span>
    </div>
    <div v-if="loadError" class="state err">{{ loadError }}</div>
    <textarea
      class="scratch"
      :value="text"
      placeholder="随手记… 想到什么写什么，自动保存到本地 data/db.json&#10;例：微课选题——用 GLM 给闲鱼客服写自动回复"
      @input="onInput"
    ></textarea>
    <div class="save-status" :data-s="status">
      {{
        status === 'saving'
          ? '保存中…'
          : status === 'saved'
            ? `✓ 已保存 ${savedAt}`
            : status === 'dirty'
              ? '未保存…'
              : status === 'error'
                ? '保存失败（后端在运行吗？）'
                : ''
      }}
    </div>
  </div>
</template>
