<template>
  <div class="file-graph-container">
    <div class="graph-controls">
      <div class="search-container">
        <input 
          type="text" 
          v-model="searchTerm" 
          placeholder="Search files..." 
          class="search-input"
          @input="filterGraph"
        />
      </div>
      <div class="view-controls">
        <button @click="zoomToFit" class="control-button">
          Fit View
        </button>
        <button @click="resetSimulation" class="control-button">
          Reset
        </button>
      </div>
    </div>
    <div ref="graphContainer" class="graph"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as d3 from 'd3';

// Define props
interface Props {
  files: Array<{
    name: string;
    path: string;
    extension: string;
    children: any;
    isFolder: boolean;
    size: string;
    mtime: string;
  }>;
}

const props = defineProps<Props>();

// Reactive state
const searchTerm = ref('');
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

// Safely get property from nested objects
function safeGet(obj, path, defaultValue = undefined) {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[parts[i]];
  }
  
  return current === undefined ? defaultValue : current;
}

// Watch for changes in files prop with safeguards
watch(() => props.files, (newFiles) => {
  if (!newFiles || !Array.isArray(newFiles)) {
    console.log('No valid files data received');
    return;
  }
  
  console.log('Files changed:', newFiles.length);
  if (newFiles.length > 0) {
    try {
      // Use a safely serialized sample to avoid proxy issues
      const sample = {
        name: safeGet(newFiles[0], 'name', ''),
        path: safeGet(newFiles[0], 'path', ''),
        type: safeGet(newFiles[0], 'isFolder', false) ? 'folder' : 'file'
      };
      console.log('Sample file:', JSON.stringify(sample));
    } catch (error) {
      console.log('Could not stringify sample file');
    }
  }
  
  buildGraphData(newFiles);
  if (svg.value) {
    updateGraph();
  }
}, { deep: false, immediate: true });

// Lifecycle hooks
onMounted(async () => {
  console.log('Component mounted, waiting for DOM update');
  await nextTick();
  
  if (graphContainer.value) {
    console.log('Graph container found:', graphContainer.value);
    console.log('Container dimensions:', graphContainer.value.clientWidth, 'x', graphContainer.value.clientHeight);
    initGraph();
    buildGraphData(props.files);
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

function buildGraphData(files) {
  try {
    // Clear existing data
    nodes.value = [];
    links.value = [];
    
    if (!files || !Array.isArray(files)) {
      console.error('Invalid files data', files);
      return;
    }
    
    console.log('Building graph from files:', files.length);
    
    // Create a map for quick node lookup
    const nodeMap = new Map();
    
    // Add root node first
    const rootNode = {
      id: '/',
      name: 'Root',
      path: '/',
      type: 'folder',
      extension: '',
      size: '',
      mtime: '',
      x: width.value / 2,
      y: height.value / 2
    };
    nodes.value.push(rootNode);
    nodeMap.set('/', rootNode);
    
    // Add nodes - create plain JS objects to avoid proxy issues
    files.forEach(file => {
      if (!file || typeof file !== 'object') return;
      
      const node = {
        id: safeGet(file, 'path', ''),
        name: safeGet(file, 'name', ''),
        path: safeGet(file, 'path', ''),
        type: safeGet(file, 'isFolder', false) ? 'folder' : 'file',
        extension: safeGet(file, 'extension', ''),
        size: safeGet(file, 'size', ''),
        mtime: safeGet(file, 'mtime', ''),
        x: Math.random() * width.value,
        y: Math.random() * height.value
      };
      
      // Skip root as we already added it
      if (node.id === '/') return;
      
      // Skip empty paths
      if (!node.id) return;
      
      nodes.value.push(node);
      nodeMap.set(node.id, node);
    });
    
    // Create links
    nodes.value.forEach(node => {
      if (node.path === '/') return; // Skip root
      
      try {
        const lastSlashIndex = node.path.lastIndexOf('/');
        if (lastSlashIndex > 0) {
          const parentPath = node.path.substring(0, lastSlashIndex);
          
          // Check if parent exists in our node map
          if (nodeMap.has(parentPath)) {
            links.value.push({
              id: `${parentPath}-${node.path}`,
              source: parentPath,
              target: node.path
            });
          } else {
            // Link to root if parent doesn't exist
            links.value.push({
              id: `/-${node.path}`,
              source: '/',
              target: node.path
            });
          }
        } else {
          // Files/folders in root
          links.value.push({
            id: `/-${node.path}`,
            source: '/',
            target: node.path
          });
        }
      } catch (error) {
        console.error('Error creating link for node:', node.path, error);
      }
    });
    
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
      .attr('stroke', 'var(--text-muted)')
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
            .attr('class', d => `node ${d.type}`)
            .call(drag())
            .on('click', (event, d) => handleNodeClick(event, d))
            .on('mouseover', (event, d) => handleNodeMouseOver(event, d))
            .on('mouseout', () => handleNodeMouseOut());
          
          // Add circle for node
          nodeGroup.append('circle')
            .attr('r', d => d.type === 'folder' ? 12 : 8)
            .attr('fill', d => getNodeColor(d))
            .attr('stroke', 'var(--background-primary)')
            .attr('stroke-width', 1.5);
          
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
    content += `<div>${d.path || ''}</div>`;
    
    if (d.type !== 'folder') {
      content += `<div>Size: ${d.size || 'N/A'}</div>`;
      content += `<div>Modified: ${d.mtime || 'N/A'}</div>`;
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
    
    if (node.type === 'folder') {
      return 'var(--interactive-accent)';
    }
    
    // Color based on file extension
    const extension = node.extension?.toLowerCase();
    if (extension === 'md') {
      return '#42b883'; // Vue green for markdown
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension)) {
      return '#ff6b6b'; // Red for images
    } else if (['pdf'].includes(extension)) {
      return '#ff922b'; // Orange for PDFs
    } else if (['js', 'ts', 'jsx', 'tsx'].includes(extension)) {
      return '#4dabf7'; // Blue for code
    } else if (['json', 'yml', 'yaml', 'toml'].includes(extension)) {
      return '#ae3ec9'; // Purple for config
    }
    
    return '#adb5bd'; // Gray for other files
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
        (node.path && node.path.toLowerCase().includes(term))
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

<style scoped>
.file-graph-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.graph-controls {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--background-modifier-border);
}

.search-container {
  flex: 1;
  margin-right: 16px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
  color: var(--text-normal);
}

.view-controls {
  display: flex;
  gap: 8px;
}

.control-button {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
  color: var(--text-normal);
  cursor: pointer;
  font-size: 12px;
}

.control-button:hover {
  background-color: var(--background-secondary);
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

:deep(.link) {
  stroke: var(--text-muted);
  stroke-opacity: 0.6;
  stroke-width: 1.5px;
}

:deep(.link.highlighted) {
  stroke: var(--text-accent);
  stroke-opacity: 1;
  stroke-width: 2px;
}

:deep(.node text) {
  pointer-events: none;
  user-select: none;
}
</style>