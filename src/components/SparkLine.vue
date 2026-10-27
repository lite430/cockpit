<script setup lang="ts">
// SVG 走势线（原型 sparkline 的组件化）
import { computed } from 'vue'

const props = defineProps<{ data: number[]; color: string }>()

const W = 150
const H = 30

const points = computed(() => {
  const d = props.data ?? []
  if (d.length < 2) return '' // 单点无法连线
  const max = Math.max(...d)
  const min = Math.min(...d)
  return d
    .map((v, i) => {
      const x = (i / (d.length - 1)) * W
      const y = H - 3 - ((v - min) / (max - min || 1)) * (H - 8)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <svg v-if="points" :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`" aria-hidden="true">
    <polyline
      :points="points"
      fill="none"
      :stroke="color"
      stroke-width="1.8"
      stroke-linecap="round"
      opacity=".9"
    />
  </svg>
</template>
