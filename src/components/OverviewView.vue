<script setup lang="ts">
// 总览：三列结构（左=待办/日程/速记，中=运营看板，右=AI 草稿助手）
import TodoPanel from './TodoPanel.vue'
import SchedPanel from './SchedPanel.vue'
import ScratchPanel from './ScratchPanel.vue'
import OpsBoard from './OpsBoard.vue'
import AiAssistant from './AiAssistant.vue'
</script>

<template>
  <div class="grid-overview">
    <section class="col col-todo">
      <TodoPanel />
      <SchedPanel />
      <ScratchPanel />
    </section>
    <section class="col col-ops">
      <OpsBoard />
    </section>
    <section class="col col-ai">
      <AiAssistant />
    </section>
  </div>
</template>
