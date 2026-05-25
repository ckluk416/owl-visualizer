/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import OntologyExplorer from './components/OntologyExplorer';
import OntologyGraph from './components/OntologyGraph';
import OntologyDetailPanel from './components/OntologyDetailPanel';
import { parseOwlXml, splitIri } from './utils/OntologyParser';
import { DEFAULT_OWL_XML } from './data/defaultOntology';
import { NodeType, ParsedOntology } from './types';
import { Info, Sparkles, AlertCircle, RefreshCw, PenTool, HelpCircle, Layers } from 'lucide-react';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    // Read initial preference if any
    return typeof window !== 'undefined' ? document.documentElement.classList.contains('dark') : false;
  });

  const [xmlContent, setXmlContent] = useState<string>(DEFAULT_OWL_XML);
  const [fileName, setFileName] = useState<string>('PenaBallpoint.owl');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [nodeTypesVisibility, setNodeTypesVisibility] = useState<Record<NodeType, boolean>>({
    class: true,
    objectProperty: true,
    datatypeProperty: true,
    individual: true,
    restriction: true,
    root: true,
  });

  // Keep dark mode state in sync on DOM
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Perform parse with error boundary catching
  const parsedOntology = useMemo(() => {
    try {
      setParseError(null);
      return parseOwlXml(xmlContent);
    } catch (err: any) {
      setParseError(err.message || 'An error occurred while processing the ontology file.');
      return null;
    }
  }, [xmlContent]);

  const handleUploadXml = (content: string, name: string) => {
    setXmlContent(content);
    setFileName(name);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
  };

  const handleResetToDefault = () => {
    setXmlContent(DEFAULT_OWL_XML);
    setFileName('PenaBallpoint.owl');
    setSelectedNodeId(null);
    setHoveredNodeId(null);
  };

  const handleToggleTypeVisibility = (type: NodeType) => {
    setNodeTypesVisibility((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const selectedNode = useMemo(() => {
    if (!parsedOntology || !selectedNodeId) return null;
    return parsedOntology.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [parsedOntology, selectedNodeId]);

  // List of high-interest ballpoint concepts to show as quick recommendations
  const quickSearchPointers = [
    { name: 'BallpointPen', label: 'Pen Type (BallpointPen)', id: 'http://example.com/BallpointPenOntology/BallpointPen' },
    { name: 'BicCristal', label: 'Bic Cristal Pen', id: 'http://example.com/BallpointPenOntology/BicCristal' },
    { name: 'FisherSpacePen', label: 'Fisher Space Pen (Zero Gravity)', id: 'http://example.com/BallpointPenOntology/FisherSpacePen' },
    { name: 'hasComponent', label: 'Part Relation (hasComponent)', id: 'http://example.com/BallpointPenOntology/hasComponent' },
    { name: 'ExampleBallpointPen1', label: 'Sample Pen 1 (13.8mm Diameter)', id: 'http://example.com/BallpointPenOntology/ExampleBallpointPen1' },
    { name: 'RetractableMechanism', label: 'Retractable Mechanism', id: 'http://example.com/BallpointPenOntology/RetractableMechanism' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      
      {/* Header controls metadata */}
      <Header
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onUploadXml={handleUploadXml}
        onResetToDefault={handleResetToDefault}
        currentFileName={fileName}
      />

      {/* Main Grid Panels Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-4 flex flex-col gap-4">
        
        {/* Quick summary dashboard & description tip */}
        {parseError ? (
          <div className="p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="flex gap-3 items-start text-rose-800 dark:text-rose-300">
              <AlertCircle className="h-6 w-6 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm">OWL XML Parser Error</h3>
                <p className="text-xs mt-1 leading-relaxed max-w-2xl">{parseError}</p>
                <p className="text-[11px] text-rose-600/90 dark:text-rose-400 mt-1">The application only supports the standard Protégé XML format (RDF/XML Syntax). Please ensure the file is not corrupted.</p>
              </div>
            </div>
            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset to Default
            </button>
          </div>
        ) : (
          parsedOntology && (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs/60 flex flex-col gap-3">
              <div className="flex gap-2 items-start text-xs text-slate-600 dark:text-slate-300">
                <Info className="h-4.5 w-4.5 shrink-0 text-indigo-500 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mb-0.5">
                    Knowledge Model: {parsedOntology.ontologyRelativeId ? splitIri(parsedOntology.ontologyRelativeId).localName : 'Untitled'}
                  </p>
                  <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                    {parsedOntology.comment || 'No description (rdfs:comment) found on the ontology root element of this OWL file.'}
                  </p>
                </div>
              </div>

              {/* Quick Jump Shortcuts */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-150 dark:border-slate-850 pt-2.5 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-400 mr-1 select-none flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-indigo-500" />
                  Key Class/Individual Shortcuts:
                </span>
                {quickSearchPointers.map((pointer) => {
                  const isPresent = parsedOntology.nodes.some((n) => n.id === pointer.id);
                  if (!isPresent) return null; // Only show if is part of uploaded xml
                  const isCurSelected = selectedNodeId === pointer.id;

                  return (
                    <button
                      key={pointer.id}
                      onClick={() => setSelectedNodeId(pointer.id)}
                      className={`px-2 py-0.5 rounded border transition-all ${
                        isCurSelected
                          ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850'
                      }`}
                    >
                      {pointer.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* Triple Panel Layout Area */}
        {!parseError && parsedOntology && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            
            {/* Left Column: Explorer list (col-span-3) */}
            <div className="lg:col-span-3 flex flex-col h-[580px] lg:h-[650px] shrink-0">
              <OntologyExplorer
                nodes={parsedOntology.nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                nodeTypesVisibility={nodeTypesVisibility}
                onToggleTypeVisibility={handleToggleTypeVisibility}
              />
            </div>

            {/* Middle Column: Interactive Graph SVG (col-span-6) */}
            <div className="lg:col-span-6 flex flex-col h-[580px] lg:h-[650px]">
              <OntologyGraph
                nodes={parsedOntology.nodes}
                links={parsedOntology.links}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                hoveredNodeId={hoveredNodeId}
                onHoverNode={setHoveredNodeId}
                nodeTypesVisibility={nodeTypesVisibility}
              />
            </div>

            {/* Right Column: Detailed Node Inspector (col-span-3) */}
            <div className="lg:col-span-3 flex flex-col h-[580px] lg:h-[650px]">
              <OntologyDetailPanel
                selectedNode={selectedNode}
                nodesList={parsedOntology.nodes}
                linksList={parsedOntology.links}
                onSelectNode={setSelectedNodeId}
              />
            </div>

          </div>
        )}

      </main>

      {/* Subtle craft footer */}
      <footer className="mt-auto border-t border-slate-250 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 py-3 text-center text-[10px] text-slate-400 font-mono tracking-wider select-none">
        OWL ONTOLOGY GRAPH READER • STANFORD PROTEGE INTELLIGENT COMPATIBLE
      </footer>

    </div>
  );
}
