<script setup lang="ts">
// 根组件：顶栏 + 两个视图（总览 / 素材库，v-show 保留各自状态）+ 底部状态栏
import TopBar from './components/TopBar.vue'
import StatusBar from './components/StatusBar.vue'
import OverviewView from './components/OverviewView.vue'
import LibraryView from './components/LibraryView.vue'
import { ui } from './store'
</script>

<template>
  <div class="app">
    <h1 class="sr-only">个人运营驾驶舱</h1>
    <TopBar />
    <main v-show="ui.view === 'overview'" class="view">
      <OverviewView />
    </main>
    <main v-show="ui.view === 'library'" class="view">
      <div class="view-lib-inner">
        <LibraryView />
      </div>
    </main>
    <StatusBar />
  </div>
</template>
