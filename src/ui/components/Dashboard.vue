<template>
  <Transition name="toast">
    <div v-if="error" class="error-toast">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <div class="error-text">{{ error }}</div>
        <button class="close-button" @click="error = null">×</button>
      </div>
    </div>
  </Transition>

  <div class="dashboard">
    <div class="dashboard-section">
      <h3 class="section-title">Server Status</h3>
      <div class="status-card">
        <div class="status-indicator" :class="serverStatusClass">
          {{ serverStatusText }}
        </div>
        <button 
          class="action-button"
          :class="{ 'warning': isServerRunning }"
          @click="toggleServer"
        >
          {{ isServerRunning ? 'Stop Server' : 'Start Server' }}
        </button>
      </div>
    </div>

    <div class="dashboard-section">
      <h3 class="section-title">Preview</h3>
      <div class="preview-card">
        <div v-if="isServerRunning && serverPort" class="preview-content">
          <span 
            class="preview-url" 
            @click="copyPreviewUrl"
            :title="'Click to copy: http://localhost:' + serverPort"
          >
            http://localhost:{{ serverPort }}
          </span>
          <button 
            class="action-button"
            @click="openPreview"
          >
            Open Preview
          </button>
        </div>
        <div v-else class="preview-placeholder">
          <span class="placeholder-text">Start server to enable preview</span>
          <button 
            class="action-button disabled"
            disabled
          >
            Preview Unavailable
          </button>
        </div>
      </div>
    </div>

    <div class="dashboard-section">
      <h3 class="section-title">Rebuild Actions</h3>
      <div class="actions-list">
        <div class="action-item">
          <button 
            class="action-button"
            :disabled="isRebuilding"
            @click="() => rebuildGinko('markdown')"
          >
            <span class="action-label">
              {{ isRebuilding === 'markdown' ? 'Rebuilding...' : 'Rebuild Markdown' }}
            </span>
            <span v-if="rebuildStatus?.type === 'markdown'" :class="['status-badge', rebuildStatus.status]">
              {{ rebuildStatus.message }}
            </span>
          </button>
          <div class="action-description">
            Rebuild only markdown files
          </div>
        </div>

        <div class="action-item">
          <button 
            class="action-button"
            :disabled="isRebuilding"
            @click="() => rebuildGinko('galleries')"
          >
            <span class="action-label">
              {{ isRebuilding === 'galleries' ? 'Rebuilding...' : 'Rebuild Galleries' }}
            </span>
            <span v-if="rebuildStatus?.type === 'galleries'" :class="['status-badge', rebuildStatus.status]">
              {{ rebuildStatus.message }}
            </span>
          </button>
          <div class="action-description">
            Rebuild gallery collections
          </div>
        </div>

        <div class="action-item">
          <button 
            class="action-button"
            :disabled="isRebuilding"
            @click="() => rebuildGinko('assets')"
          >
            <span class="action-label">
              {{ isRebuilding === 'assets' ? 'Rebuilding...' : 'Rebuild Assets' }}
            </span>
            <span v-if="rebuildStatus?.type === 'assets'" :class="['status-badge', rebuildStatus.status]">
              {{ rebuildStatus.message }}
            </span>
          </button>
          <div class="action-description">
            Rebuild static assets and images
          </div>
        </div>

        <div class="action-item">
          <button 
            class="action-button"
            :disabled="isRebuilding"
            @click="() => rebuildGinko('all')"
          >
            <span class="action-label">
              {{ isRebuilding === 'all' ? 'Rebuilding...' : 'Rebuild All' }}
            </span>
            <span v-if="rebuildStatus?.type === 'all'" :class="['status-badge', rebuildStatus.status]">
              {{ rebuildStatus.message }}
            </span>
          </button>
          <div class="action-description">
            Complete rebuild of all content
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-section">
      <h3 class="section-title">Cache</h3>
      <div class="actions-list">
        <div class="action-item">
          <button 
            class="action-button"
            :disabled="isCacheClearing"
            @click="clearCache"
          >
            <span class="action-label">{{ isCacheClearing ? 'Exporting...' : 'Export Cache' }}</span>
            <span v-if="cacheStatus" :class="['status-badge', cacheStatus.type]">
              {{ cacheStatus.message }}
            </span>
          </button>
          <div class="action-description">
            Export cache to disk for debugging
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { GinkoPlugin } from '../../types/GinkoPlugin'

