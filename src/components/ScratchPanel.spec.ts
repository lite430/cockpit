// 速记：加载竞态——GET 返回前用户已输入时，用户内容不被服务端旧值覆盖，并在加载完成后立即补存
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { api } from '../api'
import ScratchPanel from './ScratchPanel.vue'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ScratchPanel 速记', () => {
  it('正常加载：显示服务端内容；用户未输入不触发保存', async () => {
    vi.spyOn(api, 'getScratch').mockResolvedValue({ text: '服务端旧内容' })
    const put = vi.spyOn(api, 'putScratch').mockResolvedValue({ text: '' })
    const wrapper = mount(ScratchPanel)
    await flushPromises()

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('服务端旧内容')
    expect(put).not.toHaveBeenCalled()
  })

  it('加载返回前用户已输入：用户内容优先，不被服务端旧值覆盖', async () => {
    let resolveGet: ((v: { text: string }) => void) | undefined
    vi.spyOn(api, 'getScratch').mockImplementation(
      () =>
        new Promise((res) => {
          resolveGet = res
        }),
    )
    const wrapper = mount(ScratchPanel)

    await wrapper.find('textarea').setValue('我的抢跑灵感')
    expect(resolveGet).toBeDefined()
    resolveGet?.({ text: '服务端旧内容' })
    await flushPromises()

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('我的抢跑灵感')
  })

  it('抢跑输入在加载完成后立即落盘（PUT 被调用，内容为用户输入）', async () => {
    let resolveGet: ((v: { text: string }) => void) | undefined
    vi.spyOn(api, 'getScratch').mockImplementation(
      () =>
        new Promise((res) => {
          resolveGet = res
        }),
    )
    const put = vi.spyOn(api, 'putScratch').mockResolvedValue({ text: '' })
    const wrapper = mount(ScratchPanel)

    await wrapper.find('textarea').setValue('抢跑内容')
    resolveGet?.({ text: '' })
    await flushPromises()

    expect(put).toHaveBeenCalledWith('抢跑内容')
  })
})
