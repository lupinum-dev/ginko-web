/**
 * Base fileBase class
 * Represents a file in the dependency graph
 */
export abstract class fileBase {
  /**
   * Creates a new fileBase instance
   * @param path - Absolute file path
   * @param relativePath - Path relative to the root directory
   * @param name - fileBase name
   */
  constructor(
    protected path: string,
    protected relativePath: string,
    protected name: string
  ) {}

  /**
   * Get the absolute file path
   * @returns The file's absolute path
   */
  getPath(): string {
    return this.path;
  }

  /**
   * Get the file name
   * @returns The file name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the path relative to the root directory
   * @returns The relative file path
   */
  getRelativePath(): string {
    return this.relativePath;
  }

  /**
   * Get the file type (class name)
   * @returns The file type
   */
  getType(): string {
    return this.constructor.name;
  }

  /**
   * Serialize the file to JSON
   * @returns A JSON representation of the file
   */
  toJSON(): Record<string, any> {
    return {
      type: this.getType(),
      path: this.path,
      name: this.name,
      relativePath: this.relativePath
    };
  }
}