import { spawn } from 'node:child_process'

export interface GitChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed'
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: Date
}

export class GitService {
  private cwd: string

  constructor(workingDirectory: string) {
    this.cwd = workingDirectory
    if (!this.isGitRepository()) {
      throw new Error('Not a git repository')
    }
  }

  private async isGitRepository(): Promise<boolean> {
    try {
      await this.execGit(['rev-parse', '--git-dir'])
      return true
    }
    catch {
      return false
    }
  }

  private async execGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('git', args, { cwd: this.cwd })
      let output = ''
      let errorOutput = ''

      process.stdout.on('data', (data) => {
        output += data.toString()
      })

      process.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim())
        }
        else {
          reject(new Error(errorOutput.trim() || `Git command failed with code ${code}`))
        }
      })
    })
  }

  async getCurrentBranch(): Promise<string> {
    return this.execGit(['rev-parse', '--abbrev-ref', 'HEAD'])
  }

  async getStatus(): Promise<GitChange[]> {
    const output = await this.execGit(['status', '--porcelain'])
    return output.split('\n')
      .filter(line => line.trim())
      .map((line) => {
        const status = line.substring(0, 2).trim()
        const path = line.substring(3)

        let changeStatus: GitChange['status'] = 'modified'
        if (status.includes('A'))
          changeStatus = 'added'
        else if (status.includes('D'))
          changeStatus = 'deleted'
        else if (status.includes('R'))
          changeStatus = 'renamed'

        return { path, status: changeStatus }
      })
  }

  async getRecentCommits(limit = 10): Promise<GitCommit[]> {
    const output = await this.execGit([
      'log',
      `-${limit}`,
      '--pretty=format:%H|%s|%an|%ai',
    ])

    return output.split('\n').map((line) => {
      const [hash, message, author, dateStr] = line.split('|')
      return {
        hash,
        message,
        author,
        date: new Date(dateStr),
      }
    })
  }

  async pull(): Promise<void> {
    await this.execGit(['pull'])
  }

  async push(): Promise<void> {
    await this.execGit(['push'])
  }

  async commit(message: string): Promise<void> {
    // First stage all changes
    await this.execGit(['add', '.'])
    // Then commit
    await this.execGit(['commit', '-m', message])
  }
}
