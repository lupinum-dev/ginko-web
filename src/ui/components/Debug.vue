<script setup lang="ts">
import type { GinkoPlugin } from '../../types/GinkoPlugin'
import { computed, onMounted, ref } from 'vue'

interface StorageItem {
  key: string
  value: string
}

interface Toast {
  message: string
  type: 'success' | 'error'
}

const props = defineProps<{
  plugin: GinkoPlugin
}>()

const pluginSettings = computed(() => props.plugin.settings)

const ginkoStorageItems = ref<StorageItem[]>([])
const showDeleteModal = ref(false)
const itemToDelete = ref<StorageItem | null>(null)
const toast = ref<Toast | null>(null)

onMounted(() => {
  loadGinkoItems()
})

function loadGinkoItems() {
  const items: StorageItem[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.toLowerCase().includes('ginko')) {
      const value = localStorage.getItem(key) || ''
      items.push({ key, value })
    }
  }
  ginkoStorageItems.value = items
}

function formatValue(value: any) {
  try {
    // If value is already an object, stringify it directly
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2)
    }
    // If it's a string, try to parse it as JSON
    if (typeof value === 'string') {
      const parsed = JSON.parse(value)
      return JSON.stringify(parsed, null, 2)
    }
    // For other types, convert to string
    return String(value)
  }
  catch {
    // If JSON parsing fails, return as is
    return value
  }
}

function copyValue(item: StorageItem) {
  navigator.clipboard.writeText(item.value)
    .then(() => showToast('Copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy', 'error'))
}

function confirmDelete(item: StorageItem) {
  itemToDelete.value = item
  showDeleteModal.value = true
}

function deleteItem() {
  if (!itemToDelete.value)
    return

  try {
    localStorage.removeItem(itemToDelete.value.key)
    loadGinkoItems() // Refresh list
    showToast('Item deleted successfully', 'success')
  }
  catch (error) {
    showToast('Failed to delete item', 'error')
  }

  showDeleteModal.value = false
  itemToDelete.value = null
}

function showToast(message: string, type: 'success' | 'error') {
  toast.value = { message, type }
  setTimeout(() => {
    toast.value = null
  }, 3000)
}
</script>

<template>
  <div class="debug-container">
    <!-- Plugin Settings Section -->
    <div class="debug-section">
      <h3 class="section-title">
        Plugin Settings
      </h3>
      <div class="settings-container">
        <pre class="settings-value">{{ formatValue(pluginSettings) }}</pre>
      </div>
    </div>

    <!-- Local Storage Section -->
    <div class="debug-section">
      <h3 class="section-title">
        Local Storage Debug
      </h3>

      <div class="storage-items">
        <div v-for="item in ginkoStorageItems" :key="item.key" class="storage-item">
          <div class="item-header">
            <span class="item-key">{{ item.key }}</span>
            <div class="item-actions">
              <button
                class="action-button small"
                title="Copy value"
                @click="copyValue(item)"
              >
                Copy
              </button>
              <button
                class="action-button small warning"
                title="Delete item"
                @click="confirmDelete(item)"
              >
                Delete
              </button>
            </div>
          </div>
          <pre class="item-value">{{ formatValue(item.value) }}</pre>
        </div>

        <div v-if="ginkoStorageItems.length === 0" class="empty-cache-state">
          No Ginko items found in localStorage
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="showDeleteModal = false">
      <div class="modal-content" @click.stop>
        <h4>Confirm Delete</h4>
        <p>Are you sure you want to delete "{{ itemToDelete?.key }}"?</p>
        <p class="warning-text">
          This action cannot be undone.
        </p>
        <div class="modal-actions">
          <button
            class="action-button"
            @click="showDeleteModal = false"
          >
            Cancel
          </button>
          <button
            class="action-button warning"
            @click="deleteItem"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style>
.debug-container {
  padding: 1rem;
  height: calc(100% - 2rem); /* Account for padding */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-title {
  flex-shrink: 0; /* Prevent title from shrinking */
}

.debug-section {
  margin-bottom: 2rem;
}

.settings-container {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  overflow: hidden;
}

.settings-value {
  padding: 0.75rem;
  margin: 0;
  font-family: monospace;
  font-size: 0.875rem;
  overflow: auto;
  background: var(--background-primary);
  color: var(--text-normal);
  max-height: 300px;
}

.storage-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  flex: 1;
  padding-right: 0.5rem; /* Space for scrollbar */
}

.storage-item {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  overflow: hidden;
  min-height: 0; /* Allow item to shrink */
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--background-secondary);
  border-bottom: 1px solid var(--background-modifier-border);
  flex-shrink: 0; /* Prevent header from shrinking */
}

.item-key {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--text-normal);
}

.item-actions {
  display: flex;
  gap: 0.5rem;
}

.item-value {
  padding: 0.75rem;
  margin: 0;
  font-family: monospace;
  font-size: 0.875rem;
  overflow: auto;
  background: var(--background-primary);
  color: var(--text-normal);
  max-height: 300px; /* Limit height of individual value displays */
}

.action-button.small {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.empty-cache-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
  font-style: italic;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: 200px; /* Give some minimum height for better appearance */
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--background-primary);
  padding: 1.5rem;
  border-radius: 6px;
  min-width: 300px;
  max-width: 90%;
}

.modal-content h4 {
  margin: 0 0 1rem;
}

.warning-text {
  color: var(--text-error);
  font-size: 0.875rem;
  margin: 0.5rem 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

/* Toast Styles */
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.toast.success {
  background: var(--background-modifier-success);
  color: var(--text-success);
}

.toast.error {
  background: var(--background-modifier-error);
  color: var(--text-error);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 100%);
}

/* Scrollbar styling */
.storage-items::-webkit-scrollbar,
.item-value::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.storage-items::-webkit-scrollbar-track,
.item-value::-webkit-scrollbar-track {
  background: var(--background-secondary);
  border-radius: 4px;
}

.storage-items::-webkit-scrollbar-thumb,
.item-value::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 4px;
}

.storage-items::-webkit-scrollbar-thumb:hover,
.item-value::-webkit-scrollbar-thumb:hover {
  background: var(--background-modifier-border-hover);
}
</style>