const props = defineProps<{
  plugin: GinkoPlugin
}>()

const isServerRunning = ref(false)
const serverStatus = ref('stopped')
const serverPort = ref<number | null>(null)
let statusCheckInterval: NodeJS.Timeout

// Add error state
const error = ref<string | null>(null)

// Add status tracking
const isRebuilding = ref<RebuildType>(null)
const isCacheClearing = ref(false)
const rebuildStatus = ref<{
  type: RebuildType;
  status: 'success' | 'error';
  message: string;
} | null>(null)
const cacheStatus = ref<{ type: 'success' | 'error', message: string } | null>(null)

// Computed properties for status display
const serverStatusClass = computed(() => ({
  'status-running': serverStatus.value === 'running',
  'status-error': serverStatus.value === 'error',
  'status-stopping': serverStatus.value === 'stopping',
  'status-stopped': serverStatus.value === 'stopped'
}))

const serverStatusText = computed(() => {
  const statusMap: Record<string, string> = {
    running: 'Server Running',
    error: 'Server Error',
    stopping: 'Server Stopping...',
    stopped: 'Server Stopped'
  }
  return statusMap[serverStatus.value] || 'Unknown Status'
})

// Server control functions
const toggleServer = async () => {
  error.value = null
  try {
    if (!props.plugin) {
      throw new Error('Plugin not initialized')
    }
    
    if (isServerRunning.value) {
      serverStatus.value = 'stopping'
      await props.plugin.stopDevServer()
      isServerRunning.value = false
      serverStatus.value = 'stopped'
    } else {
      await props.plugin.startDevServer()
      isServerRunning.value = true
      serverStatus.value = 'running'
    }
  } catch (err) {
    console.error('Server operation failed:', err)
    error.value = err.message
    serverStatus.value = 'error'
  }
}

const checkServerStatus = () => {
  if (props.plugin) {
    const port = props.plugin.getServerPort()
    serverPort.value = port || null

    const devServer = props.plugin.devServer
    const wasRunning = isServerRunning.value
    isServerRunning.value = !!devServer && !devServer.killed
    
    // Handle state transitions
    if (wasRunning && !isServerRunning.value) {
      // Only show error if we're not in the stopping state
      if (serverStatus.value !== 'stopping') {
        serverStatus.value = 'error'
        error.value = 'Server stopped unexpectedly'
      }
    } else if (devServer?.killed) {
      serverStatus.value = 'error'
    } else if (devServer) {
      serverStatus.value = 'running'
    } else {
      serverStatus.value = 'stopped'
      serverPort.value = null // Clear port when server is stopped
    }
  }
}

const openPreview = () => {
  if (serverPort.value) {
    window.open(`http://localhost:${serverPort.value}`, '_blank')
  }
}

type RebuildType = 'markdown' | 'galleries' | 'assets' | 'all' | null;

const rebuildGinko = async (type: RebuildType) => {
  if (!type) return;
  
  error.value = null
  rebuildStatus.value = null
  isRebuilding.value = type
  
  try {
    if (!props.plugin) throw new Error('Plugin not initialized')
    
    switch (type) {
      case 'markdown':
        await props.plugin.rebuildMarkdown()
        break
      case 'galleries':
        await props.plugin.rebuildGalleries()
        break
      case 'assets':
        await props.plugin.rebuildAssets()
        break
      case 'all':
        await props.plugin.rebuild()
        break
    }
    
    rebuildStatus.value = { 
      type, 
      status: 'success', 
      message: 'Rebuilt successfully' 
    }
  } catch (err) {
    console.error(`${type} rebuild failed:`, err)
    error.value = err.message
    rebuildStatus.value = { 
      type, 
      status: 'error', 
      message: 'Rebuild failed' 
    }
  } finally {
    isRebuilding.value = null
  }
}

