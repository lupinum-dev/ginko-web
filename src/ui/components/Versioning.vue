<script lang="ts">
import type { GinkoPlugin } from '../../types/GinkoPlugin'
import * as path from 'node:path'
import { shell } from 'electron'
import { Notice } from 'obsidian'
import { computed, defineComponent, onMounted, ref } from 'vue'
import { useGit } from '../../composables/useGit'

interface GitChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed'
}

interface GitCommit {
  hash: string
  message: string
  author: string
  date: Date
}

export default defineComponent({
  name: 'Versioning',

  props: {
    plugin: {
      type: Object as () => GinkoPlugin,
      required: true,
    },
  },

  setup(props) {
    const {
      currentBranch,
      changes,
      recentCommits,
      loading: gitLoading,
      refresh: gitRefresh,
      pull: gitPull,
      push: gitPush,
      commit: gitCommit,
    } = useGit()

    const loading = ref(false)
    const pulling = ref(false)
    const pushing = ref(false)
    const committing = ref(false)
    const showCommitDialog = ref(false)
    const commitMessage = ref('')

    const hasChanges = computed(() => changes.value.length > 0)
    const gitDirectory = computed(() => {
      const dir = props.plugin.settings?.outputDirectoryPath
      return dir ? path.normalize(dir) : 'Not configured'
    })

    const hasValidDirectory = computed(() => {
      return !!props.plugin.settings?.outputDirectoryPath
    })

    // Determine the label based on the platform
    const explorerLabel = computed(() => {
      switch (process.platform) {
        case 'darwin':
          return 'Finder'
        case 'win32':
          return 'Explorer'
        default:
          return 'File Manager'
      }
    })

    const openInExplorer = async () => {
      try {
        if (!props.plugin.settings?.paths.websitePath) {
          throw new Error('Output directory not configured')
        }

        const dirPath = path.resolve(props.plugin.settings.paths.websitePath)
        await shell.openPath(dirPath)
      }
      catch (error) {
        new Notice(`Failed to open directory: ${error.message}`)
      }
    }

    const refresh = async () => {
      loading.value = true
      try {
        await gitRefresh()
      }
      catch (error) {
        new Notice(`Failed to refresh git status: ${error.message}`)
      }
      finally {
        loading.value = false
      }
    }

    const pull = async () => {
      pulling.value = true
      try {
        await gitPull()
        new Notice('Successfully pulled changes')
        await refresh()
      }
      catch (error) {
        new Notice(`Failed to pull changes: ${error.message}`)
      }
      finally {
        pulling.value = false
      }
    }

    const push = async () => {
      pushing.value = true
      try {
        await gitPush()
        new Notice('Successfully pushed changes')
        await refresh()
      }
      catch (error) {
        new Notice(`Failed to push changes: ${error.message}`)
      }
      finally {
        pushing.value = false
      }
    }

    const commit = () => {
      showCommitDialog.value = true
    }

    const confirmCommit = async () => {
      if (!commitMessage.value.trim())
        return

      committing.value = true
      try {
        await gitCommit(commitMessage.value)
        new Notice('Successfully committed changes')
        showCommitDialog.value = false
        commitMessage.value = ''
        await refresh()
      }
      catch (error) {
        new Notice(`Failed to commit changes: ${error.message}`)
      }
      finally {
        committing.value = false
      }
    }

    const cancelCommit = () => {
      showCommitDialog.value = false
      commitMessage.value = ''
    }

    const formatDate = (date: Date): string => {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    }

    onMounted(() => {
      refresh()
    })

    return {
      loading,
      pulling,
      pushing,
      committing,
      currentBranch,
      changes,
      recentCommits,
      showCommitDialog,
      commitMessage,
      hasChanges,
      gitDirectory,
      hasValidDirectory,
      explorerLabel,
      openInExplorer,
      refresh,
      pull,
      push,
      commit,
      confirmCommit,
      cancelCommit,
      formatDate,
    }
  },
})
</script>

