// 明暗主题：localStorage 记忆，document.documentElement[data-theme] 驱动 CSS 变量
import { ref } from 'vue'

const KEY = 'cockpit-theme'
export type Theme = 'dark' | 'light'

function readStored(): Theme {
  try {
    const s = localStorage.getItem(KEY)
    if (s === 'dark' || s === 'light') return s
  } catch {
    /* localStorage 不可用时用默认值 */
  }
  return 'dark'
}

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* 忽略写入失败 */
  }
}

// 在 main.ts 挂载前调用，避免首屏闪烁
export function initTheme(): Theme {
  const t = readStored()
  apply(t)
  return t
}

export function useTheme() {
  const theme = ref<Theme>(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply(theme.value)
  }
  return { theme, toggle }
}
