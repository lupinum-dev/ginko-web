import type { Framework } from '../types/framework'
import { FileTypeDetector } from '../processor/services/FileTypeDetector'

let fileTypeDetector: FileTypeDetector | null = null

export function initializeFileTypeDetector(framework: Framework) {
  fileTypeDetector = new FileTypeDetector(framework)
}

export function useFileType() {
  if (!fileTypeDetector) {
    throw new Error('FileTypeDetector not initialized. Call initializeFileTypeDetector first.')
  }

  const detector = fileTypeDetector

  return {
    detectFileType: (path: string) => detector.detectFileType(path),
    isSameFileType: (path1: string, path2: string) => {
      const type1 = detector.detectFileType(path1)
      const type2 = detector.detectFileType(path2)
      return type1 === type2
    },
  }
}
