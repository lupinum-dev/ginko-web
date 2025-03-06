<template>
  <div class="file-graph-container">
    <div class="controls-panel">
      <div class="control-row">
        <div class="control-group search-group">
          <h3 class="group-title">Search</h3>
          <div class="search-container">
            <input 
              type="text" 
              v-model="searchTerm" 
              placeholder="Search files..." 
              class="search-input"
              @input="filterGraph"
            />
          </div>
        </div>

        <div class="control-group view-group">
          <h3 class="group-title">Graph Controls</h3>
          <div class="button-group">
            <button @click="zoomToFit" class="control-button">
              <span class="button-icon">⊕</span> Fit View
            </button>
            <button @click="resetSimulation" class="control-button">
              <span class="button-icon">↻</span> Reset
            </button>
            <button @click="refreshGraph" class="control-button">
              <span class="button-icon">⟳</span> Refresh
            </button>
          </div>
        </div>

        <div class="control-group target-group">
          <h3 class="group-title">Target Directory</h3>
          <div class="target-container">
            <input 
              type="text" 
              v-model="targetDirectory" 
              placeholder="Target directory..." 
              class="target-input"
            />
            <button @click="setTargetDirectory" class="control-button set-button">
              <span class="button-icon">✓</span> Set
            </button>
          </div>
        </div>

        <div class="control-group actions-group">
          <h3 class="group-title">File Actions</h3>
          <div class="button-group">
            <button @click="copySelectedFile" class="action-button copy-button" :disabled="!selectedNode">
              <span class="button-icon">⎘</span> Copy Selected
            </button>
            <button @click="copyAllFiles" class="action-button copy-all-button">
              <span class="button-icon">⎗</span> Copy All
            </button>
            <button @click="resetCopiedFiles" class="action-button reset-button">
              <span class="button-icon">⟲</span> Reset Copied
            </button>
          </div>
        </div>
      </div>

      <div class="file-info" v-if="selectedNode">
        <div class="file-info-header">
          <h3 class="group-title">Selected File</h3>
        </div>
        <div class="selected-file">
          <div class="file-meta">
            <div class="file-title">{{ selectedNode.name }}</div>
            <div class="file-path">{{ selectedNode.path }}</div>
          </div>
          <div class="file-type">Type: {{ selectedNode.type }}</div>
          <div class="file-status" v-if="selectedNode.copied">Status: Copied</div>
        </div>
      </div>
    </div>

    <div class="graph-container">
      <div ref="graphContainer" class="graph"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, defineEmits } from 'vue';
import * as d3 from 'd3';
import { FileService } from '../services/fileService';
import { DependencyManager } from '../services/dependencyManager';

// Define props for graph data and manager
interface Props {
  graphData?: {
    options: {
      type: string;
      multi: boolean;
      allowSelfLoops: boolean;
    };
    attributes: Record<string, any>;
    nodes: Array<{
      key: string;
      attributes: {
        type: string;
        label: string;
        copied?: boolean;
      };
    }>;
    edges: Array<{
      key: string;
      source: string;
      target: string;
      attributes: {
        type: string;
      };
    }>;
  };
  dependencyManager?: DependencyManager;
}

const props = defineProps<Props>();
const emits = defineEmits<{
  (e: 'refresh'): void;
  (e: 'file-copied', path: string): void;
  (e: 'copy-completed'): void;
}>();

// Reactive state
const searchTerm = ref('');
const targetDirectory = ref('/Users/matthias/Git/2025/ginko-web/target');
const graphContainer = ref<HTMLElement | null>(null);
const width = ref(800);
const height = ref(600);
const nodes = ref<any[]>([]);
const links = ref<any[]>([]);
const simulation = ref<any>(null);
const svg = ref<any>(null);
const zoom = ref<any>(null);
const nodeElements = ref<any>(null);
const linkElements = ref<any>(null);
const selectedNode = ref<any>(null);

// Services
const fileService = new FileService(targetDirectory.value);

