// 轻量全局状态（无 pinia，够用即可）：
// - ui：当前视图 + 全局搜索词（顶栏 ↔ 素材库联动）
// - aiDraft：AI 助手状态（待回评论点「回」跨组件预填）
// - mats：素材库共享列表（总览 AI「收进素材库」与素材库页共用一份）
import { reactive } from 'vue'
import { api } from './api'
import type { Mat, Tag, AiGenType } from './types'

export type ViewId = 'overview' | 'library'

export const ui = reactive({
  view: 'overview' as ViewId,
  search: '',
})

export const aiDraft = reactive({
  line: 'xhs' as Tag,
  type: 'script' as AiGenType,
  prompt: '',
  token: 0, // 预填计数器：AiAssistant watch 它来聚焦输入框
})

// 待回评论点「回」→ 跳 AI 助手预填（type 固定 reply）
export function prefillAiDraft(patch: { line: Tag; type: AiGenType; prompt: string }) {
  aiDraft.line = patch.line
  aiDraft.type = patch.type
  aiDraft.prompt = patch.prompt
  aiDraft.token++
}

export const mats = reactive({
  list: [] as Mat[],
  loading: false,
  loaded: false,
  error: '',
})

export async function loadMaterials(force = false) {
  if (mats.loaded && !force) return
  mats.loading = true
  mats.error = ''
  try {
    mats.list = await api.getMaterials()
    mats.loaded = true
  } catch (e) {
    mats.error = e instanceof Error ? e.message : String(e)
  } finally {
    mats.loading = false
  }
}
