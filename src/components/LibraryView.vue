<script setup lang="ts">
// 素材库：卡片墙 + 标签筛选 + 文本搜索（顶栏全局搜索词联动）
// + 新增/编辑/删除 + bookmarklet 一键收藏入口
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { loadMaterials, mats, ui } from '../store'
import type { Mat } from '../types'

const curTag = ref('全部')
const showForm = ref(false)
const editing = ref<Mat | null>(null)
const saving = ref(false)
const formErr = ref('')

const form = reactive({ source: '', body: '', summary: '', tags: '', fav: 3, url: '' })

onMounted(() => {
  void loadMaterials()
})

const allTags = computed(() => ['全部', ...Array.from(new Set(mats.list.flatMap((m) => m.tags ?? [])))])

const kw = computed(() => ui.search.trim().toLowerCase())

const filtered = computed(() =>
  mats.list.filter((m) => {
    if (curTag.value !== '全部' && !(m.tags ?? []).includes(curTag.value)) return false
    if (kw.value) {
      const hay = [m.body, m.summary, m.source, ...(m.tags ?? []), m.url ?? '']
        .join(' ')
        .toLowerCase()
      if (!hay.includes(kw.value)) return false
    }
    return true
  }),
)

function favStr(fav: number) {
  const n = Math.max(0, Math.min(5, Math.round(fav ?? 0)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function openCreate() {
  editing.value = null
  Object.assign(form, { source: '', body: '', summary: '', tags: '', fav: 3, url: '' })
  formErr.value = ''
  showForm.value = true
}

function openEdit(m: Mat) {
  editing.value = m
  Object.assign(form, {
    source: m.source ?? '',
    body: m.body ?? '',
    summary: m.summary ?? '',
    tags: (m.tags ?? []).join(' '),
    fav: m.fav ?? 3,
    url: m.url ?? '',
  })
  formErr.value = ''
  showForm.value = true
}

// 标签按空白/逗号/分号切，自动补 #
function parseTags(s: string): string[] {
  return s
    .split(/[\s,，;；]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : '#' + t))
}

async function save() {
  if (!form.body.trim()) {
    formErr.value = '正文必填'
    return
  }
  saving.value = true
  formErr.value = ''
  const payload: Parameters<typeof api.createMaterial>[0] = {
    source: form.source.trim() || '手动录入',
    body: form.body.trim(),
    summary: form.summary.trim(),
    tags: parseTags(form.tags),
    fav: form.fav,
    // 无条件携带 url：编辑时清空输入框即可清除原文链接
    url: form.url.trim(),
  }
  try {
    if (editing.value) {
      const m = await api.patchMaterial(editing.value.id, payload)
      const i = mats.list.findIndex((x) => x.id === m.id)
      if (i >= 0) mats.list[i] = m
    } else {
      const m = await api.createMaterial(payload)
      mats.list.unshift(m)
    }
    showForm.value = false
  } catch (e) {
    formErr.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function del(m: Mat) {
  try {
    await api.deleteMaterial(m.id)
    mats.list = mats.list.filter((x) => x.id !== m.id)
  } catch (e) {
    mats.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div>
    <div class="lib-head">
      <div class="panel-title" style="font-size: 13px">
        稍后读 · 素材库 <span class="count">{{ filtered.length }}</span>
      </div>
      <a class="bkml" href="/bookmarklet.js" draggable="true" title="拖我到浏览器书签栏，在推特页面一键收藏">
        🔖 拖我到书签栏 → 一键收藏
      </a>
    </div>

    <div class="filter-chips" id="libFilters">
      <span
        v-for="t in allTags"
        :key="t"
        class="chip"
        :class="{ on: curTag === t }"
        @click="curTag = t"
      >
        {{ t }}
      </span>
    </div>

    <!-- 新增 / 编辑表单 -->
    <div v-if="showForm" class="lib-form">
      <div class="row">
        <div><label>来源</label><input v-model="form.source" placeholder="X · @someone / 网页 · 收藏" /></div>
        <div><label>星级（1-5）</label><input v-model.number="form.fav" type="number" min="1" max="5" /></div>
        <div><label>原文链接（可选）</label><input v-model="form.url" placeholder="https://…" /></div>
      </div>
      <div><label>正文</label><textarea v-model="form.body" placeholder="素材正文，粘贴或摘录…"></textarea></div>
      <div><label>AI 总结 / 用法备注</label><input v-model="form.summary" placeholder="这条素材打算怎么用？" /></div>
      <div><label>标签（空格或逗号分隔，自动补 #）</label><input v-model="form.tags" placeholder="#带货 #脚本" /></div>
      <div v-if="formErr" class="state err" style="padding: 4px 0">{{ formErr }}</div>
      <div class="btns">
        <button class="chip" @click="showForm = false">取消</button>
        <button class="mini-btn" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : editing ? '保存修改' : '存进素材库' }}
        </button>
      </div>
    </div>

    <div style="margin-bottom: 14px">
      <button class="mini-btn" @click="openCreate">＋ 新增素材</button>
    </div>

    <!-- 卡片墙 -->
    <div v-if="mats.loading" class="state">素材加载中…</div>
    <div v-else-if="mats.error" class="state err">{{ mats.error }}</div>
    <div v-else-if="!filtered.length" class="state">
      {{ mats.list.length ? '没有匹配的素材（换个标签或搜索词）' : '素材库还是空的：点「＋ 新增素材」，或在 AI 助手里「☆ 收进素材库」' }}
    </div>
    <div v-else class="cards">
      <div v-for="m in filtered" :key="m.id" class="card">
        <div class="src">
          <span>{{ m.source }}</span>
          <span class="fav">{{ favStr(m.fav) }}</span>
        </div>
        <div class="body">{{ m.body }}</div>
        <div v-if="m.summary" class="sum"><b>AI 总结</b><br />{{ m.summary }}</div>
        <div class="foot">
          <span v-for="t in m.tags" :key="t" class="chip" style="padding: 2px 8px; font-size: 10px; cursor: pointer" @click="curTag = t">{{ t }}</span>
          <span class="date">{{ m.date }}</span>
        </div>
        <div class="acts">
          <a v-if="m.url" :href="m.url" target="_blank" rel="noopener">↗ 打开原文</a>
          <button @click="openEdit(m)">✎ 编辑</button>
          <button title="删除" @click="del(m)">🗑</button>
        </div>
      </div>
    </div>

    <div style="margin-top: 16px; font-size: 11.5px; color: var(--faint)">
      收藏途径：① 推特页点书签栏按钮，链接+正文直接进来　② 页面里手动粘贴　<span style="opacity: .7">（二期：油猴脚本存整个线程 / 自动拉时间线）</span>
    </div>
  </div>
</template>