// Watch for changes in graph data
watch(() => props.graphData, (newGraphData) => {
  if (!newGraphData) {
    console.log('No valid graph data received');
    return;
  }
  
  console.log('Graph data changed:', 
    `nodes: ${newGraphData.nodes.length}`, 
    `edges: ${newGraphData.edges.length}`
  );
  
  buildGraphData(newGraphData);
  if (svg.value) {
    updateGraph();
  }
}, { deep: true, immediate: true });

// Lifecycle hooks
onMounted(async () => {
  console.log('Component mounted, waiting for DOM update');
  await nextTick();
  
  if (graphContainer.value) {
    console.log('Graph container found:', graphContainer.value);
    console.log('Container dimensions:', graphContainer.value.clientWidth, 'x', graphContainer.value.clientHeight);
    initGraph();
    if (props.graphData) {
      buildGraphData(props.graphData);
    }
    updateGraph();
  } else {
    console.error('Graph container not found!');
  }
  
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  if (simulation.value) {
    simulation.value.stop();
  }
});

// Methods
function initGraph() {
  if (!graphContainer.value) {
    console.error('Cannot initialize graph: graphContainer is null');
    return;
  }
  
  console.log('Initializing graph, container size:', graphContainer.value.clientWidth, graphContainer.value.clientHeight);
  
  width.value = graphContainer.value.clientWidth || 800;
  height.value = graphContainer.value.clientHeight || 600;
  
  // Create SVG
  svg.value = d3.select(graphContainer.value)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [0, 0, width.value, height.value]);
  
  console.log('SVG created');
  
  // Add zoom behavior
  zoom.value = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      svg.value?.select('g').attr('transform', event.transform);
    });
  
  svg.value.call(zoom.value);
  
  // Create a group for all elements
  const g = svg.value.append('g');
  
  // Create links group
  linkElements.value = g.append('g')
    .attr('class', 'links')
    .selectAll('line');
  
  // Create nodes group
  nodeElements.value = g.append('g')
    .attr('class', 'nodes')
    .selectAll('circle');
    
  console.log('Graph structure initialized');
}

function buildGraphData(graphData) {
  try {
    // Clear existing data
    nodes.value = [];
    links.value = [];
    
    if (!graphData || !graphData.nodes || !graphData.edges) {
      console.error('Invalid graph data', graphData);
      return;
    }
    
    console.log('Building graph from data:', 
      `nodes: ${graphData.nodes.length}`, 
      `edges: ${graphData.edges.length}`
    );
    
    // Process nodes
    nodes.value = graphData.nodes.map(node => ({
      id: node.key,
      key: node.key,
      name: node.attributes.label,
      type: node.attributes.type,
      path: node.key, // Use key as path
      copied: node.attributes.copied || false,
      x: Math.random() * width.value,
      y: Math.random() * height.value
    }));
    
    // Process edges
    links.value = graphData.edges.map(edge => ({
      id: edge.key,
      key: edge.key,
      source: edge.source,
      target: edge.target,
      type: edge.attributes.type
    }));
    
    console.log('Graph data built with nodes:', nodes.value.length, 'links:', links.value.length);
  } catch (error) {
    console.error('Error in buildGraphData:', error);
  }
}

