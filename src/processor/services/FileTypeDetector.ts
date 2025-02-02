import type { Framework } from '../../types/framework'
import { FrameworkService } from './FrameworkService'

export class FileTypeDetector {
  constructor(private framework: Framework) { }

  public detectFileType(path: string): string {
    const config = FrameworkService.getConfig(this.framework)
    const matchedType = config.fileTypes.find(type => type.check(path))
    return matchedType?.type || 'other'
  }
}
