// 类型定义以 docs/api-contract.md 为准
// 注：契约中 stats 的 `[valeur,deltaPct]` 按 `[当前值, 环比%]` 处理（文档已标注疑为笔误）

export type Tag = 'xhs' | 'xy' | 'sph'

export interface Todo {
  id: string
  text: string
  due: string
  done: boolean
  tag: Tag
}

export interface SchedItem {
  id: string
  time: string // HH:MM
  title: string
  note: string
}

export interface Pub {
  id: string
  when: string
  tt: string
  st: string // 待发/已发/待办/待剪/选题/完成等自由文本
}

export interface Cm {
  id: string
  who: string
  txt: string
  handled: boolean
}

export interface Line {
  id: Tag
  name: string
  sub: string
  stats: Record<string, [number, number]> // 键为指标名，值为 [当前值, 环比%]
  spark: number[]
  pubs: Pub[]
  cms: Cm[]
}

export interface Mat {
  id: string
  source: string
  body: string
  summary: string
  tags: string[]
  fav: number // 1-5
  date: string
  url?: string
}

export interface Scratch {
  text: string
}

export type AiGenType = 'script' | 'copy' | 'reply'
