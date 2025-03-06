<template>
  <div class="file-graph-view">
    <FileGraph :graph-data="graphData" />
    <div v-if="loading" class="loading-message">
      Loading files...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, reactive } from 'vue';
import FileGraph from './FileGraph.vue';
import { DependencyManager } from '../services/dependencyManager';
import { File, NoteFile, AssetFile, MetaFile } from '../models';
import { App } from 'obsidian';

// Define props
interface Props {
  app: App;
}

const props = defineProps<Props>();

// Reactive state
const loading = ref(true);
const graphData = ref<any>(null);
const files = ref<File[]>([]);
const dependencyManager = new DependencyManager();

// Watch for app changes with safeguards
watch(() => props.app, (newApp) => {
  if (newApp) {
    console.log('App reference changed, reloading files');
    loadFiles();
  }
}, { immediate: true });

// Lifecycle hooks
onMounted(() => {
  console.log('FileGraphView mounted, app:', props.app ? 'available' : 'not available');
  if (props.app) {
    loadFiles();
  }
});

// Methods
async function loadFiles() {
  console.log('Loading files from Obsidian vault');
  loading.value = true;
  
  try {
    // Get all loaded files from Obsidian vault
    if (!props.app || !props.app.vault) {
      console.error('App or vault is not available');
      loading.value = false;
      return;
    }
    
    // Use a try-catch block to safely access the getAllLoadedFiles method
    let allFiles;
    try {
      allFiles = props.app.vault.getAllLoadedFiles();
    } catch (error) {
      console.error('Error getting files from vault:', error);
      loading.value = false;
      return;
    }
    
    if (!allFiles || !Array.isArray(allFiles)) {
      console.error('No valid files array received from vault');
      loading.value = false;
      return;
    }
    
    console.log('Raw files from vault:', allFiles.length);
    
    // Convert Obsidian files to our model classes
    files.value = await processObsidianFiles(allFiles);
    
    // Build the dependency graph
    dependencyManager.setFiles(files.value as File[]);
    dependencyManager.buildGraph();
    graphData.value = dependencyManager.getGraphAsJson();
    
    console.log('Graph data created:', 
      `nodes: ${graphData.value.nodes.length}`, 
      `edges: ${graphData.value.edges.length}`
    );
    
  } catch (error) {
    console.error('Error loading files:', error);
  } finally {
    loading.value = false;
  }
}

// Process Obsidian files into our model classes
async function processObsidianFiles(obsidianFiles: any[]): Promise<File[]> {
  const processedFiles: File[] = [];
  
  // Process each file from Obsidian
  for (const file of obsidianFiles) {
    try {
      // Skip invalid files
      if (!file || typeof file !== 'object') continue;
      
      // Safely extract properties
      const name = safeGetProperty(file, 'name', '');
      const filePath = safeGetProperty(file, 'path', '');
      const extension = safeGetProperty(file, 'extension', '');
      const children = safeGetProperty(file, 'children', null);
      
      // Skip files with empty paths or certain hidden files
      if (!filePath || filePath.startsWith('.')) continue;
      
      // Skip folders for the graph (we only want files)
      if (Boolean(children)) continue;
      
      // Get absolute path and other properties
      const absolutePath = filePath; // Use path as absolute path in this context
      
      // Process different file types
      if (filePath.endsWith('_meta.md')) {
        // Meta file
        processedFiles.push(new MetaFile(absolutePath, name, filePath));
      } else if (extension === 'md') {
        // Note file - fetch content for dependency extraction
        let content = '';
        try {
          content = await props.app.vault.cachedRead(file)
        } catch (readError) {
          console.warn(`Could not read file content for ${filePath}:`, readError);
        }
        
        processedFiles.push(new NoteFile(absolutePath, name, content, filePath));
      } else if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(extension.toLowerCase())) {
        // Asset file
        processedFiles.push(new AssetFile(absolutePath, name, filePath));
      }
      // Other file types can be processed here as needed
      
    } catch (fileError) {
      console.warn('Error processing file:', fileError);
      // Continue with next file
    }
  }
  
  console.log('Files processed:', processedFiles.length);
  return processedFiles;
}

// Safe getter function to prevent proxy issues
function safeGetProperty(obj: any, path: string, defaultValue: any = undefined) {
  if (!obj) return defaultValue;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    
    // Use a try-catch to handle potential proxy issues
    try {
      current = current[part];
    } catch (error) {
      console.error(`Error accessing property ${part}:`, error);
      return defaultValue;
    }
  }
  
  return current === undefined ? defaultValue : current;
}

</script>

<style scoped>
.file-graph-view {
  height: 100%;
  min-height: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: var(--background-primary);
}

.loading-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  color: var(--text-muted);
}
</style>