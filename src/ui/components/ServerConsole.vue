<script setup lang="ts">
import type { GinkoPlugin } from '../../types/GinkoPlugin'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  plugin: GinkoPlugin
}>()

const isServerRunning = ref(false)
const logLines = ref<string[]>([])
const outputRef = ref<HTMLElement>()
const autoScroll = ref(true)
let unsubscribe: (() => void) | null = null

// Add initial server status check
onMounted(() => {
  if (props.plugin) {
    isServerRunning.value = props.plugin.devServer !== null

    // Get existing logs first
    logLines.value = props.plugin.getServerLogs().map((message) => {
      const timestamp = new Date().toLocaleTimeString()
      return `[${timestamp}] ${message.trim()}`
    })

    // Then setup subscription for new logs
    setupServerSubscription()

    // Scroll to bottom after loading history
    setTimeout(scrollToBottom, 0)
  }
})

function getLineClass(line: string) {
  if (line.includes('error') || line.includes('Error:'))
    return 'error-line'
  if (line.includes('warning') || line.includes('Warning:'))
    return 'warning-line'
  if (line.includes('success') || line.includes('Local:'))
    return 'success-line'
  return ''
}

function handleScroll() {
  if (!outputRef.value)
    return

  const { scrollTop, scrollHeight, clientHeight } = outputRef.value
  const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10
  autoScroll.value = isAtBottom
}

function scrollToBottom() {
  if (outputRef.value) {
    outputRef.value.scrollTop = outputRef.value.scrollHeight
    autoScroll.value = true
  }
}

function addLogLine(message: string) {
  const timestamp = new Date().toLocaleTimeString()
  logLines.value.push(`[${timestamp}] ${message.trim()}`)
  if (logLines.value.length > 1000) {
    logLines.value = logLines.value.slice(-1000)
  }
  if (autoScroll.value) {
    setTimeout(scrollToBottom, 0)
  }
}

async function copyLogs() {
  try {
    const text = logLines.value.join('\n')
    await navigator.clipboard.writeText(text)
    // Show temporary visual feedback instead
    const button = document.querySelector('.copy-button') as HTMLButtonElement
    if (button) {
      const originalText = button.textContent
      button.textContent = 'Copied!'
      button.classList.add('copied')
      setTimeout(() => {
        button.textContent = originalText
        button.classList.remove('copied')
      }, 2000)
    }
  }
  catch (error) {
    console.error('Copy failed:', error)
    // Show error in button instead
    const button = document.querySelector('.copy-button') as HTMLButtonElement
    if (button) {
      const originalText = button.textContent
      button.textContent = 'Copy failed'
      button.classList.add('copy-error')
      setTimeout(() => {
        button.textContent = originalText
        button.classList.remove('copy-error')
      }, 2000)
    }
  }
}

async function toggleServer() {
  if (!props.plugin) {
    addLogLine('Error: Plugin not available')
    return
  }

  try {
    if (isServerRunning.value) {
      addLogLine('Stopping server...')
      await props.plugin.stopDevServer()
      isServerRunning.value = false
      addLogLine('Server stopped')
    }
    else {
      addLogLine('Starting server...')
      await props.plugin.startDevServer()
      isServerRunning.value = true
      addLogLine('Server starting...')
    }
  }
  catch (error) {
    addLogLine(`Error: ${error.message}`)
    console.error('Server operation failed:', error)
  }
}

function setupServerSubscription() {
  if (!props.plugin) {
    addLogLine('Error: Plugin not available for log subscription')
    return
  }

  try {
    unsubscribe = props.plugin.subscribeToServerLogs((message: string) => {
      addLogLine(message)

      // Update server status based on messages
      if (message.includes('Dev server started')) {
        isServerRunning.value = true
      }
      else if (message.includes('Dev server stopped') || message.includes('Dev server exited')) {
        isServerRunning.value = false
      }
    })

    addLogLine('Log subscription established')
  }
  catch (error) {
    addLogLine(`Error setting up log subscription: ${error.message}`)
    console.error('Log subscription failed:', error)
  }
}

// Watch for plugin changes
watch(() => props.plugin, (newPlugin) => {
  if (newPlugin) {
    if (unsubscribe) {
      unsubscribe()
    }
    setupServerSubscription()
    isServerRunning.value = newPlugin.devServer !== null
  }
}, { immediate: true })

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
    addLogLine('Log subscription cleaned up')
  }
})
</script>

<template>
  <div class="server-console">
    <div class="console-header">
      <div class="console-title">
        Development Server
      </div>
      <div class="console-controls">
        <button
          class="console-button copy-button"
          title="Copy logs to clipboard"
          @click="copyLogs"
        >
          Copy Logs
        </button>
        <button
          class="console-button"
          :class="{ running: isServerRunning }"
          @click="toggleServer"
        >
          {{ isServerRunning ? 'Stop Server' : 'Start Server' }}
        </button>
      </div>
    </div>
    <div
      ref="outputRef"
      class="console-output"
      @scroll="handleScroll"
    >
      <div
        v-for="(line, index) in logLines"
        :key="index"
        class="console-line"
        :class="getLineClass(line)"
      >
        <span class="line-prefix">></span>
        {{ line }}
      </div>
    </div>
    <div
      v-if="!autoScroll"
      class="new-logs-indicator"
      @click="scrollToBottom"
    >
      New logs available ↓
    </div>
  </div>
</template>

<style>
.server-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 600px;
  background-color: #1e1e1e;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: #252526;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.console-controls {
  display: flex;
  gap: 0.5rem;
}

.console-title {
  font-weight: 600;
  color: #e0e0e0;
}

.console-button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid #444;
  background-color: #2d2d2d;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-button {
  background-color: #2d2d2d;
}

.copy-button:hover {
  background-color: #3d3d3d;
}

.console-button:hover {
  background-color: #3d3d3d;
}

.console-button.running {
  background-color: #c53030;
  color: white;
}

.console-output {
  flex: 1;
  padding: 1rem;
  background-color: #1e1e1e;
  overflow-y: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  color: #e0e0e0;
  max-height: calc(100% - 60px);
}

.console-line {
  padding: 0.125rem 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.line-prefix {
  color: #666;
  margin-right: 0.5rem;
}

.error-line {
  color: #ff6b6b;
}

.warning-line {
  color: #ffd93d;
}

.success-line {
  color: #4cd964;
}

.new-logs-indicator {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background-color: #2d2d2d;
  color: #e0e0e0;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  animation: fadeIn 0.3s ease;
  z-index: 10;
}

.new-logs-indicator:hover {
  background-color: #3d3d3d;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(-50%, 100%); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.copy-button.copied {
  border-color: var(--background-modifier-success);
  color: var(--text-success);
  border-color: var(--text-success);
}

.copy-button.copy-error {
  background-color: var(--background-modifier-error);
  color: var(--text-error);
  border-color: var(--text-error);
}
</style>
