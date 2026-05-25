/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, FileText, Code, Network, BookOpen, AlertCircle, Sparkles, Hash, Layers } from 'lucide-react';
import { OntologyNode, OntologyLink, NodeType } from '../types';
import { splitIri } from '../utils/OntologyParser';

interface OntologyDetailPanelProps {
  selectedNode: OntologyNode | null;
  nodesList: OntologyNode[];
  linksList: OntologyLink[];
  onSelectNode: (nodeId: string) => void;
}

export default function OntologyDetailPanel({
  selectedNode,
  nodesList,
  linksList,
  onSelectNode,
}: OntologyDetailPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'xml'>('info');
  const [copied, setCopied] = useState(false);

  const handleCopyXml = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nodeStats = React.useMemo(() => {
    const stats = {
      classes: 0,
      objectProps: 0,
      datatypeProps: 0,
      individuals: 0,
      restrictions: 0,
    };
    nodesList.forEach((n) => {
      if (n.type === 'class') stats.classes++;
      else if (n.type === 'objectProperty') stats.objectProps++;
      else if (n.type === 'datatypeProperty') stats.datatypeProps++;
      else if (n.type === 'individual') stats.individuals++;
      else if (n.type === 'restriction') stats.restrictions++;
    });
    return stats;
  }, [nodesList]);

  // Find relationships connected to selected node
  const relationDetails = React.useMemo(() => {
    if (!selectedNode) return null;

    const id = selectedNode.id;
    const incoming: Array<{ node: OntologyNode; link: OntologyLink }> = [];
    const outgoing: Array<{ node: OntologyNode; link: OntologyLink }> = [];

    linksList.forEach((link) => {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as any).id;

      if (srcId === id) {
        const targetNode = nodesList.find((n) => n.id === tgtId);
        if (targetNode) outgoing.push({ node: targetNode, link });
      }
      if (tgtId === id) {
        const sourceNode = nodesList.find((n) => n.id === srcId);
        if (sourceNode) incoming.push({ node: sourceNode, link });
      }
    });

    return { incoming, outgoing };
  }, [selectedNode, nodesList, linksList]);

  const getNodeTypeName = (type: NodeType) => {
    switch (type) {
      case 'class': return 'OWL Class';
      case 'objectProperty': return 'Object Property';
      case 'datatypeProperty': return 'Datatype Property';
      case 'individual': return 'Named Individual';
      case 'restriction': return 'Restriction';
      default: return 'Ontology Component';
    }
  };

  const getBadgeColor = (type: NodeType) => {
    switch (type) {
      case 'class': return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-850 dark:text-slate-250';
      case 'objectProperty': return 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300';
      case 'datatypeProperty': return 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300';
      case 'individual': return 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300';
      default: return 'bg-gray-100 text-gray-850 dark:bg-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm" id="detail-panel-root">
      
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-slate-400" />
          Inspector Details
        </h2>
        
        {selectedNode && (
          <div className="flex p-0.5 bg-slate-200/60 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveSubTab('info')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition text-slate-800 dark:text-white"
            >
              <FileText className="h-3.5 w-3.5" />
              Relation Info
            </button>
            <button
              onClick={() => setActiveSubTab('xml')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition text-slate-500 dark:text-slate-400 hover:text-slate-755"
            >
              <Code className="h-3.5 w-3.5" />
              Raw XML
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {!selectedNode ? (
          /* DEFAULT VIEW - ONTOLOGY METADATA / STATS INDEX */
          <div className="h-full flex flex-col justify-center py-6 text-center text-slate-500 dark:text-slate-400">
            <Layers className="h-10 w-10 text-indigo-500 mx-auto mb-3 animate-pulse" />
            
            <h3 className="font-semibold text-slate-800 dark:text-slate-250 text-base mb-1">
              Explore Ballpoint Pen Ontology
            </h3>
            <p className="text-xs max-w-xs mx-auto text-slate-400 leading-relaxed mb-6">
              Select a class, property relationship, or individual from the interactive graph or explorer list to inspect its semantic connections and raw XML source.
            </p>

            <div className="grid grid-cols-2 gap-2 text-left max-w-sm mx-auto">
              {[
                { label: 'Classes', count: nodeStats.classes, color: 'bg-slate-100 border-slate-250 dark:bg-slate-850 dark:border-slate-800' },
                { label: 'Object Properties', count: nodeStats.objectProps, color: 'bg-teal-50 border-teal-200 dark:bg-teal-950 dark:border-teal-900' },
                { label: 'Data Properties', count: nodeStats.datatypeProps, color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-900' },
                { label: 'Individuals', count: nodeStats.individuals, color: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900' },
              ].map((stat) => (
                <div key={stat.label} className={`p-2.5 rounded-lg border ${stat.color} flex flex-col gap-0.5`}>
                  <span className="text-[10px] text-slate-400 font-medium uppercase">{stat.label}</span>
                  <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{stat.count}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 p-3 rounded-lg border border-indigo-200 bg-indigo-50/45 dark:border-indigo-900/40 dark:bg-indigo-950/20 text-left text-xs text-indigo-900 dark:text-indigo-300 flex gap-2 max-w-sm mx-auto">
              <Sparkles className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Navigation Tips:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-indigo-800/85 dark:text-indigo-400/85">
                  <li>Drag nodes to rearrange the graph layout manually</li>
                  <li>Scroll/pinch over the canvas to zoom in and out</li>
                  <li>Click relationship shortcuts or segments to filter the view</li>
                </ul>
              </div>
            </div>
          </div>
        ) : activeSubTab === 'info' ? (
          /* SUBTAB - INFO DETAIL & HUBUNGAN */
          <div className="space-y-4">
            
            {/* Header Node Info */}
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 border rounded ${getBadgeColor(selectedNode.type)}`}>
                  {getNodeTypeName(selectedNode.type)}
                </span>
                {selectedNode.isFunctional && (
                  <span className="text-[9px] uppercase font-mono border border-orange-200 bg-orange-50 text-orange-700 px-1.5 rounded dark:bg-orange-950 dark:text-orange-300">
                    Functional
                  </span>
                )}
                {selectedNode.isTransitive && (
                  <span className="text-[9px] uppercase font-mono border border-teal-200 bg-teal-50 text-teal-700 px-1.5 rounded dark:bg-teal-950 dark:text-teal-300">
                    Transitive
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white break-all flex items-center gap-1">
                {selectedNode.localName}
              </h1>
              <p className="text-[10px] font-mono text-slate-400 truncate mt-1 select-all" title={selectedNode.id}>
                IRI Base: {splitIri(selectedNode.id).namespace}
              </p>
            </div>

            {/* deskripsi comment */}
            {selectedNode.comment && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-350 leading-relaxed italic">
                "{selectedNode.comment}"
              </div>
            )}

            {/* Class Type Specifics (E.g. Class restrictions & superclasses) */}
            {selectedNode.type === 'class' && (
              <div className="space-y-3 pt-1">
                {/* Superclasses */}
                {selectedNode.superClasses && selectedNode.superClasses.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Superclasses</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.superClasses.map((scUri) => {
                        const sLabel = splitIri(scUri).localName;
                        return (
                          <button
                            key={scUri}
                            onClick={() => onSelectNode(scUri)}
                            className="text-xs px-2 py-1 border border-slate-200 hover:border-indigo-400 dark:border-slate-800 dark:hover:border-indigo-500 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-medium transition"
                          >
                            {sLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Restrictions List */}
                {selectedNode.restrictions && selectedNode.restrictions.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Restrictions</h4>
                    <div className="space-y-1.5">
                      {selectedNode.restrictions.map((restr, index) => {
                        const targetLabel = restr.valueName || 'Anonymous';
                        const propLabel = restr.propertyName;
                        return (
                          <div key={index} className="flex items-start justify-between p-2 rounded-lg bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-700 dark:text-slate-350 leading-relaxed">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-500 mr-1 select-none font-mono">
                                ↳ {propLabel}
                              </span>
                              <span className="px-1 py-0.2 bg-indigo-100 text-indigo-700 text-[10px] font-medium rounded mr-1.5 dark:bg-indigo-900/50 dark:text-indigo-300 uppercase scale-90">
                                {restr.type === 'some' ? 'some' : restr.type === 'all' ? 'only' : restr.type === 'hasValue' ? 'value' : restr.type}
                              </span>
                              {restr.value && restr.value.startsWith('http') ? (
                                <button
                                  onClick={() => onSelectNode(restr.value!)}
                                  className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium break-all text-left"
                                >
                                  {targetLabel}
                                </button>
                              ) : (
                                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono break-all">{targetLabel}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Individual Specifics (Property Assertions) */}
            {selectedNode.type === 'individual' && (
              <div className="space-y-3">
                {selectedNode.classTypes && selectedNode.classTypes.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class Types</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.classTypes.map((clsUri) => (
                        <button
                          key={clsUri}
                          onClick={() => onSelectNode(clsUri)}
                          className="text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 dark:hover:border-amber-500 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-medium transition underline decoration-dashed decoration-amber-400/50"
                        >
                          {splitIri(clsUri).localName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNode.propertyValues && selectedNode.propertyValues.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Property Assertions</h4>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                      {selectedNode.propertyValues.map((assertion, index) => (
                        <div key={index} className="flex flex-col p-2 text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350">
                          <span className="text-[10px] font-mono text-slate-400 block mb-0.5 font-bold">
                            {assertion.propertyName}
                          </span>
                          {assertion.isIndividual ? (
                            <button
                              onClick={() => onSelectNode(assertion.value)}
                              className="text-left font-medium text-amber-600 dark:text-amber-400 hover:underline break-all"
                            >
                              {splitIri(assertion.value).localName}
                            </button>
                          ) : (
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50 w-fit">
                              {assertion.value}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Object/Data Property Domain & Range */}
            {(selectedNode.type === 'objectProperty' || selectedNode.type === 'datatypeProperty') && (
              <div className="space-y-3">
                {selectedNode.domains && selectedNode.domains.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 mt-1">Domain (Applies to Class)</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.domains.map((domUri) => (
                        <button
                          key={domUri}
                          onClick={() => onSelectNode(domUri)}
                          className="text-xs px-2 py-1 bg-teal-50/50 border border-teal-100 hover:border-teal-400 dark:bg-teal-950/20 dark:border-teal-900 rounded-md text-teal-800 dark:text-teal-300 transition"
                        >
                          {splitIri(domUri).localName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNode.ranges && selectedNode.ranges.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Range (Value or Result Type)</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.ranges.map((rngUri) => {
                        const pathLabel = splitIri(rngUri).localName;
                        const isClassNode = rngUri.startsWith('http') && !rngUri.includes('XMLSchema');
                        return isClassNode ? (
                          <button
                            key={rngUri}
                            onClick={() => onSelectNode(rngUri)}
                            className="text-xs px-2 py-1 bg-indigo-50/50 border border-indigo-150 hover:border-indigo-400 dark:bg-indigo-950/20 dark:border-indigo-900 rounded-md text-indigo-800 dark:text-indigo-300 transition"
                          >
                            {pathLabel}
                          </button>
                        ) : (
                          <span
                            key={rngUri}
                            className="text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 dark:bg-slate-850 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 font-mono font-medium"
                          >
                            {pathLabel}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Connected Network Relations lists */}
            {relationDetails && (relationDetails.incoming.length > 0 || relationDetails.outgoing.length > 0) && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Network className="h-3.5 w-3.5 text-indigo-500" />
                  Graph Relationships ({relationDetails.incoming.length + relationDetails.outgoing.length})
                </h4>

                {/* Outgoing relationships from selected node */}
                {relationDetails.outgoing.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 block uppercase">Outgoing (Points To)</span>
                    <div className="max-h-[140px] overflow-y-auto space-y-0.5 border border-slate-100 dark:border-slate-900 rounded-lg p-1.5 bg-slate-50/50 dark:bg-slate-950/50">
                      {relationDetails.outgoing.map((out, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded transition gap-2">
                          <span className="font-mono text-[10px] text-slate-400 shrink-0 font-bold">{out.link.label}</span>
                          <button
                            onClick={() => onSelectNode(out.node.id)}
                            className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 truncate underline decoration-dotted max-w-[60%]"
                          >
                            {out.node.localName}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Incoming relationships pointing to selected node */}
                {relationDetails.incoming.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 block uppercase">Incoming (Pointed By)</span>
                    <div className="max-h-[140px] overflow-y-auto space-y-0.5 border border-slate-100 dark:border-slate-900 rounded-lg p-1.5 bg-slate-50/50 dark:bg-slate-950/50">
                      {relationDetails.incoming.map((inc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded transition gap-2">
                          <button
                            onClick={() => onSelectNode(inc.node.id)}
                            className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 truncate underline decoration-dotted max-w-[60%]"
                          >
                            {inc.node.localName}
                          </button>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0 font-bold">← {inc.link.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        ) : (
          /* SUBTAB - RAW XML SNIPPET FROM FILE */
          <div className="relative h-full flex flex-col pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase font-sans">OWL XML Protégé Source</span>
              <button
                onClick={() => handleCopyXml(selectedNode.xmlSnippet || '')}
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy XML</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 bg-slate-900 dark:bg-black text-slate-300 p-3 rounded-lg border border-slate-800 overflow-auto font-mono text-[11px] leading-relaxed select-text shadow-inner">
              <pre className="whitespace-pre">{selectedNode.xmlSnippet || `<!-- No definition available -->`}</pre>
            </div>
            
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex gap-1 items-start leading-snug">
              <AlertCircle className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
              This is the original serialized XML representation (RDF/XML Syntax) parsed directly from the Protégé OWL ontology.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
