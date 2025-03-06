import Graph from 'graphology';
import { writeFile } from 'node:fs/promises';
import { File, NoteFile } from '../models';
import { FileReader } from './fileReader';
import { EdgeAttributes, FileAttributes } from '../utils';

/**
 * DependencyManager service
 * Manages the creation and manipulation of the dependency graph
 */
export class DependencyManager {
  private graph: Graph;
  private files: File[] = [];
  private rootFolder: string;
  private fileReader: FileReader;

  /**
   * Creates a new DependencyManager
   * @param rootFolder - The root folder to analyze
   */
  constructor(rootFolder: string) {
    this.rootFolder = rootFolder;
    this.fileReader = new FileReader();
    // Create a graph with mixed node/edge types, no multi-edges, no self-loops
    this.graph = new Graph({ allowSelfLoops: false });
  }

  /**
   * Process the directory and build the dependency graph
   */
  async processDirectory(): Promise<void> {
    try {
      // Read all files in the directory
      const filePaths = await this.fileReader.readDirectory(this.rootFolder);
      
      // Process files and create file objects
      this.files = await this.fileReader.processFiles(this.rootFolder, filePaths);
      
      // Build graph nodes and edges
      this.buildGraph();
      
      // Log statistics
      this.logGraphStatistics();
    } catch (error) {
      console.error('Error processing directory:', error);
    }
  }

  /**
   * Build the graph by creating nodes and edges
   */
  private buildGraph(): void {
    // First create all nodes
    this.createNodes();
    
    // Then create the edges between nodes
    this.createEdges();
  }

  /**
   * Create graph nodes for all files
   */
  private createNodes(): void {
    this.files.forEach(file => {
      // Add each file as a node in the graph
      this.graph.addNode(file.getRelativePath(), {
        type: file.getType(),
        label: file.getName()
      } as FileAttributes);
    });
  }

  /**
   * Create graph edges for dependencies
   */
  private createEdges(): void {
    // For each file, check if it's a note with dependencies
    this.files.forEach(file => {
      if (file instanceof NoteFile) {
        const dependencies = file.getDependencies();
        
        // For each dependency, create an edge if the target exists
        dependencies.forEach(dep => {
          if (this.graph.hasNode(dep)) {
            this.graph.addEdge(file.getRelativePath(), dep, {
              type: 'depends_on'
            } as EdgeAttributes);
          } else {
            console.warn(`Warning: Dependency not found - ${dep} referenced in ${file.getRelativePath()}`);
          }
        });
      }
    });
  }

  /**
   * Log graph statistics to the console
   */
  private logGraphStatistics(): void {
    console.log('Graph statistics:');
    console.log('Number of nodes:', this.graph.order);
    console.log('Number of edges:', this.graph.size);
    
    // Count nodes by type
    const nodeTypes = new Map<string, number>();
    this.graph.forEachNode((node, attributes) => {
      const type = attributes.type;
      nodeTypes.set(type, (nodeTypes.get(type) || 0) + 1);
    });
    
    console.log('Nodes by type:');
    nodeTypes.forEach((count, type) => {
      console.log(`- ${type}: ${count}`);
    });
  }

  /**
   * Save the graph to a JSON file
   * @param outputPath - Path to save the file
   */
  async saveGraphToFile(outputPath: string): Promise<void> {
    try {
      const graphData = this.graph.toJSON();
      await writeFile(outputPath, JSON.stringify(graphData, null, 2));
      console.log(`Graph saved to ${outputPath}`);
    } catch (error) {
      console.error('Error saving graph:', error);
    }
  }

  /**
   * Save the file instances to a JSON file
   * @param outputPath - Path to save the file
   */
  async saveFilesToFile(outputPath: string): Promise<void> {
    try {
      await writeFile(outputPath, JSON.stringify(this.files, null, 2));
      console.log(`Files saved to ${outputPath}`);
    } catch (error) {
      console.error('Error saving files:', error);
    }
  }

  /**
   * Get the graph instance
   * @returns The graph
   */
  getGraph(): Graph {
    return this.graph;
  }

  /**
   * Get all file instances
   * @returns Array of files
   */
  getFiles(): File[] {
    return this.files;
  }
}