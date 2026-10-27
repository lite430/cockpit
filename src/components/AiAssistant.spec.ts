// AI 草稿助手：对 503（未配置 key）显示去 server/config.json 配智谱 key 的提示
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { api, ApiError } from '../api'
import { aiDraft } from '../store'
import AiAssistant from './AiAssistant.vue'

beforeEach(() => {
  vi.restoreAllMocks()
  // store 是模块级单例，逐用例复位
  aiDraft.line = 'xhs'
  aiDraft.type = 'script'
  aiDraft.prompt = ''
  aiDraft.token = 0
})

describe('AiAssistant', () => {
  it('后端 503（AI 未配置）→ 显示 server/config.json 配智谱 key 的指引', async () => {
    vi.spyOn(api, 'aiGenerate').mockRejectedValue(
      new ApiError('AI 未配置', 503, { error: 'AI 未配置' }),
    )
    const wrapper = mount(AiAssistant)

    await wrapper.find('textarea.ai-input').setValue('写一条小红书图文，主题：AI 副业微课')
    await wrapper.find('.gen-btn').trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('503')
    expect(text).toContain('server/config.json')
    expect(text).toContain('智谱')
    // 503 时不应出现打字机占位内容之外的“草稿”
    expect(wrapper.find('.ai-err').exists()).toBe(true)
  })

  it('生成成功 → 本地打字机逐步呈现（最终完整文本可复制）', async () => {
    vi.spyOn(api, 'aiGenerate').mockResolvedValue({ text: '第一条草稿内容' })
    const wrapper = mount(AiAssistant)

    await wrapper.find('textarea.ai-input').setValue('写条文案')
    await wrapper.find('.gen-btn').trigger('click')
    await flushPromises()

    // 打字机每 18ms 走 3 字，等它跑完
    await new Promise((r) => setTimeout(r, 200))
    expect(wrapper.text()).toContain('第一条草稿内容')
  })

  it('「收进素材库」→ POST /api/materials 且进入共享素材列表', async () => {
    vi.spyOn(api, 'aiGenerate').mockResolvedValue({ text: '草稿正文草稿正文' })
    const created = {
      id: 'm9',
      source: 'AI 助手 · xhs',
      body: '草稿正文草稿正文',
      summary: '写条文案',
      tags: ['#AI草稿', '#xhs'],
      fav: 3,
      date: '10/1',
    }
    const createMaterial = vi.spyOn(api, 'createMaterial').mockResolvedValue(created)
    const { mats } = await import('../store')
    mats.list = []
    mats.loaded = true

    const wrapper = mount(AiAssistant)
    await wrapper.find('textarea.ai-input').setValue('写条文案')
    await wrapper.find('.gen-btn').trigger('click')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 200))

    await wrapper.findAll('.ai-actions button')[2].trigger('click')
    await flushPromises()

    expect(createMaterial).toHaveBeenCalledTimes(1)
    const arg = createMaterial.mock.calls[0][0]
    expect(arg.body).toBe('草稿正文草稿正文')
    expect(arg.tags).toContain('#AI草稿')
    expect(mats.list.map((m) => m.id)).toContain('m9')
  })
})
