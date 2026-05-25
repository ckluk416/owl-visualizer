/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Play, Pause, RefreshCw, ZoomIn, ZoomOut, Maximize, Circle, Shield, Sparkles, Sliders, Eye, EyeOff, Pin, HelpCircle } from 'lucide-react';
import { OntologyNode, OntologyLink, GraphNode, GraphLink, NodeType } from '../types';

interface OntologyGraphProps {
  nodes: OntologyNode[];
  links: OntologyLink[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  hoveredNodeId: string | null;
  onHoverNode: (nodeId: string | null) => void;
  nodeTypesVisibility: Record<NodeType, boolean>;
}

export default function OntologyGraph({
  nodes,
  links,
  selectedNodeId,
  onSelectNode,
  hoveredNodeId,
  onHoverNode,
  nodeTypesVisibility,
}: OntologyGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // States
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [isPaused, setIsPaused] = useState(false);
  const [chargeStrength, setChargeStrength] = useState(-300);
  const [linkDistance, setLinkDistance] = useState(120);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [pinnedNodes, setPinnedNodes] = useState<Set<string>>(new Set());
  const [activeTabRelation, setActiveTabRelation] = useState<'all' | 'subClassOf' | 'hasComponent' | 'hasCharacteristic' | 'individuals'>('all');

  // SVG dimensions handler
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 400),
          height: Math.max(height || 550, 450),
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    
    // Initial size
    const rect = containerRef.current.getBoundingClientRect();
    setDimensions({
      width: Math.max(rect.width, 400),
      height: Math.max(rect.height || 550, 450),
    });

