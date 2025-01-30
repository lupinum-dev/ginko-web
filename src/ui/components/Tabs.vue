<template>
  <div class="tabs-container">
    <div class="tabs-list" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ 'tab-active': selectedTab === tab.id }"
        role="tab"
        tabindex="0"
        @click="selectTab(tab.id)"
        @keydown.enter="selectTab(tab.id)"
        @keydown.space="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-content">
      <slot :name="selectedTab"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Tab {
  id: string
  label: string
}

const props = defineProps<{
  tabs: Tab[]
  defaultTab?: string
}>()

const selectedTab = ref(props.defaultTab || props.tabs[0].id)

const selectTab = (tabId: string) => {
  selectedTab.value = tabId
}
</script>

<style>
.tabs-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tabs-list {
  display: flex;
  width: 100%;

  margin-bottom: 1rem;
  padding: 0 1px; /* Prevent border overflow */
  gap: 1px; /* Create subtle separation between tabs */
}

.tab {
  flex: 1;
  padding: 0.75rem 1.25rem;
  text-align: center;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-muted);
  background-color: var(--background-primary);
  transition: all 0.15s ease;
  user-select: none;
  position: relative;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.tab:hover {
  color: var(--text-normal);
  background-color: var(--background-modifier-hover);
}



.tab-active {
  color: var(--text-normal);
  background-color: var(--background-primary);
  font-weight: 600;
}



.tab-content {
  flex: 1;
  overflow: auto;
  padding: 0 1rem;
}

/* Add subtle animation for the active indicator */
.tab-active::after {
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from {
    transform: scaleX(0.7);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}
</style>
