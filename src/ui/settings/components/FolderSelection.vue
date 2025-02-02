<script setup lang="ts">
import type { App } from 'obsidian'
import type GinkoWebPlugin from '../../../main'
import { TFolder } from 'obsidian'
import { computed, onMounted, ref } from 'vue'
import FileTree from '../../components/FileTree.vue'

interface TreeItem {
  name: string
  path: string
  type: 'folder'
  children: TreeItem[]
}

interface PathLists {
  includedPaths: string[]
}

const props = defineProps<{
  app: App
  plugin: GinkoWebPlugin
  onUpdateInclusions?: (inclusions: { includedFolders: string }) => void
}>()

const fileTree = ref<TreeItem>({
  name: '/',
  path: '/',
  type: 'folder',
  children: [],
})

const selectedPaths = ref<Set<string>>(new Set())
const manualInclusions = ref<Set<string>>(new Set())
const inclusionInput = ref<HTMLInputElement>()

function handleInclusionAdd() {
  if (inclusionInput.value && inclusionInput.value.value) {
    addManualInclusion(inclusionInput.value.value)
    inclusionInput.value.value = ''
  }
}

// Initialize from settings
onMounted(() => {
  const vault = props.app.vault
  fileTree.value = buildFileTree(vault.getRoot())

  // Load existing inclusions
  const includedFolders = props.plugin.settings.inclusions?.includedFolders || ''
  const includedPaths = includedFolders
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0)

  manualInclusions.value = new Set(includedPaths)
  selectedPaths.value = new Set(includedPaths)

  // Ensure settings are saved after initialization
  if (includedPaths.length > 0) {
    saveChanges()
  }
})

// Helper function to collect all paths in the tree
function getAllPaths(item: TreeItem): string[] {
  const paths: string[] = [item.path]
  item.children.forEach((child) => {
    paths.push(...getAllPaths(child))
  })
  return paths
}

// Helper function to check if a path is a parent of another path
function isParentPath(parent: string, child: string) {
  if (parent === child)
    return false
  return child.startsWith(`${parent}/`)
}

// Compute included paths
const pathLists = computed<PathLists>(() => {
  const included: string[] = []
  const paths = Array.from(selectedPaths.value)

  // First, find the top-level included paths
  for (const path of paths) {
    let isTopLevel = true
    for (const otherPath of paths) {
      if (path !== otherPath && isParentPath(otherPath, path)) {
        isTopLevel = false
        break
      }
    }
    if (isTopLevel) {
      included.push(path)
    }
  }

  // Add manual inclusions
  manualInclusions.value.forEach((path) => {
    if (!included.includes(path)) {
      included.push(path)
    }
  })

  return {
    includedPaths: included,
  }
})

const includedPaths = computed(() => pathLists.value.includedPaths)

function buildFileTree(folder: TFolder): TreeItem {
  const children: TreeItem[] = []

  for (const child of folder.children) {
    if (child instanceof TFolder && !child.name.endsWith('+')) {
      children.push(buildFileTree(child))
    }
  }

  return {
    name: folder.name,
    path: folder.path,
    type: 'folder',
    children: children.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

function updateSelected(paths: Set<string>) {
  selectedPaths.value = paths
  saveChanges()
}

function addManualInclusion(path: string) {
  manualInclusions.value.add(path)
  selectedPaths.value.add(path)
  saveChanges()
}

function removeManualInclusion(path: string) {
  manualInclusions.value.delete(path)
  selectedPaths.value.delete(path)
  saveChanges()
}

function saveChanges() {
  console.warn('\n📝 Saving Settings Changes:')
  console.warn('Selected Paths:', Array.from(selectedPaths.value))
  console.warn('Manual Inclusions:', Array.from(manualInclusions.value))

  // Get computed paths
  const { includedPaths: computedIncluded } = pathLists.value
  console.warn('Computed Included Paths:', computedIncluded)

  // Save inclusions
  const inclusions = {
    includedFolders: computedIncluded.join(', '),
  }
  console.warn('Saving Inclusions:', inclusions)
  if (props.onUpdateInclusions) {
    props.onUpdateInclusions(inclusions)
  }

  // Update plugin settings directly
  props.plugin.settings.inclusions = inclusions

  // Save settings
  props.plugin.saveSettings()
  console.warn('✅ Settings saved successfully')
}
</script>

<template>
  <div class="folder-selection">
    <div class="folder-selection-header">
      <div class="folder-selection-title">
        <h4>Folder Selection</h4>
        <span class="folder-selection-description">Select folders to include in processing</span>
      </div>
    </div>

    <div v-if="includedPaths.length > 0" class="selection-summary">
      <div class="included-paths">
        <h4>Included Folders:</h4>
        <div class="folder-chips">
          <div v-for="path in includedPaths" :key="path" class="folder-chip included">
            <span class="folder-icon">+</span>
            {{ path }}
            <div class="remove-x" @click="removeManualInclusion(path)">
              ×
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="folder-selection-inputs">
      <div class="folder-selection-input">
        <div class="input-with-button">
          <input
            ref="inclusionInput" type="text" placeholder="Add folder to include..."
            @keydown.enter="handleInclusionAdd"
          >
          <div class="add-button" @click="handleInclusionAdd">
            +
          </div>
        </div>
      </div>
    </div>

    <div class="folder-tree-container">
      <FileTree :item="fileTree" :selected-paths="selectedPaths" @update:selected="updateSelected" />
    </div>
  </div>
</template>

<style>
.folder-selection {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.folder-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.folder-selection-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.folder-selection-title h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.folder-selection-description {
  color: var(--text-muted);
  font-size: 12px;
}

.selection-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--background-secondary);
  border-radius: 4px;
}

.included-paths {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.folder-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.folder-chip {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  gap: 4px;
}

.folder-chip.included {
  background-color: var(--background-modifier-success);
  color: var(--text-on-accent);
}

.folder-chip .folder-icon {
  font-weight: bold;
}

.folder-selection-inputs {
  display: flex;
  gap: 8px;
}

.folder-selection-input {
  flex: 1;
}

.folder-selection-input input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-normal);
}

.folder-selection-input input:focus {
  border-color: var(--interactive-accent);
  outline: none;
}

.folder-tree-container {
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.remove-x {
  cursor: pointer;
  margin-left: 4px;
}

.input-with-button {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-with-button input {
  flex: 1;
}

.add-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: var(--background-modifier-border);
  color: var(--text-muted);
  cursor: pointer;
  font-weight: bold;
  font-size: 16px;
}

.add-button:hover {
  background: var(--background-modifier-border-hover);
  color: var(--text-normal);
}
</style>
