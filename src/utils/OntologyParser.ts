/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedOntology, OntologyNode, OntologyLink } from '../types';

export function splitIri(iri: string): { localName: string; namespace: string } {
  if (!iri) return { localName: 'Anonymous', namespace: '' };
  
  // Strip spaces
  iri = iri.trim();

  // If it is XML Schema or standard xmlns we can recognize them or just split
  let separatorIdx = iri.lastIndexOf('#');
  if (separatorIdx === -1) {
    separatorIdx = iri.lastIndexOf('/');
  }
  if (separatorIdx !== -1 && separatorIdx < iri.length - 1) {
    return {
      localName: iri.substring(separatorIdx + 1),
      namespace: iri.substring(0, separatorIdx + 1)
    };
  }
  return { localName: iri, namespace: '' };
}

// Extract string representation of an XML element for inspection
function getXmlSnippet(element: Element): string {
  try {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(element);
  } catch (error) {
    return 'Unavailable';
  }
}

export function parseOwlXml(xmlString: string): ParsedOntology {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  // Check for parser error
  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error('Gagal memproses file XML. Pastikan format OWL/XML valid.');
  }

  const nodesMap = new Map<string, OntologyNode>();
  const links: OntologyLink[] = [];

  // Helper inside parser to add nodes
  const addNode = (node: OntologyNode) => {
    const existing = nodesMap.get(node.id);
    if (existing) {
      // Merge properties if needed
      nodesMap.set(node.id, { ...existing, ...node });
    } else {
      nodesMap.set(node.id, node);
    }
  };

  // 1. Get Ontology Comment
  let ontologyComment = '';
  const ontologyEl = xmlDoc.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'Ontology') || 
                     xmlDoc.getElementsByTagName('owl:Ontology');
  if (ontologyEl && ontologyEl.length > 0) {
    const rdfsComment = ontologyEl[0].getElementsByTagNameNS('http://www.w3.org/2000/01/rdf-schema#', 'comment') || 
                        ontologyEl[0].getElementsByTagName('rdfs:comment');
    if (rdfsComment && rdfsComment.length > 0) {
      ontologyComment = rdfsComment[0].textContent || '';
    }
  }

  // Helper to extract about attribute
  const getAboutAttribute = (el: Element): string => {
    return el.getAttribute('rdf:about') || 
           el.getAttributeNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'about') || 
           '';
  };

  const getResourceAttribute = (el: Element): string => {
    return el.getAttribute('rdf:resource') || 
           el.getAttributeNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'resource') || 
           '';
  };

  // Parse standard base prefixes or URI
  let defaultBase = 'http://example.com/BallpointPenOntology#';
  const rdfRDF = xmlDoc.documentElement;
  if (rdfRDF) {
    const baseAttr = rdfRDF.getAttribute('xml:base');
    if (baseAttr) {
      defaultBase = baseAttr.endsWith('#') || baseAttr.endsWith('/') ? baseAttr : baseAttr + '#';
    }
  }

  // 2. Process Classes: owl:Class
  const classes = xmlDoc.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'Class');
  const fallbackClasses = xmlDoc.getElementsByTagName('owl:Class');
  const allClassElements = Array.from(classes).concat(Array.from(fallbackClasses).filter(el => !Array.from(classes).includes(el)));

  allClassElements.forEach((classEl) => {
    const about = getAboutAttribute(classEl);
    if (!about) return; // Skip anonymous classes for top-level nodes, though they might be in restrictions

    const { localName, namespace } = splitIri(about);
    
    // Extract comment
    const comments = classEl.getElementsByTagNameNS('http://www.w3.org/2000/01/rdf-schema#', 'comment');
    const commentsFallback = classEl.getElementsByTagName('rdfs:comment');
    let commentText = '';
    if (comments.length > 0) commentText = comments[0].textContent || '';
    else if (commentsFallback.length > 0) commentText = commentsFallback[0].textContent || '';

    const superClasses: string[] = [];
    const equivalentClasses: string[] = [];
    const restrictions: any[] = [];

    // Find children subclass relationships
    const children = Array.from(classEl.children);
    children.forEach((child) => {
      const tagName = child.localName || child.tagName;
      
      // rdfs:subClassOf
      if (tagName === 'subClassOf') {
        const resource = getResourceAttribute(child);
        if (resource) {
          superClasses.push(resource);
          // Add links directly
          links.push({
            id: `lnk_${localName}_subClassOf_${splitIri(resource).localName}`,
            source: about,
            target: resource,
            type: 'subClassOf',
            label: 'rdfs:subClassOf',
          });
        } else {
          // Check for subClassOf nested Restriction
          const restrictionEl = child.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'Restriction')[0] ||
                                child.getElementsByTagName('owl:Restriction')[0];
          if (restrictionEl) {
            parseRestriction(restrictionEl, about, restrictions, links, 'subClassOf');
          }
        }
      }

      // owl:equivalentClass
      if (tagName === 'equivalentClass') {
        const resource = getResourceAttribute(child);
        if (resource) {
          equivalentClasses.push(resource);
          links.push({
            id: `lnk_${localName}_equiv_${splitIri(resource).localName}`,
            source: about,
            target: resource,
            type: 'equivalentClass',
            label: 'owl:equivalentClass',
          });
        } else {
          // Intersection / Union logic or Restrictions inside EquivalentClass
          const innerClass = child.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'Class')[0] ||
                             child.getElementsByTagName('owl:Class')[0];
          
          if (innerClass) {
            // Check for owl:intersectionOf or owl:unionOf
            const intersectionOf = innerClass.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'intersectionOf')[0] ||
                                   innerClass.getElementsByTagName('owl:intersectionOf')[0];

            if (intersectionOf) {
              const descriptions = intersectionOf.getElementsByTagNameNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'Description');
              const descriptionsFallback = intersectionOf.getElementsByTagName('rdf:Description');
              const allDescs = Array.from(descriptions).concat(Array.from(descriptionsFallback));
              
              allDescs.forEach((d) => {
                const descAbout = getAboutAttribute(d);
                if (descAbout) {
                  equivalentClasses.push(descAbout);
                  links.push({
                    id: `lnk_${localName}_intersect_${splitIri(descAbout).localName}`,
                    source: about,
                    target: descAbout,
                    type: 'equivalentClass',
                    label: 'owl:equivalentClass (Intersection)',
                  });
                }
              });

              // Also check for Restrictions inside intersectionOf
              const innerRestrictions = intersectionOf.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'Restriction');
              const innerRestrictionsFallback = intersectionOf.getElementsByTagName('owl:Restriction');
              const allInnerRestr = Array.from(innerRestrictions).concat(Array.from(innerRestrictionsFallback));
              allInnerRestr.forEach((r) => {
                parseRestriction(r, about, restrictions, links, 'equivalentClass');
              });
            }
          }
        }
      }
    });

    addNode({
      id: about,
      localName,
      namespace,
      type: 'class',
      comment: commentText,
      superClasses,
      equivalentClasses,
      restrictions,
      xmlSnippet: getXmlSnippet(classEl),
    });
  });

  // Helper implementation to parse restrictions
  function parseRestriction(restrictionEl: Element, parentAbout: string, restrictionsList: any[], relationshipLinks: OntologyLink[], contextType: string) {
    const onPropertyEl = restrictionEl.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'onProperty')[0] ||
                         restrictionEl.getElementsByTagName('owl:onProperty')[0];
    if (!onPropertyEl) return;

    const propertyUri = getResourceAttribute(onPropertyEl);
    if (!propertyUri) return;

    const parentLocalName = splitIri(parentAbout).localName;
    const propLocalName = splitIri(propertyUri).localName;

    let restrictionType: 'some' | 'all' | 'hasValue' | 'min' | 'max' | 'cardinality' = 'some';
    let valueUri = '';
    let valueLocalName = '';

    // someValuesFrom
    const someValuesEl = restrictionEl.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'someValuesFrom')[0] ||
                         restrictionEl.getElementsByTagName('owl:someValuesFrom')[0];
    if (someValuesEl) {
      restrictionType = 'some';
      valueUri = getResourceAttribute(someValuesEl);
      if (!valueUri) {
        // Nested Datatype restriction e.g. float >= 13.5
        const datatypeEl = someValuesEl.getElementsByTagNameNS('http://www.w3.org/2000/01/rdf-schema#', 'Datatype')[0] ||
                           someValuesEl.getElementsByTagName('rdfs:Datatype')[0];
        if (datatypeEl) {
          const baseDatatype = datatypeEl.getAttributeNS('http://www.w3.org/2002/07/owl#', 'onDatatype') || 
                               datatypeEl.getAttribute('owl:onDatatype') || '';
          valueUri = baseDatatype;
          const { localName } = splitIri(baseDatatype);
          let limitStr = '';
          const minInclusive = datatypeEl.getElementsByTagNameNS('http://www.w3.org/2001/XMLSchema#', 'minInclusive')[0] ||
                               datatypeEl.getElementsByTagName('xsd:minInclusive')[0];
          if (minInclusive) {
            limitStr = `[>= ${minInclusive.textContent}]`;
          }
          valueLocalName = `${localName}${limitStr}`;
        }
      } else {
        valueLocalName = splitIri(valueUri).localName;
      }
    }

    // allValuesFrom
    const allValuesEl = restrictionEl.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'allValuesFrom')[0] ||
                        restrictionEl.getElementsByTagName('owl:allValuesFrom')[0];
    if (allValuesEl) {
      restrictionType = 'all';
      valueUri = getResourceAttribute(allValuesEl);
      if (!valueUri) {
        // Check for unionOf classes
        const unionEl = allValuesEl.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'unionOf')[0] ||
                        allValuesEl.getElementsByTagName('owl:unionOf')[0];
        if (unionEl) {
          const unionClasses = Array.from(unionEl.getElementsByTagNameNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'Description')).concat(
            Array.from(unionEl.getElementsByTagName('rdf:Description'))
          );
          const parts = unionClasses.map(u => splitIri(getResourceAttribute(u) || '').localName).filter(Boolean);
          valueLocalName = `(${parts.join(' ∪ ')})`;
          // Add links to each member class in the union
          unionClasses.forEach((u) => {
            const partUri = getResourceAttribute(u);
            if (partUri) {
              relationshipLinks.push({
                id: `lnk_restr_${parentLocalName}_${propLocalName}_all_${splitIri(partUri).localName}`,
                source: parentAbout,
                target: partUri,
                type: 'allValuesFrom',
                label: `все matching ${propLocalName}`,
              });
            }
          });
        }
      } else {
        valueLocalName = splitIri(valueUri).localName;
      }
    }

    // hasValue
    const hasValueEl = restrictionEl.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'hasValue')[0] ||
                       restrictionEl.getElementsByTagName('owl:hasValue')[0];
    if (hasValueEl) {
      restrictionType = 'hasValue';
      valueUri = getResourceAttribute(hasValueEl) || hasValueEl.textContent || '';
      valueLocalName = splitIri(valueUri).localName;
    }

    // minQualifiedCardinality / minCardinality
    const minCardEl = restrictionEl.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'minQualifiedCardinality')[0] ||
                      restrictionEl.getElementsByTagName('owl:minQualifiedCardinality')[0] ||
                      restrictionEl.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'minCardinality')[0] ||
                      restrictionEl.getElementsByTagName('owl:minCardinality')[0];
    if (minCardEl) {
      restrictionType = 'min';
      const count = minCardEl.textContent || '';
      const onClassEl = restrictionEl.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'onClass')[0] ||
                        restrictionEl.getElementsByTagName('owl:onClass')[0];
      const classUri = onClassEl ? getResourceAttribute(onClassEl) : '';
      valueUri = classUri;
      valueLocalName = `Min ${count} ${splitIri(classUri).localName}`;
    }

    restrictionsList.push({
      onProperty: propertyUri,
      propertyName: propLocalName,
      type: restrictionType,
      value: valueUri,
      valueName: valueLocalName,
      raw: getXmlSnippet(restrictionEl),
    });

    // Create a link if we have a valid target node
    if (valueUri && valueUri.startsWith('http')) {
      // Determine link type from propertyName
      let linkType: any = 'someValuesFrom';
      if (restrictionType === 'all') linkType = 'allValuesFrom';
      else if (restrictionType === 'hasValue') {
        if (propLocalName === 'hasCharacteristic') linkType = 'hasCharacteristic';
        else if (propLocalName === 'hasMake') linkType = 'hasMake';
        else linkType = 'hasValue';
      } else if (propLocalName === 'hasComponent') {
        linkType = 'hasComponent';
      }

      relationshipLinks.push({
        id: `lnk_r_${parentLocalName}_${propLocalName}_to_${splitIri(valueUri).localName}`,
        source: parentAbout,
        target: valueUri,
        type: linkType,
        label: propLocalName,
      });
    }
  }

  // 3. Process Object Properties: owl:ObjectProperty
  const objProperties = xmlDoc.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'ObjectProperty');
  const fallbackObjProps = xmlDoc.getElementsByTagName('owl:ObjectProperty');
  const allObjProperties = Array.from(objProperties).concat(Array.from(fallbackObjProps).filter(el => !Array.from(objProperties).includes(el)));

  allObjProperties.forEach((propEl) => {
    const about = getAboutAttribute(propEl);
    if (!about) return;

    const { localName, namespace } = splitIri(about);

    // Get subPropertyOf
    const subPropsList: string[] = [];
    const subPropertyOfEls = propEl.getElementsByTagNameNS('http://www.w3.org/2000/01/rdf-schema#', 'subPropertyOf');
    const subPropertyOfFallback = propEl.getElementsByTagName('rdfs:subPropertyOf');
    const allSubPropEls = Array.from(subPropertyOfEls).concat(Array.from(subPropertyOfFallback));
    
    allSubPropEls.forEach((subPel) => {
      const resource = getResourceAttribute(subPel);
      if (resource) {
        subPropsList.push(resource);
        links.push({
          id: `lnk_${localName}_subPropOf_${splitIri(resource).localName}`,
          source: about,
          target: resource,
          type: 'subPropertyOf',
          label: 'subPropertyOf',
        });
      }
    });

    // Get Domain
    const domainsList: string[] = [];
    const domainEls = propEl.getElementsByTagNameNS('http://www.w3.org/2000/01/rdf-schema#', 'domain');
    const domainFallback = propEl.getElementsByTagName('rdfs:domain');
    const allDomainEls = Array.from(domainEls).concat(Array.from(domainFallback));
    allDomainEls.forEach((domEl) => {
      const resource = getResourceAttribute(domEl);
      if (resource) {
        domainsList.push(resource);
        links.push({
          id: `lnk_${localName}_domain_${splitIri(resource).localName}`,
          source: about,
          target: resource,
          type: 'domain',
          label: 'rdfs:domain',
        });
      }
    });

    // Get Range
    const rangesList: string[] = [];
    const rangeEls = propEl.getElementsByTagNameNS('http://www.w3.org/2000/01/rdf-schema#', 'range');
    const rangeFallback = propEl.getElementsByTagName('rdfs:range');
    const allRangeEls = Array.from(rangeEls).concat(Array.from(rangeFallback));
    allRangeEls.forEach((rngEl) => {
      const resource = getResourceAttribute(rngEl);
      if (resource) {
        rangesList.push(resource);
        links.push({
          id: `lnk_${localName}_range_${splitIri(resource).localName}`,
          source: about,
          target: resource,
          type: 'range',
          label: 'rdfs:range',
        });
      }
    });

    // Characteristics (Transitive, Functional, etc. as child types or element types)
    let isTransitive = false;
    let isFunctional = false;

    // Check if typed as Transitive or Functional directly
    const types = propEl.getElementsByTagNameNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'type');
    const typesFallback = propEl.getElementsByTagName('rdf:type');
    Array.from(types).concat(Array.from(typesFallback)).forEach((tEl) => {
      const res = getResourceAttribute(tEl);
      if (res?.includes('TransitiveProperty')) isTransitive = true;
      if (res?.includes('FunctionalProperty')) isFunctional = true;
    });

    addNode({
      id: about,
      localName,
      namespace,
      type: 'objectProperty',
      domains: domainsList,
      ranges: rangesList,
      subPropertyOf: subPropsList,
      isTransitive,
      isFunctional,
      xmlSnippet: getXmlSnippet(propEl),
    });
  });

  // 4. Process Datatype Properties: owl:DatatypeProperty
  const datatypeProperties = xmlDoc.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'DatatypeProperty');
  const fallbackDatatypeProps = xmlDoc.getElementsByTagName('owl:DatatypeProperty');
  const allDatatypeProperties = Array.from(datatypeProperties).concat(Array.from(fallbackDatatypeProps).filter(el => !Array.from(datatypeProperties).includes(el)));

  allDatatypeProperties.forEach((propEl) => {
    const about = getAboutAttribute(propEl);
    if (!about) return;

    const { localName, namespace } = splitIri(about);

    // Domain & Range
    const domainsList: string[] = [];
    const domains = propEl.getElementsByTagNameNS('http://www.w3.org/2000/01/rdf-schema#', 'domain');
    Array.from(domains).forEach((d) => {
      const res = getResourceAttribute(d);
      if (res) {
        domainsList.push(res);
        links.push({
          id: `lnk_dt_${localName}_domain_${splitIri(res).localName}`,
          source: about,
          target: res,
          type: 'domain',
          label: 'rdfs:domain',
        });
      }
    });

    const rangesList: string[] = [];
    const ranges = propEl.getElementsByTagNameNS('http://www.w3.org/2000/01/rdf-schema#', 'range');
    Array.from(ranges).forEach((r) => {
      const res = getResourceAttribute(r);
      if (res) {
        rangesList.push(res);
        links.push({
          id: `lnk_dt_${localName}_range_${splitIri(res).localName}`,
          source: about,
          target: res,
          type: 'range',
          label: 'rdfs:range',
        });
      }
    });

    addNode({
      id: about,
      localName,
      namespace,
      type: 'datatypeProperty',
      domains: domainsList,
      ranges: rangesList,
      xmlSnippet: getXmlSnippet(propEl),
    });
  });

  // 5. Process Named Individuals: owl:NamedIndividual
  const individuals = xmlDoc.getElementsByTagNameNS('http://www.w3.org/2002/07/owl#', 'NamedIndividual');
  const fallbackIndividuals = xmlDoc.getElementsByTagName('owl:NamedIndividual');
  const allIndividuals = Array.from(individuals).concat(Array.from(fallbackIndividuals).filter(el => !Array.from(individuals).includes(el)));

  allIndividuals.forEach((indEl) => {
    const about = getAboutAttribute(indEl);
    if (!about) return;

    const { localName, namespace } = splitIri(about);

    // Find class type
    const classTypes: string[] = [];
    const types = indEl.getElementsByTagNameNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'type');
    const typesFallback = indEl.getElementsByTagName('rdf:type');
    
    Array.from(types).concat(Array.from(typesFallback)).forEach((tEl) => {
      const res = getResourceAttribute(tEl);
      if (res && !res.includes('NamedIndividual')) {
        classTypes.push(res);
        links.push({
          id: `lnk_ind_${localName}_type_${splitIri(res).localName}`,
          source: about,
          target: res,
          type: 'typeOf',
          label: 'rdf:type',
        });
      }
    });

    // Values & Custom Object/Data Property assertions
    const propertyValues: Array<{
      propertyUri: string;
      propertyName: string;
      value: string;
      isIndividual: boolean;
    }> = [];

    // Any children other than rdf:type represent property assertions (values or reference assertions)
    const children = Array.from(indEl.children);
    children.forEach((child) => {
      const tagName = child.localName || child.tagName;
      if (tagName === 'type') return; // Skip rdf:type

      // Get tag URI based on the namespace / localName
      const ns = child.namespaceURI || defaultBase;
      const propUri = child.namespaceURI ? (ns + tagName) : `${defaultBase}${tagName}`;

      const resVal = getResourceAttribute(child);
      if (resVal) {
        // Points to another individual or class resource
        propertyValues.push({
          propertyUri: propUri,
          propertyName: tagName,
          value: resVal,
          isIndividual: true,
        });

        links.push({
          id: `lnk_assertion_${localName}_${tagName}_${splitIri(resVal).localName}`,
          source: about,
          target: resVal,
          type: 'customRelation',
          label: tagName,
        });
      } else {
        // Plain text value / Literal (e.g., Float 13.8)
        const textValue = child.textContent;
        if (textValue !== null) {
          propertyValues.push({
            propertyUri: propUri,
            propertyName: tagName,
            value: textValue,
            isIndividual: false,
          });
        }
      }
    });

    addNode({
      id: about,
      localName,
      namespace,
      type: 'individual',
      classTypes,
      propertyValues,
      xmlSnippet: getXmlSnippet(indEl),
    });
  });

  // De-duplicate links by id to ensure absolute uniqueness of render elements and prevent React key conflicts
  const uniqueLinksMap = new Map<string, OntologyLink>();
  links.forEach((link) => {
    uniqueLinksMap.set(link.id, link);
  });
  const uniqueLinks = Array.from(uniqueLinksMap.values());

  // Make sure we resolve any missing target node dependencies in links
  // E.g., if a link points to 'Pen' or 'Bic' but it isn't listed as a standalone xml node
  // We can dynamically add placeholder nodes to make sure our graph doesn't break.
  uniqueLinks.forEach((lnk) => {
    const srcId = typeof lnk.source === 'string' ? lnk.source : (lnk.source as any).id;
    const tgtId = typeof lnk.target === 'string' ? lnk.target : (lnk.target as any).id;

    if (!nodesMap.has(srcId)) {
      const { localName, namespace } = splitIri(srcId);
      addNode({
        id: srcId,
        localName,
        namespace,
        type: 'unresolved' as any,
      });
    }
    if (!nodesMap.has(tgtId)) {
      const { localName, namespace } = splitIri(tgtId);
      addNode({
        id: tgtId,
        localName,
        namespace,
        type: 'unresolved' as any,
      });
    }
  });

  return {
    ontologyRelativeId: defaultBase,
    comment: ontologyComment,
    nodes: Array.from(nodesMap.values()),
    links: uniqueLinks,
  };
}