function updateGraph() {
  if (!svg.value || !nodeElements.value || !linkElements.value) {
    console.error('Cannot update graph: svg, nodeElements, or linkElements is null');
    return;
  }
  
  console.log('Updating graph with nodes:', nodes.value.length, 'links:', links.value.length);
  
  // Log target nodes specifically
  const targetNodes = nodes.value.filter(node => node.id && String(node.id).startsWith('target:'));
  console.log(`Target nodes to render: ${targetNodes.length}`, targetNodes);
  
  try {
    // Make a deep copy of nodes and links to avoid proxy issues
    const safeNodes = nodes.value.map(node => ({...node}));
    const safeLinks = links.value.map(link => ({...link}));
    
    // Create simulation with explicit id accessor function
    simulation.value = d3.forceSimulation(safeNodes)
      .force('link', d3.forceLink(safeLinks)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width.value / 2, height.value / 2))
      .force('collision', d3.forceCollide().radius(30))
      .on('tick', ticked);
    
    console.log('Simulation created');
    
    // Update links
    linkElements.value = linkElements.value
      .data(safeLinks, d => d.id)
      .join('line')
      .attr('class', d => `link ${d.type}`)
      .attr('stroke', d => d.type === 'depends_on' ? '#ff6b6b' : 'var(--text-muted)')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5);
    
    console.log('Links updated');
    
    // Update nodes
    nodeElements.value = nodeElements.value
      .data(safeNodes, d => d.id)
      .join(
        enter => {
          console.log('Creating new nodes:', enter.size());
          const nodeGroup = enter.append('g')
            .attr('class', d => {
              let classes = `node ${d.type}`;
              if (d.id && String(d.id).startsWith('target:')) {
                classes += ' target-node';
                console.log(`Created target node with class: ${classes}`);
              }
              return classes;
            })
            .call(drag())
            .on('click', (event, d) => handleNodeClick(event, d))
            .on('mouseover', (event, d) => handleNodeMouseOver(event, d))
            .on('mouseout', () => handleNodeMouseOut());
          
          // Add circle for node
          nodeGroup.append('circle')
            .attr('r', d => getNodeRadius(d))
            .attr('fill', d => getNodeColor(d))
            .attr('stroke', d => d.id && String(d.id).startsWith('target:') ? '#7950f2' : 'var(--background-primary)')
            .attr('stroke-width', d => d.id && String(d.id).startsWith('target:') ? 2.5 : 1.5)
            .attr('stroke-dasharray', d => d.id && String(d.id).startsWith('target:') ? '3,3' : null)
            .classed('copied', d => d.copied === true);
          
          // Add text label
          nodeGroup.append('text')
            .attr('dy', 20)
            .attr('text-anchor', 'middle')
            .text(d => truncateText(d.name, 20))
            .attr('fill', 'var(--text-normal)')
            .attr('font-size', '10px');
          
          return nodeGroup;
        },
        update => {
          console.log('Updating existing nodes:', update.size());
          
          // Update the node classes
          update.attr('class', d => {
            let classes = `node ${d.type}`;
            if (d.id && String(d.id).startsWith('target:')) {
              classes += ' target-node';
            }
            return classes;
          });
          
          // Update circle attributes
          update.select('circle')
            .attr('r', d => getNodeRadius(d))
            .attr('fill', d => getNodeColor(d))
            .attr('stroke', d => d.id && String(d.id).startsWith('target:') ? '#7950f2' : 'var(--background-primary)')
            .attr('stroke-width', d => d.id && String(d.id).startsWith('target:') ? 2.5 : 1.5)
            .attr('stroke-dasharray', d => d.id && String(d.id).startsWith('target:') ? '3,3' : null)
            .classed('copied', d => d.copied === true);
          
          return update;
        },
        exit => {
          console.log('Removing nodes:', exit.size());
          return exit.remove();
        }
      );
      
    console.log('Nodes updated');
    
    // Immediately position nodes in a static layout as fallback
    renderStaticNodes();
    
    // Zoom to fit all nodes
    zoomToFit();
    
  } catch (error) {
    console.error('Error in updateGraph:', error);
    // Use static layout as fallback
    renderStaticNodes();
  }
}

