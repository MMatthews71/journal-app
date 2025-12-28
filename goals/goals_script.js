// Goal Graph Implementation
class GoalGraph {
    constructor() {
        this.nodes = new Map();
        this.links = [];
        this.categories = {
            personal: { color: "#7289da", name: "Personal" },
            work: { color: "#43b581", name: "Work" },
            learning: { color: "#faa61a", name: "Learning" },
            health: { color: "#ed4245", name: "Health" },
            financial: { color: "#9b59b6", name: "Financial" }
        };
    }

    addNode(id, description, category = "personal") {
        if (this.nodes.has(id)) {
            alert(`Goal with ID "${id}" already exists!`);
            return false;
        }

        const newNode = {
            id: id,
            description: description,
            category: category,
            x: Math.random() * 500,
            y: Math.random() * 500,
            children: [],
            parents: []
        };

        this.nodes.set(id, newNode);
        return true;
    }

    addLink(sourceId, targetId) {
        const sourceNode = this.nodes.get(sourceId);
        const targetNode = this.nodes.get(targetId);

        if (!sourceNode || !targetNode) {
            alert("One or both goals don't exist!");
            return false;
        }

        // Check if link already exists
        const linkExists = this.links.some(
            link => link.source.id === sourceId && link.target.id === targetId
        );

        if (!linkExists) {
            sourceNode.children.push(targetId);
            targetNode.parents.push(sourceId);
            this.links.push({
                source: sourceNode,
                target: targetNode,
                id: `${sourceId}-${targetId}`
            });
            return true;
        }

        return false;
    }

    removeNode(id) {
        if (!this.nodes.has(id)) return false;

        const node = this.nodes.get(id);

        // Remove from parents' children lists
        node.parents.forEach(parentId => {
            const parent = this.nodes.get(parentId);
            if (parent) {
                parent.children = parent.children.filter(childId => childId !== id);
            }
        });

        // Remove from children's parents lists
        node.children.forEach(childId => {
            const child = this.nodes.get(childId);
            if (child) {
                child.parents = child.parents.filter(parentId => parentId !== id);
            }
        });

        // Remove links
        this.links = this.links.filter(
            link => link.source.id !== id && link.target.id !== id
        );

        this.nodes.delete(id);
        return true;
    }

    updateNode(id, description, category) {
        if (!this.nodes.has(id)) return false;
        
        const node = this.nodes.get(id);
        node.description = description;
        node.category = category;
        return true;
    }

    clear() {
        this.nodes.clear();
        this.links = [];
    }

    getNode(id) {
        return this.nodes.get(id);
    }

    getAllNodes() {
        return Array.from(this.nodes.values());
    }

    getAllLinks() {
        return this.links;
    }

    // Search nodes by ID or description
    search(query) {
        const results = [];
        const lowercaseQuery = query.toLowerCase();
        
        for (const [id, node] of this.nodes) {
            if (id.toLowerCase().includes(lowercaseQuery) || 
                node.description.toLowerCase().includes(lowercaseQuery)) {
                results.push(node);
            }
        }
        
        return results;
    }
}

// Visualization using D3.js with force-directed layout
class GraphVisualizer {
    constructor(containerId, goalGraph) {
        this.containerId = containerId;
        this.goalGraph = goalGraph;
        this.svg = d3.select(`#${containerId}`);
        this.width = this.svg.node().getBoundingClientRect().width;
        this.height = this.svg.node().getBoundingClientRect().height;
        this.selectedNode = null;
        
        // Create main group for the graph
        this.g = this.svg.append('g');
        
        // Set up zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });
        
        this.svg.call(this.zoom);
        
        // Force simulation
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(50));
        
        // Drag behavior
        this.drag = d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
        
        // Context menu
        this.contextMenu = d3.select('#contextMenu');
        