<template>
  <div class="git-dashboard">
    <div class="git-status">
      <h3>Git Status</h3>
      <div class="git-directory">
        <div class="directory-info">
          <span class="label">Git Directory:</span>
          <span class="value">{{ gitDirectory }}</span>
        </div>
        <button v-if="hasValidDirectory" class="action-button" title="Open in File Explorer" @click="openInExplorer">
          Open in {{ explorerLabel }}
        </button>
      </div>
      <div v-if="loading" class="loading">
        Loading...
      </div>
      <div v-else class="status-info">
        <div class="branch">
          <span class="label">Current Branch:</span>
          <span class="value">{{ currentBranch }}</span>
        </div>
        <div v-if="changes.length" class="changes">
          <h4>Changes:</h4>
          <ul>
            <li v-for="change in changes" :key="change.path" :class="change.status">
              {{ change.path }} ({{ change.status }})
            </li>
          </ul>
        </div>
        <div v-else class="no-changes">
          No changes detected
        </div>
      </div>
    </div>

    <div class="git-actions">
      <button :disabled="loading || pulling" @click="pull">
        {{ pulling ? 'Pulling...' : 'Pull Changes' }}
      </button>
      <button :disabled="loading || pushing || !hasChanges" @click="push">
        {{ pushing ? 'Pushing...' : 'Push Changes' }}
      </button>
      <button :disabled="loading || committing || !hasChanges" @click="commit">
        {{ committing ? 'Committing...' : 'Commit Changes' }}
      </button>
      <button :disabled="loading" @click="refresh">
        Refresh Status
      </button>
    </div>

    <div v-if="showCommitDialog" class="commit-dialog">
      <textarea v-model="commitMessage" placeholder="Enter commit message..." rows="3" />
      <div class="dialog-actions">
        <button :disabled="!commitMessage.trim()" @click="confirmCommit">
          Confirm
        </button>
        <button @click="cancelCommit">
          Cancel
        </button>
      </div>
    </div>

    <div class="git-log">
      <h3>Recent Commits</h3>
      <ul v-if="recentCommits.length">
        <li v-for="commit in recentCommits" :key="commit.hash">
          <div class="commit-hash">
            {{ commit.hash.substring(0, 7) }}
          </div>
          <div class="commit-message">
            {{ commit.message }}
          </div>
          <div class="commit-author">
            {{ commit.author }}
          </div>
          <div class="commit-date">
            {{ formatDate(commit.date) }}
          </div>
        </li>
      </ul>
      <div v-else>
        No recent commits
      </div>
    </div>
  </div>
</template>

<style scoped>
.git-dashboard {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.git-status,
.git-actions,
.git-log {
  background: var(--background-secondary);
  padding: 1rem;
  border-radius: 8px;
}

.git-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.changes ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
}

.changes li {
  padding: 0.25rem 0;
}

.modified {
  color: var(--text-warning);
}

.added {
  color: var(--text-success);
}

.deleted {
  color: var(--text-error);
}

.renamed {
  color: var(--text-muted);
}

.commit-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--background-primary);
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 90%;
  max-width: 500px;
}

.commit-dialog textarea {
  width: 100%;
  margin-bottom: 1rem;
  padding: 0.5rem;
  border-radius: 4px;
}

.dialog-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.git-log ul {
  list-style: none;
  padding: 0;
}

.git-log li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.commit-hash {
  font-family: monospace;
  color: var(--text-muted);
}

.commit-date {
  font-size: 0.9em;
  color: var(--text-muted);
}

.git-directory {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  margin-bottom: 1rem;
}

.directory-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.directory-info .label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.directory-info .value {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--text-normal);
  word-break: break-all;
}

.action-button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  cursor: pointer;
  white-space: nowrap;
  margin-left: 1rem;
}

.action-button:hover {
  background: var(--interactive-accent-hover);
}
</style>
