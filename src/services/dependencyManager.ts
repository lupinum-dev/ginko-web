import Graph from 'graphology';
import { File, NoteFile, AssetFile, MetaFile } from '../models';

// Define the interface for node attributes
interface NodeAttributes {
  type: string;
  label: string;
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
  private files: File[] = [];
  private edgeIdCounter: number = 0;

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
  setFiles(files: File[]): void {
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
      
      // Add each file as a node in the graph
      this.graph.addNode(file.getRelativePath(), {
        type: file.getType(),
        label: file.getName()
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
      if (file instanceof NoteFile) {
        const dependencies = file.getDependencies();
        
        // For each dependency, create an edge if the target exists
        dependencies.forEach(dep => {
          if (this.graph.hasNode(dep)) {
            const edgeId = `geid_${this.edgeIdCounter}_${this.graph.size}`;
            this.graph.addEdge(
              file.getRelativePath(), 
              dep, 
              {
                key: edgeId,
                type: 'depends_on'
              } as EdgeAttributes
            );
            this.edgeIdCounter++;
          }
        });
      }
    });
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
  getFiles(): File[] {
    return this.files;
  }
}