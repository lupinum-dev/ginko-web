import type { GitChange, GitCommit } from '../services/GitService'
import { ref } from 'vue'
import { GitService } from '../services/GitService'
import { useGinkoSettings } from './useGinkoSettings'

let gitService: GitService | null = null

export function useGit() {
  const { settings } = useGinkoSettings()

  if (!gitService && settings?.outputDirectoryPath) {
    gitService = new GitService(settings.outputDirectoryPath)
  }

  const currentBranch = ref('')
  const changes = ref<GitChange[]>([])
  const recentCommits = ref<GitCommit[]>([])
  const loading = ref(false)

  const refresh = async () => {
    if (!gitService) {
      throw new Error('Git service not initialized')
    }

    loading.value = true
    try {
      const [branchName, statusChanges, commits] = await Promise.all([
        gitService.getCurrentBranch(),
        gitService.getStatus(),
        gitService.getRecentCommits(),
      ])

      currentBranch.value = branchName
      changes.value = statusChanges
      recentCommits.value = commits
    }
    finally {
      loading.value = false
    }
  }

  const pull = async () => {
    if (!gitService)
      throw new Error('Git service not initialized')
    return gitService.pull()
  }

  const push = async () => {
    if (!gitService)
      throw new Error('Git service not initialized')
    return gitService.push()
  }

  const commit = async (message: string) => {
    if (!gitService)
      throw new Error('Git service not initialized')
    return gitService.commit(message)
  }

  return {
    currentBranch,
    changes,
    recentCommits,
    loading,
    refresh,
    pull,
    push,
    commit,
  }
}