function getNodeRadius(node) {
  if (!node) return 8;
  
  switch (node.type) {
    case 'fileNote':
      return 10;
    case 'fileMeta':
      return 8;
    case 'fileAsset':
      return 6;
    case 'targetFile':
      return 12; // Make target files larger
    default:
      return 8;
  }
}
function ticked() {
  try {
    if (!linkElements.value || !nodeElements.value) return;
    
    // Update positions on each simulation tick
    linkElements.value
      .attr('x1', d => {
        return d.source.x || 0;
      })
      .attr('y1', d => {
        return d.source.y || 0;
      })
      .attr('x2', d => {
        return d.target.x || 0;
      })
      .attr('y2', d => {
        return d.target.y || 0;
      });
    
    nodeElements.value
      .attr('transform', d => {
        const x = isNaN(d.x) ? 0 : d.x;
        const y = isNaN(d.y) ? 0 : d.y;
        return `translate(${x}, ${y})`;
      });
  } catch (error) {
    console.error('Error in tick function:', error);
  }
}

function drag() {
  return d3.drag()
    .on('start', (event, d) => {
      if (!event.active && simulation.value) simulation.value.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active && simulation.value) simulation.value.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}

function handleNodeClick(event, d) {
  try {
    if (!nodeElements.value || !linkElements.value) return;
    
    // Update selected node
    selectedNode.value = d;
    
    // Highlight connected nodes
    nodeElements.value.classed('highlighted', false);
    linkElements.value.classed('highlighted', false);
    
    const connectedNodes = new Set();
    connectedNodes.add(d.id);
    
    // Find connected nodes
    links.value.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === d.id) {
        connectedNodes.add(targetId);
      } else if (targetId === d.id) {
        connectedNodes.add(sourceId);
      }
    });
    
    nodeElements.value.classed('highlighted', node => connectedNodes.has(node.id));
    nodeElements.value.classed('selected', node => node.id === d.id);
    
    linkElements.value.classed('highlighted', link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return connectedNodes.has(sourceId) && connectedNodes.has(targetId);
    });
  } catch (error) {
    console.error('Error in handleNodeClick:', error);
  }
}

