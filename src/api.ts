// 统一 API 封装：所有请求走 fetch（dev 下 /api 由 vite 代理到 5175 后端）
// 契约见 docs/api-contract.md；非 2xx 一律抛 ApiError（带 status 与响应体）
import type { AiGenType, Cm, Line, Mat, Pub, SchedItem, Scratch, Tag, Todo } from './types'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

interface ReqInit {
  method?: string
  body?: unknown
}

function extractErrMsg(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as { error: unknown }).error
    if (typeof e === 'string' && e) return e
  }
  return `请求失败：HTTP ${status}`
}

async function req<T>(path: string, init: ReqInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch (e) {
    // fetch 本身失败（后端没起 / 断网），status 记 0
    throw new ApiError('网络请求失败（后端未启动？试试 npm run dev）', 0, e)
  }
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    throw new ApiError(extractErrMsg(body, res.status), res.status, body)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError('响应不是合法 JSON', res.status, text)
  }
}

export const api = {
  health: () => req<{ ok: boolean }>('/api/health'),

  // ---- 待办 ----
  getTodos: () => req<Todo[]>('/api/todos'),
  createTodo: (data: { text: string; due: string; tag: Tag }) =>
    req<Todo>('/api/todos', { method: 'POST', body: data }),
  patchTodo: (id: string, patch: Partial<Pick<Todo, 'done' | 'text' | 'due' | 'tag'>>) =>
    req<Todo>(`/api/todos/${id}`, { method: 'PATCH', body: patch }),
  deleteTodo: (id: string) => req<void>(`/api/todos/${id}`, { method: 'DELETE' }),

  // ---- 日程 ----
  getSchedule: () => req<SchedItem[]>('/api/schedule'),
  createSchedule: (data: { time: string; title: string; note?: string }) =>
    req<SchedItem>('/api/schedule', { method: 'POST', body: data }),
  deleteSchedule: (id: string) => req<void>(`/api/schedule/${id}`, { method: 'DELETE' }),

  // ---- 业务线 ----
  getLines: () => req<Line[]>('/api/lines'),
  createPub: (lineId: string, data: { when: string; tt: string; st: string }) =>
    req<Pub>(`/api/lines/${lineId}/pubs`, { method: 'POST', body: data }),
  patchPub: (lineId: string, pubId: string, patch: Partial<Pick<Pub, 'st' | 'when' | 'tt'>>) =>
    req<Pub>(`/api/lines/${lineId}/pubs/${pubId}`, { method: 'PATCH', body: patch }),
  patchCm: (lineId: string, cmId: string, patch: { handled: boolean }) =>
    req<Cm>(`/api/lines/${lineId}/cms/${cmId}`, { method: 'PATCH', body: patch }),

  // ---- 素材库 ----
  getMaterials: (tag?: string) =>
    req<Mat[]>(tag ? `/api/materials?tag=${encodeURIComponent(tag)}` : '/api/materials'),
  createMaterial: (data: {
    source: string
    body: string
    summary: string
    tags: string[]
    fav?: number
    url?: string
  }) => req<Mat>('/api/materials', { method: 'POST', body: data }),
  patchMaterial: (id: string, patch: Partial<Mat>) =>
    req<Mat>(`/api/materials/${id}`, { method: 'PATCH', body: patch }),
  deleteMaterial: (id: string) => req<void>(`/api/materials/${id}`, { method: 'DELETE' }),

  // ---- 速记 ----
  getScratch: () => req<Scratch>('/api/scratch'),
  putScratch: (text: string) => req<Scratch>('/api/scratch', { method: 'PUT', body: { text } }),

  // ---- AI ----
  aiGenerate: (data: { line: Tag; type: AiGenType; prompt: string }) =>
    req<{ text: string }>('/api/ai/generate', { method: 'POST', body: data }),
}
