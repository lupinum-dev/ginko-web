<script setup lang="ts">
import type { App } from 'obsidian'
import type GinkoWebPlugin from '../../main'
import { TAbstractFile, TFile, TFolder } from 'obsidian'
import { computed, onMounted, ref } from 'vue'
import FolderTree from '../components/FolderTree.vue'

interface TreeItem {
  name: string
  path: string
  type: 'folder'
  children: TreeItem[]
}

interface PathLists {
  includedPaths: string[]
  excludedPaths: string[]
}

const props = defineProps<{
  app: App
  plugin: GinkoWebPlugin
}>()

const fileTree = ref<TreeItem>({
  name: '/',
  path: '/',
  type: 'folder',
  children: [],
})

const selectedPaths = ref<Set<string>>(new Set())

// Helper function to check if a path is a parent of another path
function isParentPath(parent: string, child: string) {
  if (parent === child)
    return false
  return child.startsWith(`${parent}/`)
}

// Compute included and excluded paths
const pathLists = computed<PathLists>(() => {
  const paths = Array.from(selectedPaths.value)
  if (paths.length === 0)
    return { includedPaths: [], excludedPaths: [] }

  // Sort paths to help identify patterns
  paths.sort()

  const included: string[] = []
  const excluded: string[] = []
  const allPaths = new Set<string>()

  // Helper function to collect all paths in the tree
  const collectPaths = (item: TreeItem) => {
    allPaths.add(item.path)
    item.children.forEach(collectPaths)
  }
  collectPaths(fileTree.value)

  // First, find the top-level included paths
  for (const path of paths) {
    let isTopLevel = true
    for (const otherPath of paths) {
      if (path !== otherPath && isParentPath(otherPath, path)) {
        isTopLevel = false
        break
      }
    }
    if (isTopLevel)
      included.push(path)
  }

  // Then find excluded paths (unselected paths within included paths)
  for (const path of allPaths) {
    // Skip if this path is directly selected
    if (selectedPaths.value.has(path))
      continue

    // Check if this path is within any included path but not selected
    for (const includedPath of included) {
      if (isParentPath(includedPath, path)) {
        // Only add to excluded if its parent is selected but it isn't
        const parentPath = path.split('/').slice(0, -1).join('/')
        if (selectedPaths.value.has(parentPath))
          excluded.push(path)
        break
      }
    }
  }

  return {
    includedPaths: included,
    excludedPaths: excluded,
  }
})

const includedPaths = computed(() => pathLists.value.includedPaths)
const excludedPaths = computed(() => pathLists.value.excludedPaths)

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
  console.log('\n🌳 Folder Tree Selection Update:')
  console.log('Selected paths:', Array.from(paths))

  selectedPaths.value = paths

  // Log the computed path lists after update
  console.log('\nComputed Path Lists:')
  console.log('Included:', pathLists.value.includedPaths)
  console.log('Excluded:', pathLists.value.excludedPaths)
}

async function saveSelection() {
  console.log('\n💾 Saving Selection:')
  console.log('Final included paths:', includedPaths.value)
  console.log('Final excluded paths:', excludedPaths.value)

  const selectedFolders = Array.from(selectedPaths.value)
  await props.plugin.saveSettings()

  console.log('Settings saved successfully')
}

onMounted(() => {
  const vault = props.app.vault
  fileTree.value = buildFileTree(vault.getRoot())
})
</script>

<template>
  <div class="publish-view">
    <div class="publish-header">
      <h3>Select Files to Publish</h3>
      <div class="publish-actions">
        <button class="mod-cta" @click="saveSelection">
          Save Selection
        </button>
      </div>
    </div>

    <div v-if="includedPaths.length > 0 || excludedPaths.length > 0" class="selection-summary">
      <div v-if="includedPaths.length > 0" class="included-paths">
        <h4>Included Folders:</h4>
        <div class="folder-chips">
          <div v-for="path in includedPaths" :key="path" class="folder-chip included">
            <span class="folder-icon">+</span>
            {{ path }}
          </div>
        </div>
      </div>

      <div v-if="excludedPaths.length > 0" class="excluded-paths">
        <h4>Excluded Folders:</h4>
        <div class="folder-chips">
          <div v-for="path in excludedPaths" :key="path" class="folder-chip excluded">
            <span class="folder-icon">-</span>
            {{ path }}
          </div>
        </div>
      </div>
    </div>

    <div class="publish-content">
      <FolderTree :item="fileTree" :selected-paths="selectedPaths" @update:selected="updateSelected" />
    </div>
  </div>
</template>

<style>
.publish-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 10px;
}

.publish-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.publish-header h3 {
  margin: 0;
}

.selection-summary {
  padding: 10px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.included-paths,
.excluded-paths {
  margin-bottom: 12px;
}

.included-paths:last-child,
.excluded-paths:last-child {
  margin-bottom: 0;
}

.selection-summary h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--text-muted);
}

.folder-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.folder-chip.excluded {
  background-color: var(--background-modifier-error);
  color: var(--text-on-accent);
}

.folder-chip .folder-icon {
  font-weight: bold;
}

.publish-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.publish-actions {
  display: flex;
  gap: 8px;
}
</style>
