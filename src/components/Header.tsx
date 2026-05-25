/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Upload, FileDown, Sun, Moon, HelpCircle, Sparkles, RefreshCcw, BookOpen, AlertCircle, Info, Layers } from 'lucide-react';
import { DEFAULT_OWL_XML } from '../data/defaultOntology';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onUploadXml: (xmlContent: string, fileName: string) => void;
  onResetToDefault: () => void;
  currentFileName: string;
}

export default function Header({
  darkMode,
  onToggleDarkMode,
  onUploadXml,
  onResetToDefault,
  currentFileName,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      onUploadXml(text, file.name);
    };
    reader.readAsText(file);
  };

  const triggerUploadInput = () => {
    fileInputRef.current?.click();
  };

  // Drag and drop XML
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Check extension
    if (file.name.endsWith('.owl') || file.name.endsWith('.xml') || file.name.endsWith('.rdf')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        onUploadXml(text, file.name);
      };
      reader.readAsText(file);
    } else {
      alert('Please upload a file in .owl, .xml, or .rdf format carrying Protégé ontology data.');
    }
  };

  return (
    <header 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-b border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all relative ${
        isDragging ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''
      }`}
      id="main-app-header"
    >
      {/* drag overlay tip */}
      {isDragging && (
        <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none flex items-center justify-center border-2 border-dashed border-indigo-500 animate-pulse z-50 rounded-b-xl">
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-sans">
            Drop OWL file here to instantly process the graph visualization!
          </p>
        </div>
      )}

      {/* Main title & info metadata */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Layers className="h-5.5 w-5.5 animate-bounce" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold font-sans tracking-tight text-slate-850 dark:text-slate-100 leading-none">
              OWL Ontology Graph Visualizer
            </h1>
            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              XML Protégé Reader v1.0
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-none font-medium">
            Active file: <span className="font-semibold text-slate-700 dark:text-slate-300 italic">{currentFileName}</span>
          </p>
        </div>
      </div>

      {/* Control Actions buttons list */}
      <div className="flex flex-wrap items-center gap-2.5">
        
        {/* Reset to Default */}
        {currentFileName !== 'PenaBallpoint.owl' && (
          <button
            onClick={onResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
            title="Return to the default ballpoint pen ontology"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>Reset to Default</span>
          </button>
        )}

        {/* Upload Custom OWL Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".owl,.xml,.rdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={triggerUploadInput}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm hover:shadow-xs cursor-pointer"
          title="Upload standard export files"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Upload OWL / XML</span>
        </button>

        <span className="h-5 w-px bg-slate-250 dark:bg-slate-800 hidden sm:block" />

        {/* Dark Mode toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-slate-500 dark:text-slate-400 transition cursor-pointer"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </button>

        {/* Help Modal trigger */}
        <button
          onClick={() => setShowHelpModal(true)}
          className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-slate-500 dark:text-slate-400 transition cursor-pointer"
          title="OWL File Structure Help"
        >
          <HelpCircle className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Help Modal Dialog overlay */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
            
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-250 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-250">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold">OWL Structure & Ontology Guide</h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-sans font-semibold cursor-pointer"
              >
                [Close]
              </button>
            </div>

            {/* Modal content list */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-350 leading-relaxed custom-scrollbar">
              <div className="flex gap-2">
                <Info className="h-4.5 w-4.5 shrink-0 text-indigo-500 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mb-0.5">What is an OWL (Protégé) File?</p>
                  <p>
                    An OWL (Web Ontology Language) file exported from Stanford Protégé is typically structured in RDF/XML syntax. This application parses and visualizes top-level ontology constructs, including:
                  </p>
                </div>
              </div>

              <div className="pl-6 space-y-2.5 border-l border-slate-200 dark:border-slate-800">
                <div>
                  <p className="font-bold text-slate-750 dark:text-slate-200 mb-0.5">1. OWL Class</p>
                  <p>Defines abstract concepts or categories (e.g. <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.2 rounded font-mono">BallpointPen</code>, <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.2 rounded font-mono">PenComponent</code>). Hierarchy relationships are represented as lines directed towards the parent superclass (<code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.2 rounded font-mono">subClassOf</code>).</p>
                </div>
                <div>
                  <p className="font-bold text-slate-750 dark:text-slate-200 mb-0.5">2. Object Property</p>
                  <p>Specifies relationships connecting individuals/instances (e.g. "a pen has a component socket", "a pen is composed of ink"). These are colored teal/blue in the graph visualization.</p>
                </div>
                <div>
                  <p className="font-bold text-slate-750 dark:text-slate-200 mb-0.5">3. Named Individual</p>
                  <p>Represents concrete instances or real-world entities (e.g. a specific BicCristal pen instance). These are depicted as orange/gold hexagons in the graph.</p>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/40 space-y-1">
                <span className="font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Flexible Upload Formats
                </span>
                <p className="text-[11px] text-indigo-800/85 dark:text-indigo-400">
                  You can upload your own Protégé export files carrying <code className="font-mono bg-white dark:bg-slate-900 border px-1 py-0.2 rounded">.owl</code>, <code className="font-mono bg-white dark:bg-slate-900 border px-1 py-0.2 rounded">.rdf</code> or <code className="font-mono bg-white dark:bg-slate-900 border px-1 py-0.2 rounded">.xml</code> structures. Simply Drag & Drop any file onto the header bar to immediately render its contents!
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="border-t border-slate-250 dark:border-slate-800 p-3.5 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-lg hover:opacity-90 cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </header>
  );
}
