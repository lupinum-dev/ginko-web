<template>
  <div class="file-graph-view">
    <FileGraph :files="processedFiles" />
    <div v-if="processedFiles.length === 0" class="loading-message">
      Loading files...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import FileGraph from './FileGraph.vue';

// Define props
interface Props {
  app: any;
}

const props = defineProps<Props>();

// Define file interface
interface FileData {
  name: string;
  path: string;
  extension: string;
  children: any;
  isFolder: boolean;
  size: string;
  mtime: string;
}

// Reactive state
const files = ref<FileData[]>([]);
const loading = ref(true);

// Safe getter function to prevent proxy issues
function safeGetProperty(obj, path, defaultValue = undefined) {
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

// Create a computed property that processes files safely
const processedFiles = computed(() => {
  try {
    // Create a safe copy of the files array with only the properties we need
    return files.value.map(file => ({
      name: safeGetProperty(file, 'name', ''),
      path: safeGetProperty(file, 'path', ''),
      extension: safeGetProperty(file, 'extension', ''),
      isFolder: safeGetProperty(file, 'isFolder', false),
      size: safeGetProperty(file, 'size', ''),
      mtime: safeGetProperty(file, 'mtime', ''),
      // Simple reference to children, but don't deeply process them
      children: safeGetProperty(file, 'children', null) ? [] : null
    }));
  } catch (error) {
    console.error('Error processing files:', error);
    return [];
  }
});

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
function loadFiles() {
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
    
    // Transform files to a format suitable for our component
    const processedFiles = [];
    
    // Add root node first
    processedFiles.push({
      name: 'Root',
      path: '/',
      extension: '',
      children: [],
      isFolder: true,
      size: '',
      mtime: ''
    });
    
    // Process all files from the vault
    for (const file of allFiles) {
      try {
        // Skip invalid files
        if (!file || typeof file !== 'object') continue;
        
        // Extract properties safely
        const fileData = {
          name: safeGetProperty(file, 'name', ''),
          path: safeGetProperty(file, 'path', ''),
          extension: safeGetProperty(file, 'extension', ''),
          children: safeGetProperty(file, 'children', null),
          isFolder: Boolean(safeGetProperty(file, 'children', null)),
          size: '',
          mtime: ''
        };
        
        // Skip files with empty paths
        if (!fileData.path) continue;
        
        // Add file size and modification time if available
        try {
          const stat = safeGetProperty(file, 'stat', null);
          if (stat) {
            fileData.size = formatFileSize(safeGetProperty(stat, 'size', 0));
            fileData.mtime = new Date(safeGetProperty(stat, 'mtime', 0)).toLocaleString();
          }
        } catch (statError) {
          console.warn('Could not process file stats:', statError);
        }
        
        processedFiles.push(fileData);
      } catch (fileError) {
        console.warn('Error processing file:', fileError);
        // Continue with next file
      }
    }
    
    // Update the reactive state
    files.value = processedFiles;
    
    console.log('Files processed:', files.value.length);
  } catch (error) {
    console.error('Error loading files:', error);
  } finally {
    loading.value = false;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (!bytes) return '';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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