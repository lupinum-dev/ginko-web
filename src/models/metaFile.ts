import { File } from './file';

/**
 * MetaFile class
 * Represents metadata files for folders (typically _meta.md files)
 */
export class MetaFile extends File {
  /**
   * Creates a new MetaFile instance
   * @param path - Absolute file path
   * @param name - File name
   * @param relativePath - Path relative to the root directory
   */
  constructor(path: string, name: string, relativePath: string) {
    super(path, relativePath, name);
  }

  /**
   * Meta files have no dependencies by default
   * (Override this method if meta files should have dependencies)
   * @returns An empty array
   */
  getDependencies(): string[] {
    return [];
  }
}