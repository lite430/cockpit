// 今日日程：手动新增（POST /api/schedule，按时间插入）/ 删除（DELETE，失败回滚）
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { api } from '../api'
import type { SchedItem } from '../types'
import SchedPanel from './SchedPanel.vue'

const ITEMS: SchedItem[] = [
  { id: 's1', time: '09:00', title: '晨会', note: '' },
  { id: 's2', time: '19:00', title: '小红书图文发布', note: '选题篇' },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'getSchedule').mockResolvedValue(ITEMS.map((i) => ({ ...i })))
})

describe('SchedPanel 今日日程', () => {
  it('渲染日程时间线', async () => {
    const wrapper = mount(SchedPanel)
    await flushPromises()

    expect(wrapper.findAll('.sched')).toHaveLength(2)
    expect(wrapper.text()).toContain('晨会')
    expect(wrapper.text()).toContain('小红书图文发布')
  })

  it('新增日程：POST 成功后按时间插入列表并清空标题输入', async () => {
    const created: SchedItem = { id: 's3', time: '08:00', title: '早课', note: '' }
    const post = vi.spyOn(api, 'createSchedule').mockResolvedValue(created)
    const wrapper = mount(SchedPanel)
    await flushPromises()

    await wrapper.find('input[placeholder="19:00"]').setValue('08:00')
    await wrapper.find('input[placeholder^="新日程"]').setValue('早课')
    await wrapper.find('.mini-btn').trigger('click')
    await flushPromises()

    expect(post).toHaveBeenCalledWith({ time: '08:00', title: '早课' })
    expect(wrapper.findAll('.when').map((w) => w.text())).toEqual(['08:00', '09:00', '19:00'])
    expect(wrapper.find('input[placeholder^="新日程"]').element.value).toBe('')
  })

  it('标题为空点 ＋：不发请求', async () => {
    const post = vi.spyOn(api, 'createSchedule')
    const wrapper = mount(SchedPanel)
    await flushPromises()

    await wrapper.find('.mini-btn').trigger('click')
    await flushPromises()

    expect(post).not.toHaveBeenCalled()
  })

  it('删除日程：成功后从列表移除', async () => {
    const del = vi.spyOn(api, 'deleteSchedule').mockResolvedValue(undefined)
    const wrapper = mount(SchedPanel)
    await flushPromises()

    await wrapper.findAll('.sched-x')[0].trigger('click')
    await flushPromises()

    expect(del).toHaveBeenCalledWith('s1')
    expect(wrapper.text()).not.toContain('晨会')
  })

  it('删除失败：显示错误信息（内部回滚，重进不丢数据）', async () => {
    const del = vi.spyOn(api, 'deleteSchedule').mockRejectedValue(new Error('boom'))
    const wrapper = mount(SchedPanel)
    await flushPromises()

    await wrapper.findAll('.sched-x')[0].trigger('click')
    await flushPromises()

    expect(del).toHaveBeenCalledWith('s1')
    expect(wrapper.text()).toContain('boom')
  })
})
