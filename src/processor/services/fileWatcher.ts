import type { App, TAbstractFile } from 'obsidian'
import type GinkoWebPlugin from '../../main'
import { TFile } from 'obsidian'
import { useFileType } from '../../composables/useFileType'
import { useGinkoProcessor } from '../../composables/useGinkoProcessor'

export function setupFileWatcher(plugin: GinkoWebPlugin, app: App) {
  const ginkoProcessor = useGinkoProcessor()

  function getJobType(file: TAbstractFile) {
    if (file.name.endsWith('_meta.md')) {
      return 'meta'
    }
    if (file.name.endsWith('.md')) {
      return 'markdown'
    }
    if (file.path.includes('_assets/')) {
      return 'asset'
    }
    return 'unknown'
  }

  type Job = {
    name: string,
    type: 'meta' | 'markdown' | 'asset' | 'unknown',
    path: string,
    action: 'modify' | 'rename' | 'create' | 'delete',
    oldPath?: string,
    content?: string,
    timestamp: number
  }

  let jobs: Job[] = [];
  let jobBatches: Job[][] = [];
  let timeoutId: NodeJS.Timeout | null = null;
  let batchTimeoutId: NodeJS.Timeout | null = null;

  const processJobs = () => {
    if (jobs.length > 0) {
      // Add current jobs as a batch
      jobBatches.push([...jobs]);
      jobs = [];
      
      // Clear existing batch timeout if there is one
      if (batchTimeoutId) {
        clearTimeout(batchTimeoutId);
      }
      
      // Set a new timeout to process all batches after 5 seconds of inactivity
      batchTimeoutId = setTimeout(() => {
        if (jobBatches.length > 0) {
          console.log(JSON.stringify(jobBatches));
          jobBatches = [];
        }
      }, 5000);
    }
    timeoutId = null;
  };

  const addJob = async (job: Job) => {
    if (!job.name.includes('.')) {
      return;
    }
    
    // Add timestamp to the job
    job.timestamp = Date.now();
    
    // If it's a markdown file, add the content using cachedRead
    if (job.type === 'markdown' && job.action !== 'delete') {
      try {
        const file = app.vault.getAbstractFileByPath(job.path);
        if (file instanceof TFile) {
          job.content = await app.vault.cachedRead(file);
        }
      } catch (error) {
        console.error(`Error reading file content: ${error}`);
      }
    }
    
    jobs.push(job);
    
    // Clear existing timeout if there is one
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Set a new timeout to process jobs after a delay
    timeoutId = setTimeout(processJobs, 100);
  };


    plugin.registerEvent(
      app.vault.on('modify', async (file: TAbstractFile) => {
        if (file instanceof TFile) {
          // ginkoProcessor.addTask(file.path, 'modify')
          
          await addJob({
            name: file.name,
            path: file.path,
            type: getJobType(file),
            action: 'modify',
            timestamp: Date.now()
          });
        }
      }),
    )

    plugin.registerEvent(
      app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          const { isSameFileType } = useFileType()

          if (isSameFileType(file.path, oldPath)) {
            // If file types are the same, process as a regular rename
            // ginkoProcessor.addTask(file.path, 'rename', oldPath)
          }
          else {
            // If file types are different, process as a delete + create
            // ginkoProcessor.addTask(oldPath, 'delete')
            // ginkoProcessor.addTask(file.path, 'create')
          }
          
          await addJob({
            name: file.name,
            path: file.path,
            type: getJobType(file),
            action: 'rename',
            oldPath,
            timestamp: Date.now()
          });
        }
      }),
    )

    plugin.registerEvent(
      app.vault.on('create', async (file: TAbstractFile) => {
        if (file instanceof TFile) {
          // ginkoProcessor.addTask(file.path, 'create')
          
          await addJob({
            name: file.name,
            path: file.path,
            type: getJobType(file),
            action: 'create',
            timestamp: Date.now()
          });
        }
      }),
    )

    plugin.registerEvent(
      app.vault.on('delete', async (file: TAbstractFile) => {
        if (file instanceof TFile) {
          // ginkoProcessor.addTask(file.path, 'delete')
          
          await addJob({
            name: file.name,
            path: file.path,
            type: getJobType(file),
            action: 'delete',
            timestamp: Date.now()
          });
        }
      }),
    )

}
