import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyManager } from '../src/services/dependencyManager';
import { fileNote as NoteFile, fileAsset as AssetFile, fileMeta as MetaFile, fileBase } from '../src/models';
import * as path from 'path';

// Custom mock class to easily test different dependency scenarios
class MockNoteFile extends NoteFile {
  private mockAssetDeps: string[] = [];
  private mockMetaDeps: string[] = [];
  
  constructor(
    absPath: string,
    name: string,
    content: string,
    relativePath: string,
    assetDeps: string[] = [],
    metaDeps: string[] = []
  ) {
    super(absPath, name, content, relativePath);
    this.mockAssetDeps = assetDeps;
    this.mockMetaDeps = metaDeps;
  }
  
  getAssetDependencies(): string[] {
    return this.mockAssetDeps;
  }
  
  getMetaDependencies(): string[] {
    return this.mockMetaDeps;
  }
}

describe('DependencyManager', () => {
  let dependencyManager: DependencyManager;
  let files: fileBase[];

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
        '/abs/path/Folder2/_meta.md',
        '_meta.md',
        'Folder2/_meta.md'
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

  // Existing tests
  
  it('should create nodes for all files without folders', () => {
    const graph = dependencyManager.buildGraph();
    
    // Check that all files are added as nodes
    expect(graph.order).toBe(11); // 11 nodes (4 notes, 3 meta files, 4 assets)
    
    // Check that nodes have correct types
    expect(graph.filterNodes((_node, attrs) => attrs.type === 'fileNote').length).toBe(4);
    expect(graph.filterNodes((_node, attrs) => attrs.type === 'fileMeta').length).toBe(3);
    expect(graph.filterNodes((_node, attrs) => attrs.type === 'fileAsset').length).toBe(4);
  });

  it('should create edges for asset dependencies', () => {
    const graph = dependencyManager.buildGraph();
    
    // Check asset dependencies
    // Note1 -> img1.png and img2.png
    expect(graph.hasEdge('Folder1/Note1.md', 'Folder1/_assets/img1.png')).toBe(true);
    expect(graph.hasEdge('Folder1/Note1.md', 'Folder1/_assets/img2.png')).toBe(true);
    expect(graph.getEdgeAttribute('Folder1/Note1.md', 'Folder1/_assets/img1.png', 'type')).toBe('depends_on_asset');
    
    // Note1-1 -> multiple images
    expect(graph.hasEdge('Folder1/Folder1-1/Note1-1.md', 'Folder1/_assets/img1.png')).toBe(true);
    expect(graph.hasEdge('Folder1/Folder1-1/Note1-1.md', 'Folder1/_assets/img2.png')).toBe(true);
    expect(graph.hasEdge('Folder1/Folder1-1/Note1-1.md', 'Folder2/Folder2-1/_assets/img1x.png')).toBe(true);
    expect(graph.getEdgeAttribute('Folder1/Folder1-1/Note1-1.md', 'Folder1/_assets/img1.png', 'type')).toBe('depends_on_asset');
    
    // Note2 -> img1x.png and img2x.png
    expect(graph.hasEdge('Folder2/Note2.md', 'Folder2/Folder2-1/_assets/img1x.png')).toBe(true);
    expect(graph.hasEdge('Folder2/Note2.md', 'Folder2/Folder2-1/_assets/img2x.png')).toBe(true);
    expect(graph.getEdgeAttribute('Folder2/Note2.md', 'Folder2/Folder2-1/_assets/img1x.png', 'type')).toBe('depends_on_asset');
    
    // Note2-1 -> img1x.png
    expect(graph.hasEdge('Folder2/Folder2-1/Note2-1.md', 'Folder2/Folder2-1/_assets/img1x.png')).toBe(true);
    expect(graph.getEdgeAttribute('Folder2/Folder2-1/Note2-1.md', 'Folder2/Folder2-1/_assets/img1x.png', 'type')).toBe('depends_on_asset');
  });
  
  it('should create edges for meta file dependencies', () => {
    const graph = dependencyManager.buildGraph();
    
    // Check meta file dependencies
    // Note in Folder1 depends on Folder1/_meta.md
    expect(graph.hasEdge('Folder1/Note1.md', 'Folder1/_meta.md')).toBe(true);
    expect(graph.getEdgeAttribute('Folder1/Note1.md', 'Folder1/_meta.md', 'type')).toBe('depends_on_meta');
    
    // Note in Folder1/Folder1-1 depends on both Folder1/_meta.md (parent dir) and Folder1/Folder1-1/_meta.md (own dir) if it exists
    expect(graph.hasEdge('Folder1/Folder1-1/Note1-1.md', 'Folder1/_meta.md')).toBe(true);
    expect(graph.getEdgeAttribute('Folder1/Folder1-1/Note1-1.md', 'Folder1/_meta.md', 'type')).toBe('depends_on_meta');
    
    // Note in Folder2 depends on Folder2/_meta.md
    expect(graph.hasEdge('Folder2/Note2.md', 'Folder2/_meta.md')).toBe(true);
    expect(graph.getEdgeAttribute('Folder2/Note2.md', 'Folder2/_meta.md', 'type')).toBe('depends_on_meta');
    
    // Note in Folder2/Folder2-1 depends on both Folder2/_meta.md (parent dir) and Folder2/Folder2-1/_meta.md (own dir)
    expect(graph.hasEdge('Folder2/Folder2-1/Note2-1.md', 'Folder2/_meta.md')).toBe(true);
    expect(graph.hasEdge('Folder2/Folder2-1/Note2-1.md', 'Folder2/Folder2-1/_meta.md')).toBe(true);
    expect(graph.getEdgeAttribute('Folder2/Folder2-1/Note2-1.md', 'Folder2/_meta.md', 'type')).toBe('depends_on_meta');
    expect(graph.getEdgeAttribute('Folder2/Folder2-1/Note2-1.md', 'Folder2/Folder2-1/_meta.md', 'type')).toBe('depends_on_meta');
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
    expect(graphJson.nodes.length).toBe(11); // 4 notes, 3 meta files, 4 assets
    
    // Check node format
    expect(graphJson.nodes.length).toBeGreaterThan(0);
    const sampleNode = graphJson.nodes[0];
    expect(sampleNode).toHaveProperty('key');
    expect(sampleNode).toHaveProperty('attributes');
    expect(sampleNode.attributes).toHaveProperty('type');
    expect(sampleNode.attributes).toHaveProperty('label');
    
    // Check edges for both asset and meta dependencies
    expect(graphJson.edges.length).toBeGreaterThan(8); // We have added meta dependencies in addition to asset dependencies
    
    // Check edge format
    expect(graphJson.edges.length).toBeGreaterThan(0);
    
    // Check for both dependency types
    expect(graphJson.edges.some(edge => edge.attributes.type === 'depends_on_asset')).toBe(true);
    expect(graphJson.edges.some(edge => edge.attributes.type === 'depends_on_meta')).toBe(true);
  });
  
  it('should handle complex directory structures for meta dependencies correctly', () => {
    // Add a more complex file to test nested directory structure
    const complexNoteFile = new NoteFile(
      '/abs/path/Folder1/Folder1-1/Subfolder/DeepNote.md',
      'DeepNote.md',
      '# Deep Note\n\nSome content',
      'Folder1/Folder1-1/Subfolder/DeepNote.md'
    );
    
    const complexMetaFile = new MetaFile(
      '/abs/path/Folder1/Folder1-1/Subfolder/_meta.md',
      '_meta.md',
      'Folder1/Folder1-1/Subfolder/_meta.md'
    );
    
    dependencyManager.setFiles([...files, complexNoteFile, complexMetaFile]);
    const graph = dependencyManager.buildGraph();
    
    // A note in a deeply nested directory should depend on all _meta.md files in its path
    // DeepNote.md depends on:
    // 1. Folder1/Folder1-1/Subfolder/_meta.md (own directory)
    // 2. Folder1/Folder1-1/_meta.md (should be missing because we don't have this file)
    // 3. Folder1/_meta.md (parent directory)
    
    expect(graph.hasEdge('Folder1/Folder1-1/Subfolder/DeepNote.md', 'Folder1/Folder1-1/Subfolder/_meta.md')).toBe(true);
    expect(graph.hasEdge('Folder1/Folder1-1/Subfolder/DeepNote.md', 'Folder1/_meta.md')).toBe(true);
    
    // Ensure the types are correct
    expect(graph.getEdgeAttribute('Folder1/Folder1-1/Subfolder/DeepNote.md', 'Folder1/Folder1-1/Subfolder/_meta.md', 'type')).toBe('depends_on_meta');
    expect(graph.getEdgeAttribute('Folder1/Folder1-1/Subfolder/DeepNote.md', 'Folder1/_meta.md', 'type')).toBe('depends_on_meta');
  });

  // New unit tests
  describe('Basic Functionality', () => {
    it('should initialize with an empty graph', () => {
      const manager = new DependencyManager();
      expect(manager.getGraph().order).toBe(0); // No nodes
      expect(manager.getGraph().size).toBe(0);  // No edges
    });
    
    it('should set files correctly', () => {
      const manager = new DependencyManager();
      const mockFiles = [
        new NoteFile('/path/note.md', 'note.md', 'content', 'note.md')
      ];
      manager.setFiles(mockFiles);
      expect(manager.getFiles()).toEqual(mockFiles);
    });
    
    it('should handle empty file list', () => {
      const manager = new DependencyManager();
      manager.setFiles([]);
      const graph = manager.buildGraph();
      expect(graph.order).toBe(0);
      expect(graph.size).toBe(0);
    });
  });

  // Edge case tests
  describe('Edge Cases', () => {
    it('should handle files with no dependencies', () => {
      const manager = new DependencyManager();
      const mockNote = new MockNoteFile(
        '/path/note.md', 
        'note.md', 
        'Just text, no dependencies', 
        'note.md',
        [], // No asset dependencies 
        []  // No meta dependencies
      );
      
      manager.setFiles([mockNote]);
      const graph = manager.buildGraph();
      expect(graph.order).toBe(1); // 1 node
      expect(graph.size).toBe(0);  // 0 edges (no dependencies)
    });
    
    it('should handle files with special characters in paths', () => {
      const manager = new DependencyManager();
      
      const specialFiles = [
        new NoteFile('/path with spaces/note-with-dashes.md', 'note-with-dashes.md', 'content', 'path with spaces/note-with-dashes.md'),
        new NoteFile('/path/with/unicode/ファイル.md', 'ファイル.md', 'content', 'path/with/unicode/ファイル.md')
      ];
      
      manager.setFiles(specialFiles);
      const graph = manager.buildGraph();
      
      expect(graph.hasNode('path with spaces/note-with-dashes.md')).toBe(true);
      expect(graph.hasNode('path/with/unicode/ファイル.md')).toBe(true);
    });
    
    it('should handle non-existent dependencies gracefully', () => {
      const manager = new DependencyManager();
      
      // Create a note with dependencies to files that don't exist
      const mockNote = new MockNoteFile(
        '/path/note.md',
        'note.md',
        'content',
        'note.md',
        ['non-existent-asset.png'], // Asset dependency that doesn't exist
        ['non-existent-meta.md']    // Meta dependency that doesn't exist
      );
      
      manager.setFiles([mockNote]);
      const graph = manager.buildGraph();
      
      // The note node should exist but there should be no edges
      expect(graph.order).toBe(1);
      expect(graph.size).toBe(0);
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('should handle large file sets efficiently', () => {
      const largeFileSet = createLargeFileSet(100); // Generate 100 mock files
      const manager = new DependencyManager();
      
      const startTime = performance.now();
      manager.setFiles(largeFileSet);
      manager.buildGraph();
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Large file set processing time: ${duration}ms`);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  // Complex dependency tests
  describe('Complex Dependencies', () => {
    it('should detect orphaned assets', () => {
      const manager = new DependencyManager();
      
      const noteFile = new MockNoteFile(
        '/path/note.md',
        'note.md',
        'content',
        'note.md',
        ['assets/used.png'], // Only references one asset
        []
      );
      
      const assets = [
        new AssetFile('/path/assets/used.png', 'used.png', 'assets/used.png'),
        new AssetFile('/path/assets/orphaned.png', 'orphaned.png', 'assets/orphaned.png') // Not referenced
      ];
      
      manager.setFiles([noteFile, ...assets]);
      const graph = manager.buildGraph();
      
      // Verify the used asset has incoming edges but the orphaned one doesn't
      expect(graph.inDegree('assets/used.png')).toBe(1);
      expect(graph.inDegree('assets/orphaned.png')).toBe(0);
    });
    
    it('should handle deep nested dependencies', () => {
      // Test deep nesting - folder/subfolder/subsubfolder/note.md
      const manager = new DependencyManager();
      
      const files = [
        // Create a note in a deeply nested folder
        new NoteFile(
          '/path/A/B/C/D/deepnote.md',
          'deepnote.md',
          'content',
          'A/B/C/D/deepnote.md'
        ),
        
        // Create meta files at each level
        new MetaFile('/path/A/_meta.md', '_meta.md', 'A/_meta.md'),
        new MetaFile('/path/A/B/_meta.md', '_meta.md', 'A/B/_meta.md'),
        new MetaFile('/path/A/B/C/_meta.md', '_meta.md', 'A/B/C/_meta.md'),
        new MetaFile('/path/A/B/C/D/_meta.md', '_meta.md', 'A/B/C/D/_meta.md'),
        
        // Create assets
        new AssetFile(
          '/path/A/B/C/D/_assets/img.png',
          'img.png',
          'A/B/C/D/_assets/img.png'
        )
      ];
      
      // Make the note depend on all meta files and the asset
      const mockNote = new MockNoteFile(
        '/path/A/B/C/D/deepnote.md',
        'deepnote.md',
        'content',
        'A/B/C/D/deepnote.md',
        ['A/B/C/D/_assets/img.png'], // Asset dependency
        [                           // Meta dependencies
          'A/_meta.md',
          'A/B/_meta.md',
          'A/B/C/_meta.md',
          'A/B/C/D/_meta.md'
        ]
      );
      
      manager.setFiles([mockNote, ...files.slice(1)]); // Replace the first file with our mock
      const graph = manager.buildGraph();
      
      // Verify that the note depends on all meta files
      expect(graph.hasEdge('A/B/C/D/deepnote.md', 'A/_meta.md')).toBe(true);
      expect(graph.hasEdge('A/B/C/D/deepnote.md', 'A/B/_meta.md')).toBe(true);
      expect(graph.hasEdge('A/B/C/D/deepnote.md', 'A/B/C/_meta.md')).toBe(true);
      expect(graph.hasEdge('A/B/C/D/deepnote.md', 'A/B/C/D/_meta.md')).toBe(true);
      
      // Verify that the note depends on the asset
      expect(graph.hasEdge('A/B/C/D/deepnote.md', 'A/B/C/D/_assets/img.png')).toBe(true);
    });
  });

  // Helper functions
  function createLargeFileSet(count: number): fileBase[] {
    const files: fileBase[] = [];
    
    // Create folders
    const folderCount = Math.ceil(count / 10);
    
    for (let folder = 0; folder < folderCount; folder++) {
      // Add meta file for each folder
      files.push(new MetaFile(
        `/path/folder${folder}/_meta.md`,
        '_meta.md',
        `folder${folder}/_meta.md`
      ));
      
      // Add notes to each folder
      for (let note = 0; note < 10 && folder * 10 + note < count; note++) {
        const notePath = `folder${folder}/note${note}.md`;
        files.push(new NoteFile(
          `/path/${notePath}`,
          `note${note}.md`,
          `content ${folder}-${note}`,
          notePath
        ));
        
        // Add an asset for each note
        const assetPath = `folder${folder}/_assets/asset${note}.png`;
        files.push(new AssetFile(
          `/path/${assetPath}`,
          `asset${note}.png`,
          assetPath
        ));
      }
    }
    
    return files;
  }
});