        // Initial render
        this.render();
    }

    render() {
        // Clear previous content
        this.g.selectAll("*").remove();
        
        const nodes = this.goalGraph.getAllNodes();
        const links = this.goalGraph.getAllLinks();
        
        if (nodes.length === 0) {
            // No nodes to display
            this.g.append('text')
                .attr('x', this.width / 2)
                .attr('y', this.height / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#666')
                .attr('font-size', '14px')
                .text('No goals yet. Click the + button on nodes to add goals.');
            return;
        }
        
        // Create links
        const link = this.g.selectAll('.link')
            .data(links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('id', d => `link-${d.id}`);
        
        // Create nodes
        const node = this.g.selectAll('.node')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'node')
            .call(this.drag)
            .on('mouseover', (event, d) => {
                // Add active class on mouseover
                d3.select(event.currentTarget).classed('active', true);
            })
            .on('mouseout', (event, d) => {
                // Remove active class on mouseout, but only if not hovering over buttons
                setTimeout(() => {
                    const isHoveringButtons = d3.select(event.relatedTarget).classed('node-button');
                    if (!isHoveringButtons) {
                        d3.select(event.currentTarget).classed('active', false);
                    }
                }, 10);
            })
            .on('click', (event, d) => {
                this.showNodeInfo(d);
                event.stopPropagation();
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                this.showContextMenu(event, d);
            });
        
        // Calculate text dimensions for proper box sizing
        const tempText = node.append('text')
            .text(d => d.id)
            .attr('opacity', 0);
        
        const textWidths = {};
        tempText.each(function(d) {
            textWidths[d.id] = this.getBBox().width;
        });
        tempText.remove();
        
        // Add rectangular boxes to nodes
        node.append('rect')
            .attr('width', d => Math.max(120, textWidths[d.id] + 40))
            .attr('height', 60)
            .attr('x', d => -Math.max(120, textWidths[d.id] + 40) / 2)
            .attr('y', -30)
            .attr('fill', d => this.goalGraph.categories[d.category].color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);
        
        // Add title text
        node.append('text')
            .attr('class', 'node-title')
            .text(d => d.id)
            .attr('y', -10)
            .attr('text-anchor', 'middle');
        
        // Add description text (truncated)
        node.append('text')
            .attr('class', 'node-description')
            .text(d => {
                const desc = d.description;
                return desc.length > 30 ? desc.substring(0, 30) + '...' : desc;
            })
            .attr('y', 8)
            .attr('text-anchor', 'middle');
        
        // Add action buttons
        const nodeButtons = node.append('g')
            .attr('class', 'node-buttons')
            .attr('transform', 'translate(0, 45)')
            .on('mouseover', (event, d) => {
                // Keep parent node active when hovering buttons
                d3.select(event.currentTarget.parentNode).classed('active', true);
                event.stopPropagation();
            })
            .on('mouseout', (event, d) => {
                // Remove active class when leaving buttons area
                setTimeout(() => {
                    const isHoveringNode = d3.select(event.relatedTarget).classed('node');
                    if (!isHoveringNode) {
                        d3.select(event.currentTarget.parentNode).classed('active', false);
                    }
                }, 10);
                event.stopPropagation();
            });
        
        // Add button
        const addButton = nodeButtons.append('g')
            .attr('class', 'node-button add')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.showAddForm(d.id);
            });
        
        addButton.append('rect')
            .attr('width', 20)
            .attr('height', 20)
            .attr('x', -25)
            .attr('y', -10)
            .attr('rx', 4);
        
        addButton.append('text')
            .text('+')
            .attr('x', -15)
            .attr('y', 3)
            .attr('text-anchor', 'middle');
        
        // Delete button
        const deleteButton = nodeButtons.append('g')
            .attr('class', 'node-button delete')
            .attr('transform', 'translate(25, 0)')
            .on('click', (event, d) => {
                event.stopPropagation();
                if (confirm(`Delete goal "${d.id}"?`)) {
                    this.goalGraph.removeNode(d.id);
                    this.render();
                    document.getElementById('nodeInfo').style.display = 'none';
                }
            });
        
        deleteButton.append('rect')
            .attr('width', 20)
            .attr('height', 20)
            .attr('x', -10)
            .attr('y', -10)
            .attr('rx', 4);
        
        deleteButton.append('text')
            .text('×')
            .attr('x', 0)
            .attr('y', 3)
            .attr('text-anchor', 'middle');
        
        // Update simulation
        this.simulation.nodes(nodes);
        this.simulation.force('link').links(links);
        this.simulation.alpha(1).restart();
        
        // Update positions on tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }

    showAddForm(parentId) {
        // Show the sidebar if it's collapsed
        document.getElementById('sidebar').classList.remove('collapsed');
        
        // Pre-fill the parent node field
        document.getElementById('parentNode').value = parentId;
        
        // Focus on the node ID field
        document.getElementById('nodeId').focus();
    }

    showNodeInfo(node) {
        document.getElementById('nodeInfo').style.display = 'block';
        document.getElementById('selectedNodeTitle').textContent = `Goal: ${node.id}`;
        document.getElementById('infoNodeId').textContent = node.id;
        document.getElementById('infoDescription').textContent = node.description;
        document.getElementById('infoCategory').textContent = 
            this.goalGraph.categories[node.category].name;
        
        const connections = [];
        if (node.parents.length > 0) {
            connections.push(`Parents: ${node.parents.join(', ')}`);
        }
        if (node.children.length > 0) {
            connections.push(`Children: ${node.children.join(', ')}`);
        }
        
        document.getElementById('infoConnections').textContent = 
            connections.length > 0 ? connections.join(' | ') : 'No connections';
        
        // Highlight connected nodes and links
        this.highlightConnections(node.id);
    }

    highlightConnections(nodeId) {
        // Reset all highlights
        this.g.selectAll('.node').classed('highlighted', false);
        this.g.selectAll('.link').classed('highlighted', false);
        
        // Highlight the selected node
        this.g.selectAll('.node')
            .filter(d => d.id === nodeId)
            .classed('highlighted', true);
        
        // Highlight connected nodes and links
        this.g.selectAll('.link')
            .filter(d => d.source.id === nodeId || d.target.id === nodeId)
            .classed('highlighted', true);
        
        this.g.selectAll('.node')
            .filter(d => 
                d.parents.includes(nodeId) || 
                d.children.includes(nodeId) || 
                d.id === nodeId
            )
            .classed('highlighted', true);
    }

    showContextMenu(event, node) {
        this.contextMenu
            .style('left', `${event.pageX}px`)
            .style('top', `${event.pageY}px`)
            .style('display', 'block')
            .html(`
                <div class="context-menu-item" data-action="info">Show Info</div>
                <div class="context-menu-item" data-action="edit">Edit</div>
                <div class="context-menu-item" data-action="delete">Delete</div>
                <div class="context-menu-item" data-action="center">Center View</div>
            `);
        
        // Handle context menu actions
        this.contextMenu.selectAll('.context-menu-item')
            .on('click', (e, d) => {
                const action = e.target.getAttribute('data-action');
                this.handleContextMenuAction(action, node);
                this.contextMenu.style('display', 'none');
            });
        
        // Hide context menu when clicking elsewhere
        d3.select('body').on('click.contextmenu', () => {
            this.contextMenu.style('display', 'none');
            d3.select('body').on('click.contextmenu', null);
        });
    }

    handleContextMenuAction(action, node) {
        switch(action) {
            case 'info':
                this.showNodeInfo(node);
                break;
            case 'edit':
                this.editNode(node);
                break;
            case 'delete':
                if (confirm(`Delete goal "${node.id}"?`)) {
                    this.goalGraph.removeNode(node.id);
                    this.render();
                    document.getElementById('nodeInfo').style.display = 'none';
                }
                break;
            case 'center':
                this.centerNode(node);
                break;
        }
    }

    editNode(node) {
        document.getElementById('nodeId').value = node.id;
        document.getElementById('nodeDescription').value = node.description;
        document.getElementById('nodeCategory').value = node.category;
        
        // Change add button to update button temporarily
        const addBtn = document.getElementById('addNodeBtn');
        const originalText = addBtn.textContent;
        addBtn.textContent = 'Update Goal';
        
        const updateHandler = () => {
            const description = document.getElementById('nodeDescription').value;
            const category = document.getElementById('nodeCategory').value;
            
            if (this.goalGraph.updateNode(node.id, description, category)) {
                this.render();
                this.showNodeInfo(this.goalGraph.getNode(node.id));
                
                // Reset form and button
                document.getElementById('nodeId').value = '';
                document.getElementById('nodeDescription').value = '';
                addBtn.textContent = originalText;
                addBtn.removeEventListener('click', updateHandler);
                addBtn.addEventListener('click', addNodeHandler);
            }
        };
        
        // Remove previous event listeners
        addBtn.replaceWith(addBtn.cloneNode(true));
        const newAddBtn = document.getElementById('addNodeBtn');
        newAddBtn.addEventListener('click', updateHandler);
        
        // Store reference to original handler
        const addNodeHandler = window.addNodeHandler;
    }

    centerNode(node) {
        const scale = 1.5;
        const translate = [
            this.width / 2 - scale * node.x,
            this.height / 2 - scale * node.y
        ];
        
        this.svg.transition().duration(750).call(
            this.zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }

    centerView() {
        this.svg.transition().duration(750).call(
            this.zoom.transform,
            d3.zoomIdentity.translate(0, 0).scale(1)
        );
    }

    resetZoom() {
        this.svg.transition().duration(750).call(
            this.zoom.transform,
            d3.zoomIdentity
        );
    }

    togglePhysics() {
        if (this.simulation.alpha() > 0) {
            this.simulation.alphaTarget(0);
            this.simulation.alpha(0);
            document.getElementById('togglePhysicsBtn').textContent = 'Resume Physics';
        } else {
            this.simulation.alphaTarget(0.3);
            this.simulation.alpha(0.3);
            this.simulation.restart();
            document.getElementById('togglePhysicsBtn').textContent = 'Pause Physics';
        }
    }

    update() {
        this.render();
    }

    search(query) {
        const results = this.goalGraph.search(query);
        
        // Reset all highlights
        this.g.selectAll('.node').classed('highlighted', false);
        
        // Highlight search results
        this.g.selectAll('.node')
            .filter(d => results.some(r => r.id === d.id))
            .classed('highlighted', true);
        
        return results;
    }
}