    return () => resizeObserver.disconnect();
  }, []);

  // Filter nodes and links based on checkboxes and selected relation filter
  const filteredData = useMemo(() => {
    const visibleNodeIds = new Set(
      nodes
        .filter((n) => nodeTypesVisibility[n.type])
        .map((n) => n.id)
    );

    // Apply relation-specific tab filters
    const filteredLinks = links.filter((link) => {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      
      if (!visibleNodeIds.has(srcId) || !visibleNodeIds.has(tgtId)) return false;

      if (activeTabRelation === 'subClassOf') {
        return link.type === 'subClassOf';
      }
      if (activeTabRelation === 'hasComponent') {
        return link.type === 'hasComponent';
      }
      if (activeTabRelation === 'hasCharacteristic') {
        return link.type === 'hasCharacteristic' || link.type === 'hasValue';
      }
      if (activeTabRelation === 'individuals') {
        return link.type === 'typeOf' || link.type === 'customRelation';
      }
      return true;
    });

    // Make sure we only show nodes that appear in filtered links, or any active classes if we are in 'all' mode
    const activeNodeIds = new Set<string>();
    filteredLinks.forEach((l) => {
      activeNodeIds.add(typeof l.source === 'string' ? l.source : (l.source as any).id);
      activeNodeIds.add(typeof l.target === 'string' ? l.target : (l.target as any).id);
    });

    // If 'all' mode, also show isolated classes/individuals. If specific mode, show only connected ones to make graph clutter-free!
    const filteredNodes = nodes.filter((node) => {
      if (!nodeTypesVisibility[node.type]) return false;
      if (activeTabRelation === 'all') return true;
      return activeNodeIds.has(node.id);
    });

    // Return the nodes and links
    return {
      nodes: filteredNodes.map((n) => ({
        id: n.id,
        localName: n.localName,
        type: n.type,
        comment: n.comment,
      })),
      links: filteredLinks.map((l) => ({
        id: l.id,
        source: typeof l.source === 'string' ? l.source : (l.source as any).id,
        target: typeof l.target === 'string' ? l.target : (l.target as any).id,
        type: l.type,
        label: l.label,
      })),
    };
  }, [nodes, links, nodeTypesVisibility, activeTabRelation]);

  // Setup reactive simulation data holders
  const [simNodes, setSimNodes] = useState<GraphNode[]>([]);
  const [simLinks, setSimLinks] = useState<GraphLink[]>([]);

  // Track layout simulation references
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  useEffect(() => {
    if (filteredData.nodes.length === 0) {
      setSimNodes([]);
      setSimLinks([]);
      return;
    }

    // Keep coordinates of existing nodes to prevent dramatic jumping between filter changes
    const coordsMap = new Map<string, { x: number; y: number; vx: number; vy: number; fx?: number | null; fy?: number | null }>();
    simNodes.forEach((node) => {
      coordsMap.set(node.id, {
        x: node.x || 0,
        y: node.y || 0,
        vx: node.vx || 0,
        vy: node.vy || 0,
        fx: node.fx,
        fy: node.fy,
      });
    });

    // Map new nodes matching positions if they existed, else randomize slightly around center
    const newSimNodes: GraphNode[] = filteredData.nodes.map((n) => {
      const existing = coordsMap.get(n.id);
      const isPinned = pinnedNodes.has(n.id);
      return {
        ...n,
        x: existing ? existing.x : dimensions.width / 2 + (Math.random() - 0.5) * 150,
        y: existing ? existing.y : dimensions.height / 2 + (Math.random() - 0.5) * 150,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
        fx: isPinned ? (existing?.fx || existing?.x || dimensions.width / 2) : (existing?.fx ?? null),
        fy: isPinned ? (existing?.fy || existing?.y || dimensions.height / 2) : (existing?.fy ?? null),
      };
    });

    const newSimLinks: GraphLink[] = filteredData.links.map((lnk) => ({
      ...lnk,
    }));

    setSimNodes(newSimNodes);
    setSimLinks(newSimLinks);

    // Cancel old simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create d3 force simulation
    const simulation = d3.forceSimulation<GraphNode, GraphLink>(newSimNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(newSimLinks)
        .id((d) => d.id)
        .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.85))
      .force('collision', d3.forceCollide().radius(45));

    if (isPaused) {
      simulation.stop();
    }

    simulation.on('tick', () => {
      setSimNodes([...newSimNodes]);
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [filteredData, dimensions.width, dimensions.height, isPaused]);

  // Adjust forces interactively when sliders change
  useEffect(() => {
    if (!simulationRef.current) return;
    const sim = simulationRef.current;
    
    // Update forces
    sim.force('charge', d3.forceManyBody().strength(chargeStrength));
    const linkForce = sim.force('link') as d3.ForceLink<GraphNode, GraphLink> | undefined;
    if (linkForce) {
      linkForce.distance(linkDistance);
    }
    
    // Alpha heat up to smooth transitions
    if (!isPaused) {
      sim.alpha(0.3).restart();
    }
  }, [chargeStrength, linkDistance]);

  // Handle D3 Zoom and Pan
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => {
        setZoomTransform(event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
  }, []);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1 / 1.3);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(350).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  // Node Drag Handlers
  const dragInProgressRef = useRef(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation(); // Prevents canvas panning while dragging a node
    e.preventDefault();
    dragInProgressRef.current = true;
    setDraggedNodeId(node.id);

    // Convert mouse position to canvas coordinate
    const clientX = e.clientX;
    const clientY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragInProgressRef.current || !svgRef.current) return;
      
      const svgElement = svgRef.current;
      const rect = svgElement.getBoundingClientRect();
      
      // Calculate coordinates respecting current zoom transforms
      let canvasX = (moveEvent.clientX - rect.left - zoomTransform.x) / zoomTransform.k;
      let canvasY = (moveEvent.clientY - rect.top - zoomTransform.y) / zoomTransform.k;

      // Update node physics variables
      node.fx = canvasX;
      node.fy = canvasY;

      // Keep simulation alive
      if (simulationRef.current && !isPaused) {
        simulationRef.current.alphaTarget(0.12).restart();
      } else {
        // Trigger manual tick render if simulation is paused
        setSimNodes([...simNodes]);
      }
    };

    const onMouseUp = () => {
      dragInProgressRef.current = false;
      setDraggedNodeId(null);
      
      // If node is not pinned, unlock it
      if (!pinnedNodes.has(node.id)) {
        node.fx = null;
        node.fy = null;
      }

      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const togglePinNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = new Set(pinnedNodes);
    
    // Find node reference
    const node = simNodes.find(n => n.id === nodeId);
    
    if (updated.has(nodeId)) {
      updated.delete(nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    } else {
      updated.add(nodeId);
      if (node) {
        node.fx = node.x || dimensions.width / 2;
        node.fy = node.y || dimensions.height / 2;
      }
    }
    setPinnedNodes(updated);
    if (simulationRef.current && !isPaused) {
      simulationRef.current.alpha(0.08).restart();
    }
  };

  const clearAllPins = () => {
    simNodes.forEach((node) => {
      node.fx = null;
      node.fy = null;
    });
    setPinnedNodes(new Set());
    if (simulationRef.current && !isPaused) {
      simulationRef.current.alpha(0.2).restart();
    }
  };

  // Node styling configuration
  const getNodeColor = (type: NodeType, isSelected: boolean, isHovered: boolean) => {
    if (isSelected) return 'fill-blue-600 stroke-blue-800 dark:fill-blue-500 dark:stroke-blue-300';
    if (isHovered) return 'fill-indigo-500 stroke-indigo-700';

    switch (type) {
      case 'class':
        return 'fill-slate-100 stroke-slate-700 dark:fill-slate-800 dark:stroke-slate-300 hover:fill-slate-200';
      case 'objectProperty':
        return 'fill-teal-50 stroke-teal-700 dark:fill-teal-950 dark:stroke-teal-400 hover:fill-teal-100';
      case 'datatypeProperty':
        return 'fill-indigo-50 stroke-indigo-600 dark:fill-indigo-950 dark:stroke-indigo-400 hover:fill-indigo-100';
      case 'individual':
        return 'fill-amber-50 stroke-amber-700 dark:fill-amber-950 dark:stroke-amber-400 hover:fill-amber-100';
      case 'restriction':
        return 'fill-purple-50 stroke-purple-600 dark:fill-purple-950 dark:stroke-purple-400 hover:fill-purple-100';
      default:
        return 'fill-gray-100 stroke-gray-500 hover:fill-gray-200';
    }
  };

  const getNodeShape = (type: NodeType) => {
    // Return SVG shape component representation
    switch (type) {
      case 'class':
        return { shape: 'circle', r: 24, classes: 'stroke-[2.5]' };
      case 'objectProperty':
        return { shape: 'diamond', r: 20, classes: 'stroke-[2.5]' };
      case 'datatypeProperty':
        return { shape: 'rect-round', w: 42, h: 26, r: 15, classes: 'stroke-2' };
      case 'individual':
        return { shape: 'hexagon', r: 22, classes: 'stroke-[2.5]' };
      case 'restriction':
        return { shape: 'circle', r: 18, classes: 'stroke-[1.5] stroke-dashed' };
      default:
        return { shape: 'circle', r: 18, classes: 'stroke-1' };
    }
  };

  // Determine path styles
  const getLinkStyle = (type: string, isRelatedHovered: boolean) => {
    const isSpecial = ['hasComponent', 'hasCharacteristic', 'hasMake'].includes(type) || type === 'hasValue';
    
    let strokeClass = 'stroke-slate-400 dark:stroke-slate-600';
    let marker = 'url(#arrow-generic)';
    let strokeDash = '';

    if (isRelatedHovered) {
      strokeClass = 'stroke-indigo-600 dark:stroke-indigo-400 stroke-[2.5]';
      marker = 'url(#arrow-highlighted)';
    } else if (type === 'subClassOf') {
      strokeClass = 'stroke-slate-700 dark:stroke-slate-300 stroke-[2]';
      marker = 'url(#arrow-subclass)';
    } else if (type === 'equivalentClass') {
      strokeClass = 'stroke-violet-500 dark:stroke-violet-400 stroke-1';
      strokeDash = '4,4';
      marker = 'url(#arrow-equivalent)';
    } else if (type === 'typeOf') {
      strokeClass = 'stroke-amber-600 dark:stroke-amber-500 stroke-[1.5]';
      strokeDash = '3,3';
      marker = 'url(#arrow-typeof)';
    } else if (isSpecial) {
      strokeClass = 'stroke-teal-600 dark:stroke-teal-400 stroke-[2]';
      marker = 'url(#arrow-special)';
    }

    return { strokeClass, marker, strokeDash };
  };

  // Check connectivity for highlighting
  const connectedNodeIds = useMemo(() => {
    const active = hoveredNodeId || selectedNodeId;
    if (!active) return new Set<string>();

    const set = new Set<string>([active]);
    links.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      if (srcId === active) set.add(tgtId);
      if (tgtId === active) set.add(srcId);
    });
    return set;
  }, [hoveredNodeId, selectedNodeId, links]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800" id="graph-panel-main">
      {/* Visual filter options / relationships */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-xs text-slate-600 dark:text-slate-300 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1">
          <span className="font-semibold text-slate-500 mr-2 text-xs">Relation Filter:</span>
          {[
            { id: 'all', label: 'All Relations' },
            { id: 'subClassOf', label: 'Class Hierarchy (rdfs:subClassOf)' },
            { id: 'hasComponent', label: 'Pen Components (hasComponent)' },
            { id: 'hasCharacteristic', label: 'Pen Characteristics' },
            { id: 'individuals', label: 'Individuals & Assertions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabRelation(tab.id as any)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                activeTabRelation === tab.id
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-1.5 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={showEdgeLabels}
              onChange={(e) => setShowEdgeLabels(e.target.checked)}
              className="rounded text-indigo-600 ring-offset-background focus:ring-2 focus:ring-ring"
            />
            Show Relation Labels
          </label>
          {pinnedNodes.size > 0 && (
            <button
              onClick={clearAllPins}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition font-medium text-xs"
            >
              <Pin className="h-3.5 w-3.5 rotate-45" />
              Release Pins ({pinnedNodes.size})
            </button>
          )}
        </div>
      </div>

      {/* Physics / simulation toolbar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-100 dark:bg-slate-900/60 px-4 py-1.5 border-b border-slate-200 dark:border-slate-800 gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            <span className="font-medium mr-1.5">Forces:</span>
            <label className="flex items-center gap-1">
              Repulsion:
              <input
                type="range"
                min="-600"
                max="-50"
                step="20"
                value={chargeStrength}
                onChange={(e) => setChargeStrength(Number(e.target.value))}
                className="w-20 cursor-pointer h-1 bg-slate-350 rounded-lg appearance-none"
              />
            </label>
            <label className="flex items-center gap-1 ml-2">
              Link Distance:
              <input
                type="range"
                min="60"
                max="250"
                step="10"
                value={linkDistance}
                onChange={(e) => setLinkDistance(Number(e.target.value))}
                className="w-20 cursor-pointer h-1 bg-slate-350 rounded-lg appearance-none"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Resume Physics" : "Pause Physics"}
            className={`p-1 rounded-md transition ${
              isPaused 
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          
          <button
            onClick={() => {
              if (simulationRef.current) {
                // Pin release
                simNodes.forEach(n => { n.fx = null; n.fy = null; });
                setPinnedNodes(new Set());
                simulationRef.current.alpha(1).restart();
              }
            }}
            title="Recalculate layout"
            className="p-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <span className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Zoom & Center"
            className="p-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas SVG */}
      <div 
        ref={containerRef}
        className="flex-1 w-full relative h-[480px] bg-slate-50 dark:bg-slate-900/40 select-none cursor-grab"
      >
        {simNodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <EyeOff className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-2 animate-bounce" />
            <p className="text-sm font-semibold text-slate-500">No nodes visible</p>
            <p className="text-xs max-w-sm mt-1">Try enabling node type filters in the left sidebar or select alternative relation filters above.</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="outline-none"
          >
            {/* Transparent background rect to capture pan & zoom click-drags on empty space */}
            <rect width="100%" height="100%" fill="transparent" pointerEvents="all" />

            {/* Markers Definitions for Arrows */}
            <defs>
              <marker
                id="arrow-generic"
                viewBox="0 -5 10 10"
                refX="26"
                refY="0"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0,-4 L10,0 L0,4" className="fill-slate-400 dark:fill-slate-600" />
              </marker>

              <marker
                id="arrow-subclass"
                viewBox="0 -5 10 10"
                refX="28"
                refY="0"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M0,-4 L10,0 L0,4 Z" className="fill-none stroke-slate-700 dark:stroke-slate-300 stroke-1 bg-white dark:bg-slate-900" style={{ fill: 'currentColor' }} />
              </marker>

              <marker
                id="arrow-highlighted"
                viewBox="0 -5 10 10"
                refX="28"
                refY="0"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M0,-4 L10,0 L0,4" className="fill-indigo-600" />
              </marker>

              <marker
                id="arrow-equivalent"
                viewBox="0 -5 10 10"
                refX="24"
                refY="0"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,-3 L8,0 L0,3" className="fill-violet-400" />
              </marker>

              <marker
                id="arrow-typeof"
                viewBox="0 -5 10 10"
                refX="25"
                refY="0"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0,-4 L10,0 L0,4" className="fill-amber-600" />
              </marker>

              <marker
                id="arrow-special"
                viewBox="0 -5 10 10"
                refX="26"
                refY="0"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0,-4 L10,0 L0,4" className="fill-teal-600" />
              </marker>
            </defs>

            {/* Content Group (Scales with Zoom and Pan) */}
            <g transform={zoomTransform.toString()}>
              {/* Lines (Links) */}
              <g className="links-layer">
                {simLinks.map((link) => {
                  const sourceNode = typeof link.source === 'object' ? link.source : null;
                  const targetNode = typeof link.target === 'object' ? link.target : null;
                  
                  if (!sourceNode || !targetNode) return null;

                  const sourceId = sourceNode.id;
                  const targetId = targetNode.id;
                  
                  const active = hoveredNodeId || selectedNodeId;
                  const isRelatedHovered = active === sourceId || active === targetId;
                  const dimmLink = active && !isRelatedHovered;

                  const { strokeClass, marker, strokeDash } = getLinkStyle(link.type, !!isRelatedHovered);

                  // Calculate connection point coordinates
                  const x1 = (sourceNode.x !== undefined && !isNaN(sourceNode.x)) ? sourceNode.x : 0;
                  const y1 = (sourceNode.y !== undefined && !isNaN(sourceNode.y)) ? sourceNode.y : 0;
                  const x2 = (targetNode.x !== undefined && !isNaN(targetNode.x)) ? targetNode.x : 0;
                  const y2 = (targetNode.y !== undefined && !isNaN(targetNode.y)) ? targetNode.y : 0;

                  return (
                    <g key={link.id} className={`transition-opacity duration-200 ${dimmLink ? 'opacity-20' : 'opacity-100'}`}>
                      <path
                        d={`M${x1},${y1} L${x2},${y2}`}
                        className={`fill-none ${strokeClass}`}
                        strokeDasharray={strokeDash}
                        markerEnd={marker}
                      />
                      
                      {/* Connection Labels */}
                      {showEdgeLabels && (
                        <foreignObject
                          x={(x1 + x2) / 2 - 50}
                          y={(y1 + y2) / 2 - 10}
                          width="100"
                          height="20"
                          className="pointer-events-none"
                        >
                          <div className="flex items-center justify-center w-full h-full">
                            <span className="text-[9px] px-1 py-0.5 max-w-full truncate bg-white/90 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 font-mono rounded border border-slate-200/55 dark:border-slate-800 shadow-sm leading-none">
                              {link.label}
                            </span>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Intersecting Nodes */}
              <g className="nodes-layer">
                {simNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  
                  // Highlight check
                  const isActiveScope = hoveredNodeId || selectedNodeId;
                  const isDirectlyConnected = connectedNodeIds.has(node.id);
                  const isDimmed = isActiveScope && !isDirectlyConnected;

                  const shapeInfo = getNodeShape(node.type);
                  const radius = shapeInfo.r || 15;
                  const x = (node.x !== undefined && !isNaN(node.x)) ? node.x : 0;
                  const y = (node.y !== undefined && !isNaN(node.y)) ? node.y : 0;

                  const nodeColorClass = getNodeColor(node.type, isSelected, isHovered);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x}, ${y})`}
                      className={`cursor-pointer transition-opacity duration-200 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(node.id);
                      }}
                      onMouseEnter={() => onHoverNode(node.id)}
                      onMouseLeave={() => onHoverNode(null)}
                      onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    >
                      {/* Ambient hover glow ring */}
                      {(isHovered || isSelected) && (
                        <circle
                          r={radius + 7}
                          className="fill-indigo-500/10 dark:fill-indigo-400/15 animate-pulse stroke-indigo-400/20"
                          strokeWidth="1"
                        />
                      )}

                      {/* Render custom shape based on Node Type */}
                      {shapeInfo.shape === 'circle' && (
                        <circle
                          r={radius}
                          className={`${nodeColorClass} ${shapeInfo.classes} shadow-sm transition`}
                        />
                      )}

                      {shapeInfo.shape === 'rect-round' && (
                        <rect
                          x={-shapeInfo.w! / 2}
                          y={-shapeInfo.h! / 2}
                          width={shapeInfo.w}
                          height={shapeInfo.h}
                          rx={6}
                          ry={6}
                          className={`${nodeColorClass} ${shapeInfo.classes} shadow-sm transition`}
                        />
                      )}

                      {shapeInfo.shape === 'diamond' && (
                        <polygon
                          points={`0,${-radius * 1.25} ${radius * 1.25},0 0,${radius * 1.25} ${-radius * 1.25},0`}
                          className={`${nodeColorClass} ${shapeInfo.classes} shadow-sm transition`}
                        />
                      )}

                      {shapeInfo.shape === 'hexagon' && (
                        <polygon
                          points={(() => {
                            const pts = [];
                            for (let i = 0; i < 6; i++) {
                              const angle = (Math.PI / 3) * i;
                              pts.push(`${Math.sin(angle) * radius},${Math.cos(angle) * radius}`);
                            }
                            return pts.join(' ');
                          })()}
                          className={`${nodeColorClass} ${shapeInfo.classes} shadow-sm transition`}
                        />
                      )}

                      {/* Small pin emblem indicator in node top right */}
                      {pinnedNodes.has(node.id) && (
                        <g transform={`translate(${radius - 3}, ${-radius + 3})`} onClick={(e) => togglePinNode(node.id, e)}>
                          <circle r={7} className="fill-rose-500 stroke-white stroke-1" />
                          <path
                            d="M-2,-2 L2,2 M2,-2 L-2,2"
                            className="stroke-white"
                            strokeWidth="1.2"
                          />
                        </g>
                      )}

                      {/* Icon inside Node based on type */}
                      <g className="pointer-events-none opacity-80" transform="translate(0, 0)">
                        {node.type === 'class' && (
                          <circle r="3" className="fill-slate-600 dark:fill-slate-300" />
                        )}
                        {node.type === 'individual' && (
                          <polygon points="0,-4 1.2,-1.2 4,-1.2 1.8,0.8 2.6,3.6 0,2 -2.6,3.6 -1.8,0.8 -4,-1.2 -1.2,-1.2" className="fill-amber-600 dark:fill-amber-300" />
                        )}
                        {node.type === 'objectProperty' && (
                          <path d="M-3,0 L3,0 M0,-3 L0,3" className="stroke-teal-600 dark:stroke-teal-300" strokeWidth="1.5" />
                        )}
                        {node.type === 'datatypeProperty' && (
                          <text y="3" textAnchor="middle" className="font-mono text-[8px] fill-indigo-700 dark:fill-indigo-300 font-bold">123</text>
                        )}
                      </g>

                      {/* Node Text Label */}
                      <text
                        y={radius + 15}
                        textAnchor="middle"
                        className={`text-[11px] font-sans font-medium pointer-events-none select-none ${
                          isSelected 
                            ? 'fill-blue-600 dark:fill-blue-400 font-semibold' 
                            : 'fill-slate-700 dark:fill-slate-300'
                        }`}
                      >
                        {node.localName}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}
      </div>

      {/* Mini Legend Footer */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="font-medium mr-1.5 text-slate-400 text-xs">Type Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full bg-slate-100 border-2 border-slate-700 dark:bg-slate-800 dark:border-slate-300" />
          <span>Class</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rotate-45 border-2 border-teal-700 bg-teal-50 dark:bg-teal-950 dark:border-teal-400" />
          <span>Object Property</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-md border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400" />
          <span>Data Property</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded-sm border-2 border-amber-700 bg-amber-50 dark:bg-amber-950 dark:border-amber-400" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }} />
          <span>Individual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3.2 w-3.2 rounded-full border border-dashed border-purple-600 bg-purple-50 dark:bg-purple-950 dark:border-purple-400" />
          <span>Restriction</span>
        </div>
      </div>
    </div>
  );
}
