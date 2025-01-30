

export type FileAction = 'modify' | 'create' | 'delete' | 'rename' | 'rebuild'

export type Task = {
  path: string
  action: FileAction
  fileType?: string
  timestamp: number
  oldPath?: string
}

export type BatchedTask = {
  action: FileAction
  fileType: string
  files: string[]
  timestamp: number
  oldPath?: string
} 