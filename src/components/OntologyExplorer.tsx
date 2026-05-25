/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Search, Folder, Key, Award, AlertCircle, Sparkles, Filter, ChevronRight, X } from 'lucide-react';
import { OntologyNode, NodeType } from '../types';

interface OntologyExplorerProps {
  nodes: OntologyNode[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  nodeTypesVisibility: Record<NodeType, boolean>;
  onToggleTypeVisibility: (type: NodeType) => void;
}

export default function OntologyExplorer({
  nodes,
  selectedNodeId,
  onSelectNode,
  nodeTypesVisibility,
  onToggleTypeVisibility,
}: OntologyExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSegmentFilter, setActiveSegmentFilter] = useState<'all' | 'class' | 'objectProperty' | 'datatypeProperty' | 'individual'>('all');

  // Filter and sort the nodes based on search and active segment
  const sortedAndFilteredNodes = useMemo(() => {
    let list = nodes.filter((node) => {
      // Exclude restriction nodes from lists to keep cleaner
      if (node.type === 'restriction') return false;

      // Filter by segment
      if (activeSegmentFilter !== 'all' && node.type !== activeSegmentFilter) return false;

      // Filter by search query (checks localName or comment)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = node.localName.toLowerCase().includes(query);
        const matchesComment = node.comment && node.comment.toLowerCase().includes(query);
        return matchesName || matchesComment;
      }

      return true;
    });

    // Sort alphabetically by localName
    return list.sort((a, b) => a.localName.localeCompare(b.localName));
  }, [nodes, searchQuery, activeSegmentFilter]);

  // Compute counts for badging
  const tabCounts = useMemo(() => {
    const counts = { all: 0, class: 0, objectProperty: 0, datatypeProperty: 0, individual: 0 };
    nodes.forEach((n) => {
      if (n.type === 'restriction') return;
      counts.all++;
      if (n.type in counts) {
        counts[n.type as keyof typeof counts]++;
      }
    });
    return counts;
  }, [nodes]);

  const getNodeTypeIcon = (type: NodeType) => {
    switch (type) {
      case 'class':
        return <Folder className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
      case 'objectProperty':
        return <Key className="h-3.5 w-3.5 text-teal-500 shrink-0" />;
      case 'datatypeProperty':
        return <Key className="h-3.5 w-3.5 text-indigo-500 shrink-0" />;
      case 'individual':
        return <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
    }
  };

  const getThemeBorderColor = (type: NodeType, isSelected: boolean) => {
    if (isSelected) return 'border-l-4 border-l-blue-600 bg-blue-50/45 dark:bg-blue-950/25 border-slate-200 dark:border-slate-800';
    return 'border-l-4 border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-250 dark:border-slate-800';
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm" id="ontology-explorer-root">
      
      {/* Search Bar section */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-250 dark:border-slate-800 space-y-2.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block select-none">
          Search Components
        </label>
        
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Type a class, concept name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Segment controls filters */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-nowrap bg-white dark:bg-slate-950 px-2 py-1 select-none gap-0.5 custom-scrollbar">
        {[
          { id: 'all', label: 'All', count: tabCounts.all },
          { id: 'class', label: 'Classes', count: tabCounts.class },
          { id: 'objectProperty', label: 'Object Props', count: tabCounts.objectProperty },
          { id: 'datatypeProperty', label: 'Data Props', count: tabCounts.datatypeProperty },
          { id: 'individual', label: 'Individuals', count: tabCounts.individual },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSegmentFilter(tab.id as any)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all shrink-0 ${
              activeSegmentFilter === tab.id
                ? 'bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-700'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[9px] font-bold font-mono px-1 rounded-sm ${
              activeSegmentFilter === tab.id ? 'bg-white dark:bg-slate-900 text-slate-600' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Visibility Checkbox Layers list */}
      <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Graph Nodes Visibility:</span>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-350">
          {[
            { id: 'class', label: 'Classes' },
            { id: 'objectProperty', label: 'Object Properties' },
            { id: 'datatypeProperty', label: 'Data Properties' },
            { id: 'individual', label: 'Individuals' },
          ].map((type) => (
            <label key={type.id} className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
              <input
                type="checkbox"
                checked={nodeTypesVisibility[type.id as NodeType]}
                onChange={() => onToggleTypeVisibility(type.id as NodeType)}
                className="rounded border-slate-300 text-indigo-600 ring-offset-background focus:ring-2 focus:ring-ring"
              />
              {type.label}
            </label>
          ))}
        </div>
      </div>

      {/* Nodes list results */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 custom-scrollbar bg-slate-50/10 dark:bg-slate-950/20">
        {sortedAndFilteredNodes.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Filter className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <p className="text-xs font-semibold">No Search Results Found</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] mx-auto">Try entering alternative keywords or modifying the segment tabs.</p>
          </div>
        ) : (
          sortedAndFilteredNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            return (
              <button
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className={`w-full text-left p-3 flex items-start gap-2.5 border-b border-slate-100 dark:border-slate-900 transition-all ${getThemeBorderColor(node.type, isSelected)}`}
              >
                {/* Node icon */}
                <span className="mt-0.5 shrink-0">
                  {getNodeTypeIcon(node.type)}
                </span>
                
                {/* Text fields */}
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                      {node.localName}
                    </span>
                    <ChevronRight className={`h-3 w-3 shrink-0 text-slate-350 transition ${isSelected ? 'translate-x-1 text-slate-500' : ''}`} />
                  </div>
                  
                  {node.comment ? (
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 truncate select-none leading-relaxed">
                      {node.comment}
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-0.5 truncate font-mono select-none">
                      {node.id}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
