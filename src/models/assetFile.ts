import { File } from './file';

/**
 * AssetFile class
 * Represents binary assets like images that can be referenced by notes
 */
export class AssetFile extends File {
  /**
   * Creates a new AssetFile instance
   * @param path - Absolute file path
   * @param name - File name
   * @param relativePath - Path relative to the root directory
   */
  constructor(path: string, name: string, relativePath: string) {
    super(path, relativePath, name);
  }

  /**
   * Assets have no dependencies by default
   * @returns An empty array
   */
  getDependencies(): string[] {
    return [];
  }
}