function handleNodeMouseOver(event, d) {
  try {
    // Show tooltip with file info
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
      .style('background', 'var(--background-secondary)')
      .style('color', 'var(--text-normal)')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('box-shadow', '0 2px 8px rgba(0, 0, 0, 0.15)')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY + 10}px`);
    
    let content = `<div><strong>${d.name || 'Unknown'}</strong></div>`;
    
    if (d.type === 'targetFile') {
      content += `<div class="target-path">Target file in: ${d.path || ''}</div>`;
      content += `<div>Type: ${d.type || 'Unknown'} (Copied)</div>`;
    } else {
      content += `<div>${d.path || ''}</div>`;
      content += `<div>Type: ${d.type || 'Unknown'}</div>`;
      if (d.copied) {
        content += `<div>Status: Copied</div>`;
      }
    }
    
    tooltip.html(content);
  } catch (error) {
    console.error('Error in handleNodeMouseOver:', error);
  }
}

function handleNodeMouseOut() {
  try {
    // Remove tooltip
    d3.select('.graph-tooltip').remove();
  } catch (error) {
    console.error('Error in handleNodeMouseOut:', error);
  }
}

function getNodeColor(node) {
  try {
    if (!node) return 'var(--text-muted)';
    
    // Color based on file type
    const type = node.type || '';
    
    if (type.includes('Note') || type === 'fileNote') {
      return '#42b883'; // Vue green for markdown notes
    } else if (type.includes('Meta') || type === 'fileMeta') {
      return '#4dabf7'; // Blue for meta files
    } else if (type.includes('Asset') || type === 'fileAsset') {
      return '#ff6b6b'; // Red for assets
    } else if (type === 'targetFile') {
      return '#7950f2'; // Purple for target files
    } else {
      return '#adb5bd'; // Gray for other files
    }
  } catch (error) {
    console.error('Error in getNodeColor:', error);
    return '#adb5bd'; // Default gray
  }
}

function truncateText(text, maxLength) {
  try {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  } catch (error) {
    console.error('Error in truncateText:', error);
    return '';
  }
}

function zoomToFit() {
  try {
    if (!svg.value || !nodeElements.value || !nodeElements.value.size()) return;
    
    const bounds = svg.value.select('g').node()?.getBBox();
    if (!bounds) return;
    
    const dx = bounds.width || width.value;
    const dy = bounds.height || height.value;
    const x = bounds.x + (bounds.width / 2) || width.value / 2;
    const y = bounds.y + (bounds.height / 2) || height.value / 2;
    
    const scale = 0.8 / Math.max(dx / width.value, dy / height.value);
    const translate = [width.value / 2 - scale * x, height.value / 2 - scale * y];
    
    svg.value.transition()
      .duration(750)
      .call(
        zoom.value.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  } catch (error) {
    console.error('Error in zoomToFit:', error);
  }
}

function resetSimulation() {
  try {
    if (simulation.value) {
      simulation.value.alpha(1).restart();
    }
  } catch (error) {
    console.error('Error in resetSimulation:', error);
  }
}

function filterGraph() {
  try {
    if (!nodeElements.value || !linkElements.value) return;
    
    if (!searchTerm.value) {
      // Show all nodes and links
      nodeElements.value.style('opacity', 1);
      linkElements.value.style('opacity', 0.6);
      return;
    }
    
    const term = searchTerm.value.toLowerCase();
    const matchingNodes = new Set();
    
    // Find matching nodes
    nodes.value.forEach(node => {
      if (
        (node.name && node.name.toLowerCase().includes(term)) || 
        (node.path && node.path.toLowerCase().includes(term)) ||
        (node.type && node.type.toLowerCase().includes(term))
      ) {
        matchingNodes.add(node.id);
      }
    });
    
    // Update visibility
    nodeElements.value.style('opacity', d => matchingNodes.has(d.id) ? 1 : 0.2);
    linkElements.value.style('opacity', d => {
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      return matchingNodes.has(sourceId) && matchingNodes.has(targetId) ? 0.6 : 0.1;
    });
  } catch (error) {
    console.error('Error in filterGraph:', error);
  }
}

function handleResize() {
  try {
    if (!graphContainer.value || !svg.value || !simulation.value) return;
    
    width.value = graphContainer.value.clientWidth;
    height.value = graphContainer.value.clientHeight;
    
    svg.value
      .attr('width', width.value)
      .attr('height', height.value);
    
    simulation.value
      .force('center', d3.forceCenter(width.value / 2, height.value / 2))
      .restart();
  } catch (error) {
    console.error('Error in handleResize:', error);
  }
}

// File copying methods
async function copySelectedFile() {
  try {
    if (!selectedNode.value || !props.dependencyManager) return;
    
    const filePath = selectedNode.value.path;
    const file = props.dependencyManager.getFileByPath(filePath);
    
    if (!file) {
      console.error('Selected file not found in dependency manager');
      return;
    }
    
    console.log(`Starting copy operation for file: ${filePath}`);
    
    // Copy the file
    const targetPath = await fileService.copyFile(file);
    console.log(`File copied to target path: ${targetPath}`);
    
    // Mark the file as copied in the dependency manager
    props.dependencyManager.markFileAsCopied(filePath);
    console.log(`File marked as copied in dependency manager: ${filePath}`);
    
    // Add the target file and create a dependency
    props.dependencyManager.addTargetFile(file, targetPath);
    console.log(`Target file added to dependency manager: ${targetPath}`);
    
    // Update the node appearance
    if (nodeElements.value) {
      nodeElements.value.filter(node => node.id === filePath)
        .select('circle')
        .classed('copied', true);
      console.log(`Updated node appearance for ${filePath}`);
    }
    
    // Update the graph explicitly
    const updatedGraph = props.dependencyManager.getGraphAsJson();
    console.log('Updated graph after copy:', 
      `nodes: ${updatedGraph.nodes.length}`, 
      `edges: ${updatedGraph.edges.length}`
    );
    
    // Look for target nodes
    const targetNodes = updatedGraph.nodes.filter(node => 
      node.key.startsWith('target:')
    );
    console.log(`Found ${targetNodes.length} target nodes in graph data`);
    
    // Explicitly rebuild the graph with updated data
    buildGraphData(updatedGraph);
    updateGraph();
    
    // Emit event but don't trigger a full reload
    emits('file-copied', filePath);
    
    // Force graph to redraw to ensure target nodes are visible
    setTimeout(() => {
      updateGraph();
      console.log('Graph updated after timeout to ensure target nodes are visible');
    }, 500);
  } catch (error) {
    console.error('Error copying file:', error);
  }
}

async function copyAllFiles() {
  try {
    if (!props.dependencyManager) return;
    
    // Get all files
    const files = props.dependencyManager.getFiles();
    
    // Copy all files
    const targetPaths = await fileService.copyFiles(files);
    
    // Mark all files as copied and add target files
    files.forEach((file, index) => {
      const relativePath = file.getRelativePath();
      props.dependencyManager?.markFileAsCopied(relativePath);
      
      // Add target file and create dependency if we have a target path
      if (index < targetPaths.length) {
        props.dependencyManager?.addTargetFile(file, targetPaths[index]);
      }
    });
    
    // Emit event but don't trigger a full reload
    emits('copy-completed');
    
    // Refresh the graph locally
    refreshGraph();
    
    // Force a second update after a short delay to ensure target nodes are rendered
    setTimeout(() => {
      updateGraph();
      console.log('Graph updated after timeout to ensure target nodes are visible after copying all files');
    }, 500);
  } catch (error) {
    console.error('Error copying all files:', error);
  }
}

function resetCopiedFiles() {
  try {
    if (!props.dependencyManager) return;
    
    // Get the graph
    const graph = props.dependencyManager.getGraph();
    
    // Remove target file nodes from the graph
    const targetNodes = [];
    graph.forEachNode((node) => {
      if (String(node).startsWith('target:')) {
        targetNodes.push(node);
      }
    });
    
    // Drop target nodes
    targetNodes.forEach(node => {
      graph.dropNode(node);
    });
    
    // Clear copied files in the dependency manager
    props.dependencyManager.clearCopiedFiles();
    
    // Clear the target directory
    fileService.clearTargetDirectory();
    
    // Update the node appearance
    if (nodeElements.value) {
      nodeElements.value.select('circle').classed('copied', false);
    }
    
    // Refresh the graph
    refreshGraph();
  } catch (error) {
    console.error('Error resetting copied files:', error);
  }
}

function setTargetDirectory() {
  try {
    // Update the file service with the new target directory
    fileService.setTargetDirectory(targetDirectory.value);
    console.log('Target directory set to:', targetDirectory.value);
  } catch (error) {
    console.error('Error setting target directory:', error);
  }
}

function refreshGraph() {
  console.log('Manually refreshing graph...');
  
  // If we have a dependencyManager, update our local graph data from it
  if (props.dependencyManager) {
    const updatedGraph = props.dependencyManager.getGraphAsJson();
    console.log('Updated graph data:', 
      `nodes: ${updatedGraph.nodes.length}`, 
      `edges: ${updatedGraph.edges.length}`
    );
    
    // Look for target nodes
    const targetNodes = updatedGraph.nodes.filter(node => 
      node.key.startsWith('target:')
    );
    console.log(`Found ${targetNodes.length} target nodes in graph data`);
    
    // Explicitly rebuild the graph with updated data
    buildGraphData(updatedGraph);
    updateGraph();
    
    // Force a second update after a short delay to ensure target nodes are rendered
    setTimeout(() => {
      updateGraph();
      console.log('Graph updated after timeout to ensure target nodes are visible');
    }, 500);
  }
  
  // Don't emit refresh event as it causes the parent to reload all files
  // which would lose the target nodes
  // emits('refresh');
}

// Add a simple method to render static nodes if simulation fails
function renderStaticNodes() {
  try {
    if (!svg.value || !nodeElements.value || !linkElements.value) return;
    
    console.log('Rendering static nodes as fallback');
    
    // Position nodes in a grid layout
    const nodesPerRow = Math.ceil(Math.sqrt(nodes.value.length));
    const cellWidth = width.value / nodesPerRow;
    const cellHeight = height.value / nodesPerRow;
    
    nodes.value.forEach((node, i) => {
      const row = Math.floor(i / nodesPerRow);
      const col = i % nodesPerRow;
      node.x = col * cellWidth + cellWidth / 2;
      node.y = row * cellHeight + cellHeight / 2;
    });
    
    // Update node positions
    nodeElements.value
      .attr('transform', d => {
        const x = isNaN(d.x) ? 0 : d.x;
        const y = isNaN(d.y) ? 0 : d.y;
        return `translate(${x}, ${y})`;
      });
    
    // Update link positions
    linkElements.value
      .attr('x1', d => {
        const source = typeof d.source === 'object' ? d.source : nodes.value.find(n => n.id === d.source);
        return source ? source.x : 0;
      })
      .attr('y1', d => {
        const source = typeof d.source === 'object' ? d.source : nodes.value.find(n => n.id === d.source);
        return source ? source.y : 0;
      })
      .attr('x2', d => {
        const target = typeof d.target === 'object' ? d.target : nodes.value.find(n => n.id === d.target);
        return target ? target.x : 0;
      })
      .attr('y2', d => {
        const target = typeof d.target === 'object' ? d.target : nodes.value.find(n => n.id === d.target);
        return target ? target.y : 0;
      });
  } catch (error) {
    console.error('Error in renderStaticNodes:', error);
  }
}
</script>

<style>
.file-graph-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--text-normal);
  background-color: var(--background-primary);
  overflow: hidden;
  max-width: 1600px;
  margin: 0 auto;
}

.controls-panel {
  background-color: var(--background-secondary);
  border-bottom: 1px solid var(--background-modifier-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  padding: 12px;
  z-index: 10;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.control-group {
  flex: 1;
  min-width: 200px;
  background-color: var(--background-primary);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-normal);
}

/* Search group */
.search-group {
  flex: 2;
  min-width: 250px;
}

.search-container {
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
  color: var(--text-normal);
  font-size: 14px;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #4dabf7;
  box-shadow: 0 0 0 2px rgba(77, 171, 247, 0.2);
}

/* View controls */
.view-group {
  flex: 2;
  min-width: 220px;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.control-button, .action-button {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
  flex: 1;
  justify-content: center;
  white-space: nowrap;
}

.button-icon {
  margin-right: 6px;
  font-size: 16px;
}

.control-button {
  background-color: var(--background-secondary-alt);
  color: var(--text-normal);
}

.control-button:hover {
  background-color: var(--background-modifier-hover);
}

/* Target directory */
.target-group {
  flex: 3;
  min-width: 300px;
}

.target-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.target-input {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-secondary-alt);
  color: var(--text-normal);
  font-size: 14px;
}

.target-input:focus {
  outline: none;
  border-color: #4dabf7;
  box-shadow: 0 0 0 2px rgba(77, 171, 247, 0.2);
}

.set-button {
  background-color: #4dabf7;
  color: white;
  border: none;
  min-width: 80px;
}

.set-button:hover {
  background-color: #228be6;
}

/* Actions group */
.actions-group {
  flex: 2;
  min-width: 270px;
}

.copy-button {
  background-color: #42b883;
  color: white;
  border: none;
}

.copy-button:hover:not(:disabled) {
  background-color: #36a372;
}

.copy-button:disabled {
  background-color: #d1d5db;
  cursor: not-allowed;
  opacity: 0.7;
}

.copy-all-button {
  background-color: #4dabf7;
  color: white;
  border: none;
}

.copy-all-button:hover {
  background-color: #228be6;
}

.reset-button {
  background-color: #ff6b6b;
  color: white;
  border: none;
}

.reset-button:hover {
  background-color: #e03e3e;
}

/* File info */
.file-info {
  display: flex;
  margin-top: 4px;
  background-color: var(--background-primary);
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.file-info-header {
  width: 120px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.selected-file {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.file-meta {
  flex: 1;
}

.file-title {
  font-size: 15px;
  font-weight: bold;
}

.file-path {
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}

.file-type, .file-status {
  font-size: 13px;
  background-color: var(--background-secondary-alt);
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.file-status {
  color: white;
  background-color: #00c853;
  font-weight: 500;
}

/* Graph container */
.graph-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.graph {
  flex: 1;
  overflow: hidden;
  min-height: 400px;
  position: relative;
  background-color: var(--background-primary);
}

:deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

:deep(.node) {
  cursor: pointer;
}

:deep(.node circle) {
  stroke-width: 1.5px;
}

:deep(.node.highlighted circle) {
  stroke: var(--text-accent);
  stroke-width: 2px;
}

:deep(.node.selected circle) {
  stroke: #ffc107;
  stroke-width: 3px;
}

:deep(.node circle.copied) {
  stroke: #00c853;
  stroke-width: 3px;
}

:deep(.link) {
  stroke-opacity: 0.6;
  stroke-width: 1.5px;
}

:deep(.link.highlighted) {
  stroke-opacity: 1;
  stroke-width: 2px;
}

:deep(.link.depends_on_asset) {
  stroke: #ff6b6b;
  stroke-dasharray: 5, 5;
}

:deep(.link.depends_on_meta) {
  stroke: #4dabf7;
  stroke-dasharray: 3, 3;
}

:deep(.link.copied_to) {
  stroke: #00c853;
  stroke-width: 2px;
}

:deep(.node text) {
  pointer-events: none;
  user-select: none;
}

:deep(.node.fileNote circle), :deep(.node[class*="Note"] circle) {
  stroke: #42b883;
}

:deep(.node.fileMeta circle), :deep(.node[class*="Meta"] circle) {
  stroke: #4dabf7;
}

:deep(.node.fileAsset circle), :deep(.node[class*="Asset"] circle) {
  stroke: #ff6b6b;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .control-row {
    flex-direction: column;
    gap: 12px;
  }
  
  .control-group {
    width: 100%;
  }
  
  .file-info {
    flex-direction: column;
  }
  
  .file-info-header {
    width: 100%;
    margin-bottom: 8px;
  }
}

/* Target file node styling */
:deep(.node.targetFile circle) {
  stroke: #7950f2;
  stroke-width: 2.5px;
  stroke-dasharray: 3, 3;
}

/* Copied-to edge styling */
:deep(.link.copied_to) {
  stroke: #7950f2;
  stroke-width: 2px;
  stroke-dasharray: 5, 3;
  animation: dash 15s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: 200;
  }
}

/* Tooltip enhancement for target files */
:deep(.graph-tooltip .target-path) {
  font-style: italic;
  color: #7950f2;
}

/* Add these styles to the <style> section in FileGraph.vue */

:deep(.node.target-node) {
  opacity: 1 !important; /* Always show target nodes */
}

:deep(.node.target-node circle) {
  stroke: #7950f2;
  stroke-width: 2.5px;
  stroke-dasharray: 3, 3;
  filter: drop-shadow(0 0 3px rgba(121, 80, 242, 0.5));
}

:deep(.node.target-node text) {
  font-weight: bold;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
}

/* Make the copied-to edge more visible */
:deep(.link.copied_to) {
  stroke: #7950f2;
  stroke-width: 2.5px;
  stroke-dasharray: 5, 3;
  stroke-opacity: 0.8;
  animation: dash 15s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: 200;
  }
}

/* Highlight effect when mouse is over target node or source node */
:deep(.node.target-node:hover circle),
:deep(.node.selected.target-node circle) {
  stroke-width: 4px;
  filter: drop-shadow(0 0 5px rgba(121, 80, 242, 0.8));
}
</style>