const clearCache = async () => {
  error.value = null
  cacheStatus.value = null
  isCacheClearing.value = true
  
  try {
    if (!props.plugin) throw new Error('Plugin not initialized')
    await props.plugin.clearCache()
    cacheStatus.value = { type: 'success', message: 'Cache exported' }
  } catch (err) {
    console.error('Cache export failed:', err)
    error.value = err.message
    cacheStatus.value = { type: 'error', message: 'Export failed' }
  } finally {
    isCacheClearing.value = false
  }
}

const copyPreviewUrl = async () => {
  if (serverPort.value) {
    try {
      const url = `http://localhost:${serverPort.value}`;
      await navigator.clipboard.writeText(url);
      // Optional: Show a brief success message
      const originalText = error.value;
      error.value = 'URL copied to clipboard';
      setTimeout(() => {
        error.value = originalText;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }
}

onMounted(() => {
  checkServerStatus()
  statusCheckInterval = setInterval(checkServerStatus, 2000)
})

onUnmounted(() => {
  clearInterval(statusCheckInterval)
})
</script>

<style>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 400px;
  margin: 0 auto;
}

.dashboard-section {
  background: var(--background-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-card, .preview-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-indicator {
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
}

.status-running {
  background: var(--background-modifier-success);
  color: var(--text-success);
}

.status-error {
  background: var(--background-modifier-error);
  color: var(--text-error);
}

.status-stopping {
  background: var(--background-modifier-warning);
  color: var(--text-warning);
}

.status-stopped {
  background: var(--background-modifier-border);
  color: var(--text-muted);
}

.preview-url {
  display: block;
  padding: 0.5rem;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--text-muted);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: all;
  position: relative;
}

.preview-url:hover {
  color: var(--text-normal);
  border-color: var(--background-modifier-border-hover);
  cursor: copy;
}

.preview-url:hover::after {
  content: 'Click to copy';
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-ui);
  background: var(--background-primary);
  padding-left: 0.5rem;
}

.preview-content {
  position: relative;
}

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.action-description {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 0 0.25rem;
}

.action-button {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-secondary);
  color: var(--text-normal);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-button:hover {
  background: var(--background-modifier-hover);
}

.action-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.action-button.warning {
  background: var(--background-modifier-error);
  color: white;
  border-color: transparent;
}

.action-button.warning:hover {
  background: var(--text-error);
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.status-badge.success {
  background: var(--background-modifier-success);
  color: var(--text-success);
}

.status-badge.error {
  background: var(--background-modifier-error);
  color: var(--text-error);
}

.error-message {
  display: none;
}

.error-toast {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  min-width: 300px;
  max-width: 90%;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--background-primary);
  border: 1px solid var(--text-error);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.error-icon {
  flex-shrink: 0;
  font-size: 1.25rem;
}

.error-text {
  flex: 1;
  color: var(--text-normal);
  font-size: 0.875rem;
  line-height: 1.4;
}

.close-button {
  flex-shrink: 0;
  padding: 0.25rem;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -100%);
}

.status-badge.error {
  background: var(--background-primary);
  color: var(--text-error);
  border: 1px solid var(--text-error);
}

.status-badge.success {
  background: var(--background-primary);
  color: var(--text-success);
  border: 1px solid var(--text-success);
}

.status-indicator.status-error {
  background: var(--background-primary);
  color: var(--text-error);
  border: 1px solid var(--text-error);
}

.status-indicator.status-running {
  background: var(--background-primary);
  color: var(--text-success);
  border: 1px solid var(--text-success);
}

.status-indicator.status-stopping {
  background: var(--background-primary);
  color: var(--text-warning);
  border: 1px solid var(--text-warning);
}

.status-indicator.status-stopped {
  background: var(--background-primary);
  color: var(--text-muted);
  border: 1px solid var(--text-muted);
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  opacity: 0.7;
}

.placeholder-text {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.action-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--background-modifier-border);
}
</style>