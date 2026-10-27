<script setup lang="ts">
// 今日待办：勾选 PATCH done（乐观更新+失败回滚）、新增 POST、删除 DELETE
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import type { Tag, Todo } from '../types'

const items = ref<Todo[]>([])
const loading = ref(true)
const error = ref('')

const newText = ref('')
const newTag = ref<Tag>('xhs')
const newDue = ref('今天')

const TAGS: { id: Tag; name: string }[] = [
  { id: 'xhs', name: '小红书' },
  { id: 'xy', name: '闲鱼' },
  { id: 'sph', name: '视频号' },
]

const undone = computed(() => items.value.filter((t) => !t.done).length)
const tagName = (tag: string) => TAGS.find((x) => x.id === tag)?.name ?? tag
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await api.getTodos()
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function toggle(t: Todo) {
  const next = !t.done
  t.done = next // 乐观更新 → .done 类 → 划线
  try {
    await api.patchTodo(t.id, { done: next })
  } catch (e) {
    t.done = !next
    error.value = errMsg(e)
  }
}

async function add() {
  const text = newText.value.trim()
  if (!text) return
  try {
    const t = await api.createTodo({ text, due: newDue.value || '今天', tag: newTag.value })
    items.value.push(t)
    newText.value = ''
  } catch (e) {
    error.value = errMsg(e)
  }
}

async function remove(t: Todo) {
  try {
    await api.deleteTodo(t.id)
    items.value = items.value.filter((x) => x.id !== t.id)
  } catch (e) {
    error.value = errMsg(e)
  }
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">
      今日待办 <span class="count">{{ undone }}</span>
      <span class="right">勾掉即存（PATCH）</span>
    </div>
    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>
    <div v-else-if="!items.length" class="state">今天没有待办，摸鱼也行 🐟</div>
    <template v-else>
      <div v-for="t in items" :key="t.id" class="todo-item" :class="{ done: t.done }">
        <input type="checkbox" :checked="t.done" @change="toggle(t)" />
        <div class="td-body">
          <div class="t">{{ t.text }}</div>
          <div class="meta">
            <span class="tagline" :class="'tl-' + t.tag">{{ tagName(t.tag) }}</span>{{ t.due }}
            <button class="icon-x" title="删除" @click="remove(t)">✕</button>
          </div>
        </div>
      </div>
    </template>
    <div class="input-line" style="margin-top: 10px">
      <input
        v-model="newText"
        class="txt"
        style="flex: 1"
        placeholder="新增待办，回车或点＋"
        @keyup.enter="add"
      />
      <select v-model="newTag" class="sel" title="业务线">
        <option v-for="g in TAGS" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
      <button class="mini-btn" @click="add">＋</button>
    </div>
  </div>
</template>
