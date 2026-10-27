// 待办：勾选触发 PATCH /api/todos/:id 且 UI 出现划线（done 类）
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { api } from '../api'
import type { Todo } from '../types'
import TodoPanel from './TodoPanel.vue'

const TODOS: Todo[] = [
  { id: 't1', text: '回复小红书评论区 12 条待回', due: '今天', done: false, tag: 'xhs' },
  { id: 't2', text: '给微课学员群发本周作业提醒', due: '17:00', done: true, tag: 'xhs' },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'getTodos').mockResolvedValue(TODOS.map((t) => ({ ...t })))
})

describe('TodoPanel', () => {
  it('勾选未完成待办 → 调 PATCH {done:true}，条目加 done 类（划线）', async () => {
    const patchTodo = vi
      .spyOn(api, 'patchTodo')
      .mockResolvedValue({ ...TODOS[0], done: true })
    const wrapper = mount(TodoPanel)
    await flushPromises()

    const items = wrapper.findAll('.todo-item')
    expect(items).toHaveLength(2)
    const first = items[0]
    expect(first.classes()).not.toContain('done')

    await first.find('input[type=checkbox]').setValue(true)
    await flushPromises()

    expect(patchTodo).toHaveBeenCalledTimes(1)
    expect(patchTodo).toHaveBeenCalledWith('t1', { done: true })
    expect(first.classes()).toContain('done') // .todo-item.done .t { text-decoration: line-through }
  })

  it('再点一次取消勾选 → PATCH {done:false}，done 类移除', async () => {
    const patchTodo = vi
      .spyOn(api, 'patchTodo')
      .mockResolvedValue({ ...TODOS[0], done: false })
    const wrapper = mount(TodoPanel)
    await flushPromises()

    const first = wrapper.findAll('.todo-item')[0]
    await first.find('input[type=checkbox]').setValue(true)
    await first.find('input[type=checkbox]').setValue(false)
    await flushPromises()

    expect(patchTodo).toHaveBeenLastCalledWith('t1', { done: false })
    expect(first.classes()).not.toContain('done')
  })

  it('新增待办 → POST，成功后进列表', async () => {
    const created: Todo = { id: 't9', text: '闲鱼上架第 3 节', due: '今天', done: false, tag: 'xy' }
    const createTodo = vi.spyOn(api, 'createTodo').mockResolvedValue(created)
    const wrapper = mount(TodoPanel)
    await flushPromises()

    await wrapper.find('.input-line .txt').setValue('闲鱼上架第 3 节')
    await wrapper.find('.mini-btn').trigger('click')
    await flushPromises()

    expect(createTodo).toHaveBeenCalledWith({ text: '闲鱼上架第 3 节', due: '今天', tag: 'xhs' })
    expect(wrapper.findAll('.todo-item')).toHaveLength(3)
  })

  it('删除待办 → DELETE，列表移除', async () => {
    const deleteTodo = vi.spyOn(api, 'deleteTodo').mockResolvedValue(undefined)
    const wrapper = mount(TodoPanel)
    await flushPromises()

    await wrapper.findAll('.todo-item')[0].find('.icon-x').trigger('click')
    await flushPromises()

    expect(deleteTodo).toHaveBeenCalledWith('t1')
    expect(wrapper.findAll('.todo-item')).toHaveLength(1)
  })
})
