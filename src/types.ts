/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeType = 'class' | 'objectProperty' | 'datatypeProperty' | 'individual' | 'restriction' | 'root';

export interface OntologyNode {
  id: string; // The IRI or identifier
  localName: string; // E.g., "BallpointPen"
  namespace: string; // E.g., "http://example.com/BallpointPenOntology"
  type: NodeType;
  comment?: string;
  isCustom?: boolean;
  
  // Specific to individuals
  classTypes?: string[]; // Types (classes) of this individual
  propertyValues?: Array<{
    propertyUri: string;
    propertyName: string;
    value: string;
    isIndividual: boolean; // boolean indicating whether it links to another individual
  }>;

  // Specific to properties
  domains?: string[];
  ranges?: string[];
  subPropertyOf?: string[];
  isTransitive?: boolean;
  isFunctional?: boolean;

  // Superclasses and Equivalents
  superClasses?: string[];
  equivalentClasses?: string[];
  restrictions?: Array<{
    onProperty: string;
    propertyName: string;
    type: 'some' | 'all' | 'hasValue' | 'min' | 'max' | 'cardinality';
    value?: string; // class or individual or literal
    valueName?: string;
    raw?: string;
  }>;
  
  // RAW XML snippet representing this definition
  xmlSnippet?: string;
}

export interface OntologyLink {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  type: 'subClassOf' | 'equivalentClass' | 'subPropertyOf' | 'domain' | 'range' | 'typeOf' | 'hasValue' | 'someValuesFrom' | 'allValuesFrom' | 'hasComponent' | 'hasCharacteristic' | 'hasMake' | 'customRelation';
  label: string;
  isAssertion?: boolean; // directly declared vs inferred
}

// For use in D3 visual layouts (extends d3 interfaces)
export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  localName: string;
  type: NodeType;
  comment?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  size?: number;
  index?: number;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  label: string;
}

export interface ParsedOntology {
  ontologyRelativeId?: string;
  comment?: string;
  nodes: OntologyNode[];
  links: OntologyLink[];
}
