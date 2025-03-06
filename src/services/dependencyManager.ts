import Graph from 'graphology';
import { fileBase, fileNote, fileAsset, fileMeta } from '../models';

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
  private files: fileBase[] = [];
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
      if (file instanceof fileNote) {
        // Process asset dependencies (images)
        const assetDependencies = file.getAssetDependencies();
        this.addEdgesToGraph(file.getRelativePath(), assetDependencies, 'depends_on_asset');
        
        // Process meta file dependencies (_meta.md files)
        const metaDependencies = file.getMetaDependencies();
        this.addEdgesToGraph(file.getRelativePath(), metaDependencies, 'depends_on_meta');
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
}