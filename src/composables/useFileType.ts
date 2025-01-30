import { FileTypeDetector } from '../services/FileTypeDetector'
import { Framework } from '../types/framework'

let fileTypeDetector: FileTypeDetector | null = null

export const initializeFileTypeDetector = (framework: Framework) => {
  fileTypeDetector = new FileTypeDetector(framework)
}

export const useFileType = () => {
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
    }
  }
}
