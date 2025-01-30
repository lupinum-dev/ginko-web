<script setup lang="ts">
import type { GinkoPlugin } from '../types/GinkoPlugin'
import Dashboard from './components/Dashboard.vue'
import Debug from './components/Debug.vue'
import ServerConsole from './components/ServerConsole.vue'
import Tabs from './components/Tabs.vue'
import Versioning from './components/Versioning.vue'

// Define props with required plugin
const props = defineProps<{
  plugin: GinkoPlugin
}>()

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'versioning', label: 'Versioning' },
  { id: 'server', label: 'Server' },
  { id: 'debug', label: 'Debug' },
]
</script>

<template>
  <div class="ginko-dashboard">
    <h2 class="ginko-dashboard-title">
      Ginko Dashboard
    </h2>

    <Tabs :tabs="tabs">
      <template #dashboard>
        <div class="tab-panel">
          <Dashboard :plugin="plugin" />
        </div>
      </template>

      <template #versioning>
        <Versioning :plugin="plugin" />
      </template>

      <template #server>
        <div class="tab-panel">
          <ServerConsole :plugin="plugin" />
        </div>
      </template>

      <template #debug>
        <div class="tab-panel">
          <Debug :plugin="plugin" />
        </div>
      </template>
    </Tabs>
  </div>
</template>

<style>
.ginko-dashboard {
  padding: 1rem;
  height: 100%;
}

.ginko-dashboard-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-normal);
}

.tab-panel {
  height: calc(100% - 80px);
}
</style>
