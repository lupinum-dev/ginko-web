export type FileAction = 'modify' | 'create' | 'delete' | 'rename' | 'rebuild'

export interface Task {
  path: string
  action: FileAction
  fileType?: string
  timestamp: number
  oldPath?: string
}

export interface BatchedTask {
  action: FileAction
  fileType: string
  files: string[]
  timestamp: number
  oldPath?: string
}
