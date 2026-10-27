// 素材库：标签筛选（全部 / 单标签）、文本搜索联动、加载与空态
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { api } from '../api'
import { mats, ui } from '../store'
import type { Mat } from '../types'
import LibraryView from './LibraryView.vue'

const MATS: Mat[] = [
  {
    id: 'm1',
    source: 'X · @sundyme',
    body: '带货视频的黄金 3 秒：先制造认领瞬间',
    summary: '可直接用于视频号开场',
    tags: ['#带货', '#脚本'],
    fav: 4,
    date: '9/27',
    url: 'https://example.com/post/1',
  },
  {
    id: 'm2',
    source: 'X · @op7415',
    body: 'MCP 工作流实战：把本地文件系统接给大模型',
    summary: '可转化为微课案例',
    tags: ['#AI工作流', '#选题'],
    fav: 5,
    date: '9/28',
  },
  {
    id: 'm3',
    source: '网页 · 收藏',
    body: '闲鱼虚拟商品防封指南',
    summary: '敏感词清单进 SOP',
    tags: ['#闲鱼', '#运维'],
    fav: 3,
    date: '9/25',
  },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'getMaterials').mockResolvedValue(MATS.map((m) => ({ ...m })))
  // store 是模块级单例，逐用例复位
  mats.list = []
  mats.loaded = false
  mats.loading = false
  mats.error = ''
  ui.search = ''
  ui.view = 'library'
})

describe('LibraryView 素材库', () => {
  it('加载后渲染全部卡片与标签筛选 chips', async () => {
    const wrapper = mount(LibraryView)
    await flushPromises()

    expect(wrapper.findAll('.card')).toHaveLength(3)
    const chips = wrapper.findAll('#libFilters .chip')
    expect(chips.map((c) => c.text())).toEqual(['全部', '#带货', '#脚本', '#AI工作流', '#选题', '#闲鱼', '#运维'])
  })

  it('点「#带货」标签 → 只剩带货卡片；点回「全部」→ 恢复', async () => {
    const wrapper = mount(LibraryView)
    await flushPromises()

    const chips = wrapper.findAll('#libFilters .chip')
    await chips.find((c) => c.text() === '#带货')!.trigger('click')

    const cards = wrapper.findAll('.card')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('带货视频的黄金 3 秒')
    expect(wrapper.text()).not.toContain('闲鱼虚拟商品防封指南')

    await wrapper.findAll('#libFilters .chip').find((c) => c.text() === '全部')!.trigger('click')
    expect(wrapper.findAll('.card')).toHaveLength(3)
  })

  it('顶栏全局搜索词（ui.search）参与文本过滤', async () => {
    const wrapper = mount(LibraryView)
    await flushPromises()

    ui.search = '防封'
    await flushPromises()

    const cards = wrapper.findAll('.card')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('闲鱼虚拟商品防封指南')
    ui.search = ''
  })

  it('接口失败 → 显示错误态而非卡片', async () => {
    vi.spyOn(api, 'getMaterials').mockRejectedValue(new Error('后端未启动'))
    mats.loaded = false
    const wrapper = mount(LibraryView)
    await flushPromises()

    expect(wrapper.findAll('.card')).toHaveLength(0)
    expect(wrapper.text()).toContain('后端未启动')
  })

  it('编辑素材：清空原文链接并保存 → PATCH 携带空 url，链接可被清除', async () => {
    const wrapper = mount(LibraryView)
    await flushPromises()

    const patch = vi.spyOn(api, 'patchMaterial').mockResolvedValue({ ...MATS[0], url: '' })
    const editBtn = wrapper.findAll('.acts button').find((b) => b.text().includes('编辑'))!
    await editBtn.trigger('click')
    await flushPromises()

    const urlInput = wrapper.find('input[placeholder="https://…"]')
    expect((urlInput.element as HTMLInputElement).value).toBe('https://example.com/post/1')
    await urlInput.setValue('')
    await wrapper.find('.btns .mini-btn').trigger('click')
    await flushPromises()

    expect(patch).toHaveBeenCalledWith('m1', expect.objectContaining({ url: '' }))
  })
})
