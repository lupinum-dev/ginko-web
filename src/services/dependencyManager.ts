import Graph from 'graphology';
import { fileBase, fileNote, fileAsset, fileMeta } from '../models';

// Define the interface for node attributes
interface NodeAttributes {
  type: string;
  label: string;
  copied?: boolean;
}

// Define the interface for edge attributes
interface EdgeAttributes {
  type: string;
}

/**
 * DependencyManager service
 * Manages the creation and manipulation of the dependency graph
 */
export class DependencyManager {
  private graph: Graph;
  private files: fileBase[] = [];
  private edgeIdCounter: number = 0;
  private copiedFiles: Set<string> = new Set();

  /**
   * Creates a new DependencyManager
   */
  constructor() {
    // Create a graph with mixed node/edge types, no multi-edges, no self-loops
    this.graph = new Graph({
      type: 'mixed',
      multi: false,
      allowSelfLoops: false
    });
  }

  /**
   * Set the files to be used for building the graph
   * @param files Array of File objects
   */
  setFiles(files: fileBase[]): void {
    this.files = files;
  }

  /**
   * Build the dependency graph
   * @returns The built graph
   */
  buildGraph(): Graph {
    // Clear existing graph and reset edge counter
    this.graph.clear();
    this.edgeIdCounter = 0;

    // First create all nodes
    this.createNodes();

    // Then create the edges between nodes
    this.createEdges();

    return this.graph;
  }

  /**
   * Create graph nodes for all files
   */
  private createNodes(): void {
    this.files.forEach(file => {
      // Skip folders - we only want to show individual files
      if (file.getRelativePath().endsWith('/')) {
        return;
      }

      const relativePath = file.getRelativePath();

      // Add each file as a node in the graph
      this.graph.addNode(relativePath, {
        type: file.getType(),
        label: file.getName(),
        copied: this.copiedFiles.has(relativePath)
      } as NodeAttributes);
    });
  }

  /**
   * Create graph edges for dependencies
   */
  private createEdges(): void {
    // Process each file to check for dependencies
    this.files.forEach(file => {
      // Only note files can have dependencies
      if (file instanceof fileNote) {
        // Process asset dependencies (images)
        const assetDependencies = file.getAssetDependencies();
        this.addEdgesToGraph(file.getRelativePath(), assetDependencies, 'depends_on_asset');

        // Process meta file dependencies (_meta.md files)
        const metaDependencies = file.getMetaDependencies();
        this.addEdgesToGraph(file.getRelativePath(), metaDependencies, 'depends_on_meta');

        // Process copy dependencies (if any)
        const copyDependencies = file.getCopyDependencies();
        if (copyDependencies.length > 0) {
          this.addEdgesToGraph(file.getRelativePath(), copyDependencies, 'copied_to');
        }
      }
    });
  }

  /**
   * Add edges to the graph for a given source, targets, and dependency type
   * @param source Source node key
   * @param targets Array of target node keys
   * @param dependencyType Type of dependency relationship
   */
  private addEdgesToGraph(source: string, targets: string[], dependencyType: string): void {
    targets.forEach(target => {
      if (this.graph.hasNode(target)) {
        const edgeId = `geid_${this.edgeIdCounter}_${this.graph.size}`;
        this.graph.addEdge(
          source,
          target,
          {
            key: edgeId,
            type: dependencyType
          } as EdgeAttributes
        );
        this.edgeIdCounter++;
      }
    });
  }

  /**
   * Mark a file as copied to the target directory
   * @param filePath Relative path of the file
   */
  markFileAsCopied(filePath: string): void {
    this.copiedFiles.add(filePath);

    // Update node attributes if the node exists
    if (this.graph.hasNode(filePath)) {
      this.graph.setNodeAttribute(filePath, 'copied', true);
    }
  }

  /**
   * Clear all copied file markers
   */
  clearCopiedFiles(): void {
    // Clear the set of copied files
    this.copiedFiles.clear();

    // Update node attributes
    this.graph.forEachNode((node) => {
      if (this.graph.hasNodeAttribute(node, 'copied')) {
        this.graph.setNodeAttribute(node, 'copied', false);
      }
    });
  }

  /**
   * Get all copied files
   * @returns Set of copied file paths
   */
  getCopiedFiles(): Set<string> {
    return new Set(this.copiedFiles);
  }

  /**
 * Add a target file and create a dependency from the source file
 * @param sourceFile The source file
 * @param targetPath The target file path
 */
  addTargetFile(sourceFile: fileBase, targetPath: string): void {
    const sourcePath = sourceFile.getRelativePath();
    
    // Create a unique key for the target node
    const fileName = this.getFileName(targetPath);
    const targetKey = `target:${targetPath}`;
    
    // Add the target node if it doesn't exist
    if (!this.graph.hasNode(targetKey)) {
      this.graph.addNode(targetKey, {
        type: 'targetFile',
        label: fileName,
        path: targetPath, // Store the full path for reference
        copied: true
      } as NodeAttributes);
      
      console.log(`Target node created: ${targetKey} for file ${fileName}`);
    }
    
    // Add an edge from the source to the target
    if (this.graph.hasNode(sourcePath)) {
      const edgeId = `geid_${this.edgeIdCounter}_${this.graph.size}`;
      this.graph.addEdge(
        sourcePath,
        targetKey,
        {
          key: edgeId,
          type: 'copied_to'
        } as EdgeAttributes
      );
      this.edgeIdCounter++;
      console.log(`Edge created from ${sourcePath} to ${targetKey}`);
    } else {
      console.warn(`Source node ${sourcePath} not found, cannot create edge`);
    }
  }

  /**
   * Extract the file name from a path
   * @param filePath The file path
   * @returns The file name
   * @private
   */
  private getFileName(filePath: string): string {
    // Split by forward and backward slashes
    const parts = filePath.split(/[\/\\]/);
    // Return the last part
    return parts[parts.length - 1];
  }

  /**
   * Check if a file has been copied
   * @param filePath Relative path of the file
   * @returns True if the file has been copied
   */
  isFileCopied(filePath: string): boolean {
    return this.copiedFiles.has(filePath);
  }

  /**
   * Get the graph
   * @returns The graph
   */
  getGraph(): Graph {
    return this.graph;
  }

  /**
   * Get the graph as JSON
   * @returns The graph as JSON
   */
  getGraphAsJson(): any {
    return this.graph.toJSON();
  }

  /**
   * Get all files
   * @returns Array of files
   */
  getFiles(): fileBase[] {
    return this.files;
  }

  /**
   * Get a file by its relative path
   * @param relativePath The relative path of the file
   * @returns The file object or null if not found
   */
  getFileByPath(relativePath: string): fileBase | null {
    return this.files.find(file => file.getRelativePath() === relativePath) || null;
  }
}