// Application setup
document.addEventListener('DOMContentLoaded', function() {
    const goalGraph = new GoalGraph();
    const visualizer = new GraphVisualizer('graph', goalGraph);
    
    // Add node button handler
    window.addNodeHandler = function() {
        const nodeId = document.getElementById('nodeId').value.trim();
        const description = document.getElementById('nodeDescription').value.trim();
        const category = document.getElementById('nodeCategory').value;
        const parentId = document.getElementById('parentNode').value.trim() || null;
        
        if (!nodeId || !description) {
            alert('Please enter both Goal ID and Description');
            return;
        }
        
        if (goalGraph.addNode(nodeId, description, category)) {
            if (parentId) {
                goalGraph.addLink(parentId, nodeId);
            }
            visualizer.update();
            
            // Clear form
            document.getElementById('nodeId').value = '';
            document.getElementById('nodeDescription').value = '';
            document.getElementById('parentNode').value = '';
        }
    };
    
    document.getElementById('addNodeBtn').addEventListener('click', window.addNodeHandler);
    
    // Toggle sidebar button
    document.getElementById('toggleSidebar').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
    
    // Center button handler
    document.getElementById('centerBtn').addEventListener('click', function() {
        visualizer.centerView();
    });
    
    // Reset zoom button handler
    document.getElementById('resetZoomBtn').addEventListener('click', function() {
        visualizer.resetZoom();
    });
    
    // Toggle physics button handler
    document.getElementById('togglePhysicsBtn').addEventListener('click', function() {
        visualizer.togglePhysics();
    });
    
    // Export button handler
    document.getElementById('exportBtn').addEventListener('click', function() {
        const data = {
            nodes: goalGraph.getAllNodes(),
            links: goalGraph.getAllLinks()
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "goal-graph.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
    
    // Example button handler
    document.getElementById('exampleBtn').addEventListener('click', function() {
        goalGraph.clear();
        
        // Add example goals
        goalGraph.addNode('learn-js', 'Learn JavaScript', 'learning');
        goalGraph.addNode('web-app', 'Build a web application', 'work');
        goalGraph.addNode('learn-d3', 'Learn D3.js', 'learning');
        goalGraph.addNode('visualizations', 'Create interactive visualizations', 'work');
        goalGraph.addNode('deploy', 'Deploy application', 'work');
        goalGraph.addNode('html-css', 'Learn HTML & CSS', 'learning');
        goalGraph.addNode('styling', 'Style the application', 'work');
        goalGraph.addNode('exercise', 'Regular exercise', 'health');
        goalGraph.addNode('budget', 'Create monthly budget', 'financial');
        goalGraph.addNode('savings', 'Increase savings', 'financial');
        goalGraph.addNode('meditation', 'Daily meditation', 'personal');
        
        // Add connections
        goalGraph.addLink('learn-js', 'web-app');
        goalGraph.addLink('learn-js', 'learn-d3');
        goalGraph.addLink('learn-d3', 'visualizations');
        goalGraph.addLink('web-app', 'deploy');
        goalGraph.addLink('html-css', 'styling');
        goalGraph.addLink('learn-js', 'html-css');
        goalGraph.addLink('web-app', 'styling');
        goalGraph.addLink('budget', 'savings');
        
        visualizer.update();
    });
    
    // Search handler
    document.getElementById('searchInput').addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length > 0) {
            visualizer.search(query);
        } else {
            // Reset highlights when search is cleared
            visualizer.g.selectAll('.node').classed('highlighted', false);
        }
    });
    
    // Delete node button handler
    document.getElementById('deleteNodeBtn').addEventListener('click', function() {
        const nodeId = document.getElementById('infoNodeId').textContent;
        if (nodeId && confirm(`Delete goal "${nodeId}"?`)) {
            goalGraph.removeNode(nodeId);
            visualizer.update();
            document.getElementById('nodeInfo').style.display = 'none';
        }
    });
    
    // Edit node button handler
    document.getElementById('editNodeBtn').addEventListener('click', function() {
        const nodeId = document.getElementById('infoNodeId').textContent;
        const node = goalGraph.getNode(nodeId);
        if (node) {
            visualizer.editNode(node);
        }
    });
    
    // Click on graph background to hide node info
    d3.select('#graph').on('click', function(event) {
        if (event.target.tagName === 'svg') {
            document.getElementById('nodeInfo').style.display = 'none';
            // Reset highlights
            visualizer.g.selectAll('.node').classed('highlighted', false);
            visualizer.g.selectAll('.link').classed('highlighted', false);
        }
    });
});