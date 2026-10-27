// 业务线 Tab：切换后数据卡 / 发布排期 / 待回评论重渲染为对应业务线数据
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { api } from '../api'
import type { Line } from '../types'
import OpsBoard from './OpsBoard.vue'

const LINES: Line[] = [
  {
    id: 'xhs',
    name: '小红书',
    sub: 'AI 微课 · 图文+直播',
    stats: { 粉丝: [1234, 5.2], 近7日曝光: [48200, 12.4] },
    spark: [1, 3, 2, 5, 4, 6],
    pubs: [{ id: 'p1', when: '今天 19:00', tt: '小红书图文排期A', st: '待发' }],
    cms: [{ id: 'c1', who: '@momo', txt: '求资料包', handled: false }],
  },
  {
    id: 'xy',
    name: '闲鱼',
    sub: 'AI 微课 · 虚拟商品',
    stats: { 在售宝贝: [8, -1.5], 本月成交: [19, 5] },
    spark: [2, 2, 4, 3],
    pubs: [{ id: 'p2', when: '今天', tt: '闲鱼上架排期B', st: '待办' }],
    cms: [],
  },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'getLines').mockResolvedValue(LINES.map((l) => ({ ...l })))
})

describe('OpsBoard 业务线 Tab', () => {
  it('初始渲染第一条业务线（xhs）的数据卡与排期', async () => {
    const wrapper = mount(OpsBoard)
    await flushPromises()

    const tabs = wrapper.findAll('.line-tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].classes()).toContain('active')
    expect(wrapper.text()).toContain('小红书图文排期A')
    expect(wrapper.text()).toContain('1,234') // 1234.toLocaleString()
    expect(wrapper.text()).toContain('48,200')
  })

  it('切到闲鱼 Tab → 重渲染为闲鱼的数据（排期/指标），xhs 的排期消失', async () => {
    const wrapper = mount(OpsBoard)
    await flushPromises()

    await wrapper.findAll('.line-tab')[1].trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.line-tab')[1].classes()).toContain('active')
    expect(wrapper.text()).toContain('闲鱼上架排期B')
    expect(wrapper.text()).toContain('在售宝贝')
    expect(wrapper.text()).toContain('8')
    expect(wrapper.text()).not.toContain('小红书图文排期A')
    // 闲鱼无待回评论 → 空态
    expect(wrapper.text()).toContain('没有待回评论')
  })

  it('改排期状态 → PATCH /api/lines/:lid/pubs/:pid', async () => {
    const patchPub = vi
      .spyOn(api, 'patchPub')
      .mockResolvedValue({ id: 'p1', when: '今天 19:00', tt: '小红书图文排期A', st: '已发' })
    const wrapper = mount(OpsBoard)
    await flushPromises()

    const sel = wrapper.find('select.st2')
    await sel.setValue('已发')
    await flushPromises()

    expect(patchPub).toHaveBeenCalledWith('xhs', 'p1', { st: '已发' })
    expect(wrapper.text()).toContain('小红书图文排期A')
  })

  it('点待回评论「回」→ AI 助手状态被预填为 reply + 该评论内容', async () => {
    const wrapper = mount(OpsBoard)
    await flushPromises()

    await wrapper.find('.reply-btn').trigger('click')
    const { aiDraft } = await import('../store')
    expect(aiDraft.line).toBe('xhs')
    expect(aiDraft.type).toBe('reply')
    expect(aiDraft.prompt).toContain('@momo')
    expect(aiDraft.prompt).toContain('求资料包')
  })

  it('勾掉待回评论 → PATCH handled', async () => {
    const patchCm = vi
      .spyOn(api, 'patchCm')
      .mockResolvedValue({ id: 'c1', who: '@momo', txt: '求资料包', handled: true })
    const wrapper = mount(OpsBoard)
    await flushPromises()

    await wrapper.find('.ok-btn').trigger('click')
    await flushPromises()

    expect(patchCm).toHaveBeenCalledWith('xhs', 'c1', { handled: true })
    expect(wrapper.find('.comment-item').classes()).toContain('handled')
  })
})
