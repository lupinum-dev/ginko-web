<script setup lang="ts">
import { computed, ref } from 'vue'

interface TreeItem {
  name: string
  path: string
  type: 'folder'
  children: TreeItem[]
}

const props = defineProps<{
  item: TreeItem
  level?: number
  selectedPaths: Set<string>
}>()

const emit = defineEmits<{
  'update:selected': [paths: Set<string>]
}>()

const isExpanded = ref(true)
const level = computed(() => props.level || 0)

const isSelected = computed(() => {
  return props.selectedPaths.has(props.item.path)
})

function toggleExpanded() {
  if (props.item.type === 'folder') {
    isExpanded.value = !isExpanded.value
  }
}

function toggleSelect() {
  const newPaths = new Set(props.selectedPaths)

  if (isSelected.value) {
    // Deselect this item and all children
    const removePathsRecursively = (item: TreeItem) => {
      newPaths.delete(item.path)
      if (item.children) {
        item.children.forEach(removePathsRecursively)
      }
    }
    removePathsRecursively(props.item)
  }
  else {
    // Select this item and all children
    const addPathsRecursively = (item: TreeItem) => {
      newPaths.add(item.path)
      if (item.children) {
        item.children.forEach(addPathsRecursively)
      }
    }
    addPathsRecursively(props.item)
  }

  emit('update:selected', newPaths)
}
</script>

<template>
  <div class="file-tree">
    <div class="file-tree-item" :style="{ paddingLeft: `${level * 20}px` }">
      <div class="file-tree-item-header" @click="toggleExpanded">
        <input type="checkbox" :checked="isSelected" @change="toggleSelect" @click.stop>
        <span class="folder-icon" :class="{ expanded: isExpanded }">
          <svg viewBox="0 0 100 100" width="8" height="8">
            <polygon points="20,20 80,50 20,80" fill="currentColor" />
          </svg>
        </span>
        <span class="item-name">{{ item.name }}</span>
      </div>
    </div>
    <div v-if="isExpanded" class="file-tree-children">
      <file-tree v-for="child in item.children" :key="child.path" :item="child" :level="level + 1"
        :selected-paths="selectedPaths" @update:selected="$emit('update:selected', $event)" />
    </div>
  </div>
</template>

<style>
.file-tree {
  font-size: 14px;
}

.file-tree-item {
  display: flex;
  flex-direction: column;
}

.file-tree-item-header {
  display: flex;
  align-items: center;
  padding: 4px 0;
  cursor: pointer;
}

.file-tree-item-header:hover {
  background-color: var(--background-secondary);
}

.folder-icon {
  display: inline-flex;
  align-items: center;
  margin-right: 4px;
  transition: transform 0.15s ease;
}

.folder-icon.expanded {
  transform: rotate(90deg);
}

.item-name {
  margin-left: 4px;
}

.file-tree-children {
  margin-left: 4px;
}
</style>
