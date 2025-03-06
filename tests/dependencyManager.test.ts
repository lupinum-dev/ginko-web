import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyManager } from '../src/services/dependencyManager';
import { NoteFile, AssetFile, MetaFile } from '../src/models';
import path from 'path';

describe('DependencyManager', () => {
  let dependencyManager: DependencyManager;
  let files: any[];

  beforeEach(() => {
    dependencyManager = new DependencyManager();
    
    // Create mock files
    files = [
      // Notes
      new NoteFile(
        '/abs/path/Folder1/Note1.md',
        'Note1.md',
        '# Note 1\n\n![Image 1](./_assets/img1.png)\n![Image 2](./_assets/img2.png)',
        'Folder1/Note1.md'
      ),
      new NoteFile(
        '/abs/path/Folder1/Folder1-1/Note1-1.md',
        'Note1-1.md',
        '# Note 1-1\n\n![](/Folder1/_assets/img1.png)\n![](/Folder1/_assets/img2.png)\n![](/Folder2/Folder2-1/_assets/img1x.png)',
        'Folder1/Folder1-1/Note1-1.md'
      ),
      new NoteFile(
        '/abs/path/Folder2/Note2.md',
        'Note2.md',
        '# Note 2\n\n![](/Folder2/Folder2-1/_assets/img1x.png)\n![](/Folder2/Folder2-1/_assets/img2x.png)',
        'Folder2/Note2.md'
      ),
      new NoteFile(
        '/abs/path/Folder2/Folder2-1/Note2-1.md',
        'Note2-1.md',
        '# Note 2-1\n\n![](/Folder2/Folder2-1/_assets/img1x.png)',
        'Folder2/Folder2-1/Note2-1.md'
      ),
      
      // Meta files
      new MetaFile(
        '/abs/path/Folder1/_meta.md',
        '_meta.md',
        'Folder1/_meta.md'
      ),
      new MetaFile(
        '/abs/path/Folder2/Folder2-1/_meta.md',
        '_meta.md',
        'Folder2/Folder2-1/_meta.md'
      ),
      
      // Asset files
      new AssetFile(
        '/abs/path/Folder1/_assets/img1.png',
        'img1.png',
        'Folder1/_assets/img1.png'
      ),
      new AssetFile(
        '/abs/path/Folder1/_assets/img2.png',
        'img2.png',
        'Folder1/_assets/img2.png'
      ),
      new AssetFile(
        '/abs/path/Folder2/Folder2-1/_assets/img1x.png',
        'img1x.png',
        'Folder2/Folder2-1/_assets/img1x.png'
      ),
      new AssetFile(
        '/abs/path/Folder2/Folder2-1/_assets/img2x.png',
        'img2x.png',
        'Folder2/Folder2-1/_assets/img2x.png'
      )
    ];
    
    dependencyManager.setFiles(files);
  });

  it('should create nodes for all files without folders', () => {
    const graph = dependencyManager.buildGraph();
    
    // Check that all files are added as nodes
    expect(graph.order).toBe(10); // 10 nodes (4 notes, 2 meta files, 4 assets)
    
    // Check that nodes have correct types
    expect(graph.filterNodes((_node, attrs) => attrs.type === 'NoteFile').length).toBe(4);
    expect(graph.filterNodes((_node, attrs) => attrs.type === 'MetaFile').length).toBe(2);
    expect(graph.filterNodes((_node, attrs) => attrs.type === 'AssetFile').length).toBe(4);
  });

  it('should create edges for dependencies', () => {
    const graph = dependencyManager.buildGraph();
    
    // The example has 8 edges total
    expect(graph.size).toBe(8);
    
    // Check specific edges
    // Note1 -> img1.png and img2.png
    expect(graph.hasEdge('Folder1/Note1.md', 'Folder1/_assets/img1.png')).toBe(true);
    expect(graph.hasEdge('Folder1/Note1.md', 'Folder1/_assets/img2.png')).toBe(true);
    
    // Note1-1 -> multiple images
    expect(graph.hasEdge('Folder1/Folder1-1/Note1-1.md', 'Folder1/_assets/img1.png')).toBe(true);
    expect(graph.hasEdge('Folder1/Folder1-1/Note1-1.md', 'Folder1/_assets/img2.png')).toBe(true);
    expect(graph.hasEdge('Folder1/Folder1-1/Note1-1.md', 'Folder2/Folder2-1/_assets/img1x.png')).toBe(true);
    
    // Note2 -> img1x.png and img2x.png
    expect(graph.hasEdge('Folder2/Note2.md', 'Folder2/Folder2-1/_assets/img1x.png')).toBe(true);
    expect(graph.hasEdge('Folder2/Note2.md', 'Folder2/Folder2-1/_assets/img2x.png')).toBe(true);
    
    // Note2-1 -> img1x.png
    expect(graph.hasEdge('Folder2/Folder2-1/Note2-1.md', 'Folder2/Folder2-1/_assets/img1x.png')).toBe(true);
  });

  it('should export graph as JSON with expected format', () => {
    const graph = dependencyManager.buildGraph();
    const graphJson = dependencyManager.getGraphAsJson();
    
    // Check structure matches expected format
    expect(graphJson).toHaveProperty('options');
    expect(graphJson).toHaveProperty('attributes');
    expect(graphJson).toHaveProperty('nodes');
    expect(graphJson).toHaveProperty('edges');
    
    // Check options
    expect(graphJson.options).toEqual({
      type: 'mixed',
      multi: false,
      allowSelfLoops: false
    });
    
    // Check nodes length
    expect(graphJson.nodes.length).toBe(10);
    
    // Check node format (we need to grab the first node from the array)
    expect(graphJson.nodes.length).toBeGreaterThan(0);
    const sampleNode = graphJson.nodes[0];
    expect(sampleNode).toHaveProperty('key');
    expect(sampleNode).toHaveProperty('attributes');
    expect(sampleNode.attributes).toHaveProperty('type');
    expect(sampleNode.attributes).toHaveProperty('label');
    
    // Check edges length
    expect(graphJson.edges.length).toBe(8);
    
    // Check edge format (we need to grab the first edge from the array)
    expect(graphJson.edges.length).toBeGreaterThan(0);
    const sampleEdge = graphJson.edges[0];
    expect(sampleEdge).toHaveProperty('key');
    expect(sampleEdge).toHaveProperty('source');
    expect(sampleEdge).toHaveProperty('target');
    expect(sampleEdge).toHaveProperty('attributes');
    expect(sampleEdge.attributes).toHaveProperty('type');
    expect(sampleEdge.attributes.type).toBe('depends_on');
  });
});