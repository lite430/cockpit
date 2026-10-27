// src/api.ts 自身的行为：非 2xx 抛 ApiError（带 status / body.error），2xx 正常解析
import { describe, it, expect, vi, afterEach } from 'vitest'
import { api, ApiError } from './api'

// 用普通对象模拟 Response，避免依赖具体运行时的 Response 实现
function stubRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'stub',
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api.ts 统一 fetch 封装', () => {
  it('非 2xx 抛 ApiError，status 与 body.error 可读', async () => {
    const fetchMock = vi.fn(async () => stubRes(500, { error: '服务器炸了' }))
    vi.stubGlobal('fetch', fetchMock)

    const err: unknown = await api.getTodos().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    const apiErr = err as ApiError
    expect(apiErr.status).toBe(500)
    expect(apiErr.message).toBe('服务器炸了')
    expect(apiErr.body).toEqual({ error: '服务器炸了' })
  })

  it('503 {error:"AI 未配置"} 同样抛 ApiError（AI 助手据此提示配置）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => stubRes(503, { error: 'AI 未配置' })))
    const err: unknown = await api.aiGenerate({ line: 'xhs', type: 'script', prompt: 'x' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(503)
    expect((err as ApiError).message).toBe('AI 未配置')
  })

  it('非 2xx 且无 JSON body 时，message 回退为 HTTP 状态码描述', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('no json')
        },
        text: async () => 'Bad Gateway',
      })),
    )
    const err: unknown = await api.getLines().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(502)
    expect((err as ApiError).message).toContain('502')
  })

  it('2xx 返回解析后的 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => stubRes(200, { ok: true })))
    await expect(api.health()).resolves.toEqual({ ok: true })
  })

  it('POST 带 JSON 序列化的 body 与方法', async () => {
    const fetchMock = vi.fn(async () => stubRes(201, { id: 't1', text: 'x', due: '今天', done: false, tag: 'xhs' }))
    vi.stubGlobal('fetch', fetchMock)

    await api.createTodo({ text: '回复评论区 5 条', due: '今天', tag: 'xhs' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/todos')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ text: '回复评论区 5 条', due: '今天', tag: 'xhs' }))
  })
})
