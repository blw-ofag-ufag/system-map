function shortenLabel(label, abbreviation) {
    if (label.length + (abbreviation || '').length <= 40) return abbreviation ? `${label} (${abbreviation})` : label;
    if (label.length <= 40) return label;
    if (abbreviation) return abbreviation;
    return label.substring(0, 40) + "...";
}

function getDistancesUpToTwoHops(network, startId) {
    const distMap = { [startId]: 0 };
    const queue = [startId];
    while (queue.length > 0) {
        const current = queue.shift();
        const currentDist = distMap[current];
        if (currentDist < 2) {
            network.getConnectedNodes(current).forEach(nbr => {
                if (distMap[nbr] === undefined) {
                    distMap[nbr] = currentDist + 1;
                    queue.push(nbr);
                }
            });
        }
    }
    return distMap;
}

function blendHexColors(c1, c2, ratio) {
    const hexToRgb = (hex) => hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b).substring(1).match(/.{2}/g).map(x => parseInt(x, 16));
    const rgbToHex = (r, g, b) => "#" + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
    const [r1, g1, b1] = hexToRgb(c1);
    const [r2, g2, b2] = hexToRgb(c2);
    return rgbToHex(r1 + ratio * (r2 - r1), g1 + ratio * (g2 - g1), b1 + ratio * (b2 - b1));
}

function getParam(name) { return new URLSearchParams(window.location.search).get(name); }

function setParamsAndReload(paramsObj) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(paramsObj)) {
        (value === null || value === undefined || value === true) ? params.delete(key): params.set(key, value);
    }
    window.location.href = `${window.location.pathname}?${params.toString()}`;
}

function setParamsWithoutReload(paramsObj) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(paramsObj)) {
        if (value === null || value === undefined || value === '') params.delete(key);
        else params.set(key, value);
    }
    history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
}

function shortenIri(iri) {
    for (const [baseIRI, prefix] of Object.entries(APP_CONFIG.PREFIXES)) {
        if (iri.startsWith(baseIRI)) return `${prefix}:${iri.substring(baseIRI.length)}`;
    }
    return iri;
}

function expandIri(iri) {
    if (!iri || typeof iri !== 'string') return iri;
    if (iri.startsWith('http://') || iri.startsWith('https://')) return iri;
    const idx = iri.indexOf(':');
    if (idx > 0) {
        const prefix = iri.substring(0, idx);
        const suffix = iri.substring(idx + 1);
        for (const [baseIRI, pref] of Object.entries(APP_CONFIG.PREFIXES)) {
            if (pref === prefix) return baseIRI + suffix;
        }
    }
    return iri;
}

function setupSearchBox(onSearchChange) {
    const searchBox = document.getElementById('search-box');
    if (!searchBox) return;
    searchBox.value = getParam('search') || '';
    let searchTimeout;
    searchBox.addEventListener('keyup', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            setParamsWithoutReload({ search: e.target.value.trim() || null });
            onSearchChange();
        }, 300);
    });
}

function getLocalizedText(langMap, currentLang) {
    if (!langMap || Object.keys(langMap).length === 0) return { text: '', lang: '', isFallback: true };
    const langPrefs = [currentLang, 'en', 'de', 'fr', 'it', ''];
    for (const lang of langPrefs) {
        if (langMap[lang]) return { text: langMap[lang], lang: lang, isFallback: lang !== currentLang };
    }
    const firstKey = Object.keys(langMap)[0];
    return { text: langMap[firstKey], lang: firstKey, isFallback: true };
}

const getLangMap = (node, fullUri) => {
    const vals = node[fullUri];
    if (!vals) return {};
    const res = {};
    vals.forEach(v => {
        if (v['@value'] !== undefined) res[v['@language'] || ''] = v['@value'];
    });
    return res;
};

const getRefs = (node, fullUri) => {
    const vals = node[fullUri];
    if (!vals) return [];
    return vals.map(v => v['@id']).filter(Boolean);
};

const getKwId = (uri) => {
    const parts = uri.split(/[\/#]/);
    return parts[parts.length - 1];
};

async function init() {
    APP_CONFIG.initializeStylesFromCSS();

    let currentLang = getParam("lang") || "de";
    let minDegree = parseInt(getParam("minDegree") || "0", 10);
    
    const kwParam = getParam("keywords");
    const activeKeywords = kwParam ? kwParam.split(',') : [];

    const groupStates = {};
    Object.entries(APP_CONFIG.GROUP_MAP).forEach(([iri, group]) => {
        if (group !== 'Other') {
            groupStates[group] = getParam(group.toLowerCase()) || 'full';
        }
    });

    let pinnedNodeId = null, pinnedEdgeId = null;
    let allNodesData = {}, allEdgesData = {}, allEdgeMetadata = {}, allClassesData = {}, allTitles = {};
    let allKeywordsMap = {};
    let network, nodesDataset, edgesDataset;

    try {
        const rawJsonLd = await getSparqlData(MAIN_CONSTRUCT_QUERY);
        const expandedGraph = await jsonld.expand(rawJsonLd);
        
        const entityMap = {};
        expandedGraph.forEach(node => { entityMap[node['@id']] = node; });

        const baseClasses = Object.keys(APP_CONFIG.GROUP_MAP);
        const fullPredicateIris = Object.values(APP_CONFIG.PREDICATE_MAP).map(expandIri);
        
        // 1. Parse Metadata, Ontologies, and Keywords
        expandedGraph.forEach(node => {
            const types = node['@type'] || [];
            
            if (types.includes('http://www.w3.org/2002/07/owl#Class') || baseClasses.includes(node['@id'])) {
                allClassesData[node['@id']] = {
                    id: node['@id'],
                    label: getLangMap(node, 'http://schema.org/name'),
                    comment: getLangMap(node, 'http://schema.org/description')
                };
            }
            if (types.includes('http://www.w3.org/2002/07/owl#ObjectProperty') || fullPredicateIris.includes(node['@id'])) {
                allEdgeMetadata[node['@id']] = {
                    id: node['@id'],
                    label: getLangMap(node, 'http://schema.org/name'),
                    comment: getLangMap(node, 'http://schema.org/description'),
                    domain: getRefs(node, 'http://www.w3.org/2000/01/rdf-schema#domain')[0],
                    range: getRefs(node, 'http://www.w3.org/2000/01/rdf-schema#range')[0]
                };
            }
            if (types.includes('https://agriculture.ld.admin.ch/system-map/SystemMap')) {
                allTitles = getLangMap(node, 'http://schema.org/name');
            }
            if (types.includes('http://schema.org/DefinedTerm')) {
                allKeywordsMap[node['@id']] = getLangMap(node, 'http://schema.org/name');
            }
        });

        // 2. Pre-extract raw nodes and immediately purge non-matching datasets
        const rawNodes = {};
        expandedGraph.forEach(node => {
            const types = node['@type'] || [];
            const groupIri = types.find(t => baseClasses.includes(t));
            if (!groupIri) return;

            const id = node['@id'];
            rawNodes[id] = {
                id: id,
                group: mapClassIriToGroup(groupIri),
                name: getLangMap(node, 'http://schema.org/name'),
                comment: getLangMap(node, 'http://schema.org/description'),
                abbreviation: getLangMap(node, 'https://agriculture.ld.admin.ch/system-map/abbreviation'),
                keywords: getRefs(node, 'http://www.w3.org/ns/dcat#keyword').map(kwUri => {
                    const kwNode = entityMap[kwUri];
                    if(kwNode && !allKeywordsMap[kwUri]) allKeywordsMap[kwUri] = getLangMap(kwNode, 'http://schema.org/name');
                    return { id: kwUri, labels: kwNode ? getLangMap(kwNode, 'http://schema.org/name') : {} };
                })
            };
        });

        if (activeKeywords.length > 0) {
            Object.keys(rawNodes).forEach(id => {
                const n = rawNodes[id];
                if (n.group === 'Information') {
                    const nodeKwIds = n.keywords.map(k => getKwId(k.id));
                    const hasMatch = activeKeywords.some(kw => nodeKwIds.includes(kw));
                    // Dataset Exclusion: Exclude dataset universally if it fails the filter
                    if (!hasMatch) delete rawNodes[id];
                }
            });
        }

        // 3. Client-Side Hierarchical Folding Evaluation
        const parentMap = {};
        const PARENT_PROPS = ["http://schema.org/parentOrganization", "http://purl.org/dc/terms/isPartOf"];
        const CHILD_PROPS = ["http://schema.org/subOrganization", "http://purl.org/dc/terms/hasPart"];
        
        expandedGraph.forEach(node => {
            const id = node['@id'];
            PARENT_PROPS.forEach(prop => { getRefs(node, prop).forEach(pId => { parentMap[id] = pId; }); });
            CHILD_PROPS.forEach(prop => { getRefs(node, prop).forEach(cId => { parentMap[cId] = id; }); });
        });

        const findRoot = (id, visited = new Set()) => {
            if (visited.has(id)) return id; 
            visited.add(id);

            let group = "Other";
            if (rawNodes[id]) {
                group = rawNodes[id].group;
            } else if (entityMap[id]) {
                const types = [].concat(entityMap[id]['@type'] || []);
                const groupIri = types.find(t => baseClasses.includes(t));
                if (groupIri) group = mapClassIriToGroup(groupIri);
            }

            const state = groupStates[group] || "full";
            if (state === 'full') return id;
            
            if (parentMap[id]) return findRoot(parentMap[id], visited);
            return id;
        };

        // 4. Construct Folded Nodes & Consolidate Keywords
        Object.values(rawNodes).forEach(n => {
            const rootId = findRoot(n.id);
            if (!allNodesData[rootId]) {
                allNodesData[rootId] = JSON.parse(JSON.stringify(rawNodes[rootId] || n)); 
                allNodesData[rootId].id = rootId;
            } else if (n.id !== rootId) {
                const existingKws = new Set(allNodesData[rootId].keywords.map(k => k.id));
                n.keywords.forEach(kw => {
                    if (!existingKws.has(kw.id)) {
                        allNodesData[rootId].keywords.push(kw);
                        existingKws.add(kw.id);
                    }
                });
            }
        });

        // 5. Fold and Build Edges (Strictly filtered by active UI checkboxes)
        expandedGraph.forEach(node => {
            const fromId = node['@id'];
            const rootFrom = findRoot(fromId);
            
            if (!allNodesData[rootFrom]) return;

            fullPredicateIris.forEach(predFullIri => {
                getRefs(node, predFullIri).forEach(toId => {
                    const rootTo = findRoot(toId);
                    
                    if (!allNodesData[rootTo]) return; 
                    if (rootFrom === rootTo) return; 
                    
                    const edgeId = `${rootFrom}-${predFullIri}-${rootTo}`;
                    if (!allEdgesData[edgeId]) {
                        allEdgesData[edgeId] = { id: edgeId, iri: predFullIri, from: rootFrom, to: rootTo };
                    }
                });
            });
        });

        // 6. ENFORCE TOPOLOGICAL KEYWORD TRAVERSAL ON THE VISUAL GRAPH
        if (activeKeywords.length > 0) {
            // Build an adjacency list strictly derived from edges the user actually allowed to be visualized
            const visAdjacency = {};
            Object.values(allEdgesData).forEach(edge => {
                if (!visAdjacency[edge.from]) visAdjacency[edge.from] = new Set();
                if (!visAdjacency[edge.to]) visAdjacency[edge.to] = new Set();
                visAdjacency[edge.from].add(edge.to);
                visAdjacency[edge.to].add(edge.from);
            });

            // Find seeds strictly from surviving Information nodes
            const visSeeds = [];
            Object.values(allNodesData).forEach(n => {
                if (n.group === 'Information') {
                    visSeeds.push(n.id);
                }
            });

            if (visSeeds.length === 0) {
                // If there are no valid datasets, prune everything
                allNodesData = {};
                allEdgesData = {};
            } else {
                // Execute Breadth-First Search out from the seeds
                const connectedNodes = new Set(visSeeds);
                const queue = [...visSeeds];

                while (queue.length > 0) {
                    const curr = queue.shift();
                    if (visAdjacency[curr]) {
                        visAdjacency[curr].forEach(nbr => {
                            if (!connectedNodes.has(nbr)) {
                                connectedNodes.add(nbr);
                                queue.push(nbr);
                            }
                        });
                    }
                }

                // Topologically prune isolated subgraphs that have no path back to a dataset
                Object.keys(allNodesData).forEach(id => {
                    if (!connectedNodes.has(id)) delete allNodesData[id];
                });

                Object.keys(allEdgesData).forEach(id => {
                    const edge = allEdgesData[id];
                    if (!connectedNodes.has(edge.from) || !connectedNodes.has(edge.to)) {
                        delete allEdgesData[id];
                    }
                });
            }
        }

    } catch (error) {
        console.error("Fatal parsing exception:", error);
        document.getElementById("systemmapTitle").textContent = APP_CONFIG.UI_TEXT[currentLang].errorLoading;
        return;
    }

    const infoPanel = document.getElementById("infoPanel");

    const applyAllStyles = () => {
        const searchTerm = (getParam("search") || "").toLowerCase();
        const distMap = pinnedNodeId ? getDistancesUpToTwoHops(network, pinnedNodeId) : null;
        
        const originalStyles = Object.fromEntries(nodesDataset.map(n => {
            const style = APP_CONFIG.GROUP_STYLES[n.group] || APP_CONFIG.GROUP_STYLES.Other;
            return [n.id, { background: style.background, border: style.border, fontColor: style.font.color }];
        }));

        const nodeUpdates = nodesDataset.map(n => {
            const originalStyle = originalStyles[n.id];
            let newColor = originalStyle.background, newBorder = originalStyle.border, newFont = originalStyle.fontColor;

            if (distMap) {
                const dist = distMap[n.id];
                if (dist === undefined || dist > 2) {
                    newColor = '#00000000'; newBorder = '#00000000'; newFont = '#00000000';
                } else {
                    const ratio = (dist === 2) ? 0.5 : 0;
                    newColor = blendHexColors(originalStyle.background, "#ffffff", ratio);
                    newBorder = blendHexColors(originalStyle.border, "#ffffff", ratio);
                    newFont = blendHexColors(originalStyle.fontColor, "#ffffff", ratio);
                }
            }

            if (searchTerm) {
                const nodeData = allNodesData[n.id];
                const isMatch = (
                    nodeData.id.toLowerCase().includes(searchTerm) ||
                    Object.values(nodeData.name).some(val => val.toLowerCase().includes(searchTerm)) ||
                    Object.values(nodeData.comment).some(val => val.toLowerCase().includes(searchTerm)) ||
                    Object.values(nodeData.abbreviation).some(val => val.toLowerCase().includes(searchTerm))
                );

                if (isMatch) {
                    newColor = APP_CONFIG.SEARCH_HIGHLIGHT_COLOR.background;
                    newBorder = APP_CONFIG.SEARCH_HIGHLIGHT_COLOR.border;
                    newFont = APP_CONFIG.SEARCH_HIGHLIGHT_COLOR.font.color;
                }
            }

            return {
                id: n.id,
                color: { background: newColor, border: newBorder },
                font: { color: newFont, multi: 'html', face: 'Poppins' }
            };
        });
        nodesDataset.update(nodeUpdates);

        const edgeUpdates = edgesDataset.map(edge => {
            let newColor = '#000000', newWidth = 2, fontUpdate = { color: '#000000', strokeWidth: 2 };

            if (distMap) {
                const distFrom = distMap[edge.from], distTo = distMap[edge.to];
                if (distFrom === undefined || distFrom > 2 || distTo === undefined || distTo > 2) {
                    newColor = '#00000000'; newWidth = 1; fontUpdate.color = '#00000000'; fontUpdate.strokeWidth = 0;
                } else {
                    const maxDist = Math.max(distFrom ?? 0, distTo ?? 0);
                    if (maxDist === 2) {
                        const dimRatio = 0.5;
                        newColor = blendHexColors('#000000', '#ffffff', dimRatio);
                        fontUpdate.color = blendHexColors('#000000', '#ffffff', dimRatio);
                        newWidth = 1;
                    }
                }
            }
            return { id: edge.id, color: { color: newColor }, width: newWidth, font: fontUpdate };
        });
        edgesDataset.update(edgeUpdates);
    };

    const showInfo = (html) => {
        infoPanel.innerHTML = html;
        infoPanel.classList.remove("hidden");
    };
    
    const hideInfo = () => {
        infoPanel.classList.add("hidden");
        infoPanel.innerHTML = "";
        infoPanel.classList.remove("fixed");
    };

    const getNodeInfoHtml = (nodeId) => {
        const nodeData = allNodesData[nodeId];
        if(!nodeData) return '';
        const { text: fullLabel, lang: labelLang, isFallback } = getLocalizedText(nodeData.name, currentLang);
        const { text: abbreviation } = getLocalizedText(nodeData.abbreviation, currentLang);
        const { text: comment } = getLocalizedText(nodeData.comment, currentLang);
        const group = nodeData.group;

        const chipStyle = APP_CONFIG.GROUP_STYLES[group] || APP_CONFIG.GROUP_STYLES.Other;
        const classIri = APP_CONFIG.GROUP_IRI_MAP[group];
        const { text: chipLabel } = getLocalizedText(allClassesData[classIri]?.label, currentLang);

        const inlineStyle = `background-color: ${chipStyle.background}; border-color: ${chipStyle.border}; color: ${chipStyle.font.color};`;
        const classChipHtml = `<span class="info-panel-chip" style="${inlineStyle}">${chipLabel || group}</span>`;
        let titleHtml = isFallback && labelLang ? `${labelLang.toUpperCase()}: <i>${fullLabel}</i>` : fullLabel;
        if (abbreviation) titleHtml += ` (${abbreviation})`;

        let html = `
            <a href="${nodeData.id}" target="_blank"><small><code>${shortenIri(nodeData.id)}</code></small></a>
            <div class="info-panel-header">
                <h4>${titleHtml} ${classChipHtml}</h4>
            </div>`;
        if (comment) html += `<p class="info-panel-comment"><small>${comment}</small></p>`;

        if (nodeData.keywords && nodeData.keywords.length > 0) {
            const keywordHtmls = nodeData.keywords.map(kw => {
                const { text } = getLocalizedText(kw.labels, currentLang);
                return `<span class="keyword-chip">${text}</span>`;
            }).join("");
            html += `<div class="keyword-container">${keywordHtmls}</div>`;
        }
        return html;
    };

    const createEdgeDiagramHtml = (predicateIri) => {
        const metadata = allEdgeMetadata[predicateIri];
        if (!metadata) return '';

        const getIconHtml = (classIri) => {
            if (!classIri || classIri === 'http://www.w3.org/2002/07/owl#Thing') {
                return `<span class="edge-diagram-icon" style="background: white; border-color: #555; border-style: dashed; color: #555;">&nbsp;?&nbsp;</span>`;
            }
            const groupName = mapClassIriToGroup(classIri);
            const style = APP_CONFIG.GROUP_STYLES[groupName] || APP_CONFIG.GROUP_STYLES.Other;
            const { text: label } = getLocalizedText(allClassesData[classIri]?.label, currentLang);
            return `<span class="edge-diagram-icon" style="background-color: ${style.background}; border-color: ${style.border}; color: ${style.font.color};">${label || groupName}</span>`;
        };

        const domainIcon = getIconHtml(metadata.domain);
        const rangeIcon = getIconHtml(metadata.range);
        const isDashed = APP_CONFIG.DASHED_PREDICATES.includes(predicateIri);
        const arrowDashStyle = isDashed ? `stroke-dasharray="3 4"` : '';

        const arrow = `
            <svg width="30" height="14" viewBox="0 0 30 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
                <path d="M4 7 L26 7" stroke="#333" stroke-width="1.5" ${arrowDashStyle}></path>
                <path d="M21 3 L26 7 L21 11" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>`;

        return `<div class="edge-diagram">${domainIcon} ${arrow} ${rangeIcon}</div>`;
    };

    const getEdgeInfoHtml = (edgeId) => {
        const edgeData = allEdgesData[edgeId];
        const predicateMeta = allEdgeMetadata[edgeData.iri];
        const { text: label } = getLocalizedText(predicateMeta?.label, currentLang);
        const { text: comment } = getLocalizedText(predicateMeta?.comment, currentLang);

        let html = edgeData.iri ? `<a href="${edgeData.iri}" target="_blank"><small><code>${shortenIri(edgeData.iri)}</code></small></a><br/>` : '';
        html += `
            <div class="edge-title-container">
                <h4>${label}</h4>
                ${createEdgeDiagramHtml(edgeData.iri)}
            </div>`;
        if (comment) html += `<p class="info-panel-comment"><small>${comment}</small></p>`;
        return html;
    };

    const updateUIForLanguage = () => {
        const TEXT = APP_CONFIG.UI_TEXT[currentLang];
        document.title = TEXT.appTitle;
        document.getElementById("systemmapTitle").textContent = getLocalizedText(allTitles, currentLang).text || TEXT.fallbackSystemMapTitle;
        document.getElementById("search-box").placeholder = TEXT.searchPlaceholder;
        document.getElementById("settings-trigger").title = TEXT.settingsTooltip;
        document.getElementById("github-link").title = TEXT.githubTooltip;
        document.getElementById("email-link").title = TEXT.emailTooltip;

        if (nodesDataset) {
            const nodeIdsInGraph = nodesDataset.getIds();
            const nodeUpdates = nodeIdsInGraph.map(nodeId => {
                const nodeData = allNodesData[nodeId];
                if (!nodeData) return null;
                const { text: label, lang: labelLang, isFallback } = getLocalizedText(nodeData.name, currentLang);
                const { text: abbreviation } = getLocalizedText(nodeData.abbreviation, currentLang);
                const htmlLabel = isFallback && labelLang ? `<b>${labelLang.toUpperCase()}:</b> <i>${shortenLabel(label, abbreviation)}</i>` : `<b>${shortenLabel(label, abbreviation)}</b>`;
                return { id: nodeId, label: htmlLabel };
            }).filter(Boolean);
            nodesDataset.update(nodeUpdates);
        }

        if (edgesDataset) {
            const edgeIdsInGraph = edgesDataset.getIds();
            const edgeUpdates = edgeIdsInGraph.map(edgeId => {
                const edgeData = allEdgesData[edgeId];
                if (!edgeData) return null;
                const predicateMeta = allEdgeMetadata[edgeData.iri];
                const { text: label } = getLocalizedText(predicateMeta?.label, currentLang);
                return { id: edgeId, label: label };
            }).filter(Boolean);
            edgesDataset.update(edgeUpdates);
        }

        if (!infoPanel.classList.contains("hidden")) {
            if (pinnedNodeId) showInfo(getNodeInfoHtml(pinnedNodeId));
            else if (pinnedEdgeId) showInfo(getEdgeInfoHtml(pinnedEdgeId));
        }
        
        if(!document.getElementById('settings-overlay').classList.contains('hidden')) {
            populateSettings();
        }
    };

    // Min Degree Slider operates on visually confirmed network nodes
    const nodeDegrees = {};
    Object.values(allEdgesData).forEach(edge => {
        nodeDegrees[edge.from] = (nodeDegrees[edge.from] || 0) + 1;
        nodeDegrees[edge.to] = (nodeDegrees[edge.to] || 0) + 1;
    });

    const filteredNodeIds = new Set(
        Object.keys(allNodesData).filter(nodeId => (nodeDegrees[nodeId] || 0) >= minDegree)
    );

    const initialNodes = Object.values(allNodesData)
        .filter(nodeData => filteredNodeIds.has(nodeData.id))
        .map(nodeData => ({ id: nodeData.id, group: nodeData.group, label: " " }));

    const initialEdges = Object.values(allEdgesData)
        .filter(edgeData => filteredNodeIds.has(edgeData.from) && filteredNodeIds.has(edgeData.to))
        .map(edgeData => {
            const edge = { id: edgeData.id, from: edgeData.from, to: edgeData.to, label: " " };
            if (APP_CONFIG.DASHED_PREDICATES.includes(edgeData.iri)) {
                edge.dashes = [3, 4]; edge.length = 500; edge.springConstant = 0.001;
            }
            return edge;
        });
        
    nodesDataset = new vis.DataSet(initialNodes);
    edgesDataset = new vis.DataSet(initialEdges);
    
    const container = document.getElementById("network");
    const data = { nodes: nodesDataset, edges: edgesDataset };
    const options = { 
        nodes: { shape: "box", widthConstraint: 150, heightConstraint: 40, chosen: { node: (values, id, selected, hovering) => { if (hovering) { let isDimmed = false; if (pinnedNodeId) { const distMap = getDistancesUpToTwoHops(network, pinnedNodeId); if (distMap[id] === undefined || distMap[id] > 2) { isDimmed = true; } } if (!isDimmed) { values.borderWidth = 3; values.borderColor = "#000"; } } } } },
        edges: { width: 2, selectionWidth: 1, font: { face: "Poppins", color: "#000000" }, chosen: false, arrows: { to: { enabled: true, scaleFactor: 0.8 } }, color: { color: '#000000', highlight: '#000000', inherit: false } },
        groups: APP_CONFIG.GROUP_STYLES,
        interaction: { hover: true, dragNodes: true, hoverConnectedEdges: false, zoomView: true, dragView: true },
        physics: { enabled: true, barnesHut: { gravitationalConstant: -9000, centralGravity: 0.05, springLength: 250, springConstant: 0.2 }, stabilization: { iterations: 100 } }
    };

    network = new vis.Network(container, data, options);

    setupSearchBox(applyAllStyles);
    
    setupSettingsPanel(
      () => populateSettings(),
      () => {
        const params = {};
        params.lang = currentLang;
        
        const minDegreeValue = parseInt(document.getElementById('min-degree-slider').value, 10);
        params.minDegree = minDegreeValue > 0 ? minDegreeValue : null;

        document.querySelectorAll('.tri-toggle').forEach(toggle => {
            const checkedRadio = toggle.querySelector('input[type="radio"]:checked');
            if(checkedRadio && checkedRadio.dataset.group) {
                const groupLower = checkedRadio.dataset.group.toLowerCase();
                const val = checkedRadio.value;
                params[groupLower] = val === 'full' ? null : val;
            }
        });

        const allPredicateKeys = Object.keys(APP_CONFIG.PREDICATE_MAP);
        const selectedPreds = Array.from(document.querySelectorAll('#settings-predicates input[type="checkbox"]')).filter(cb => cb.checked).map(cb => cb.dataset.key);
        params.predicates = selectedPreds.length === allPredicateKeys.length ? null : selectedPreds.join(';');

        const selectedKws = window.kwChoicesInstance ? window.kwChoicesInstance.getValue(true) : [];
        params.keywords = selectedKws.length > 0 ? selectedKws.join(',') : null;
        
        setParamsAndReload(params);
    });

    network.on("click", params => {
        let clickedNodeId = params.nodes[0] || null;
        if (clickedNodeId && pinnedNodeId) {
            const distMap = getDistancesUpToTwoHops(network, pinnedNodeId);
            if (distMap[clickedNodeId] === undefined || distMap[clickedNodeId] > 2) clickedNodeId = null; 
        }
        pinnedNodeId = clickedNodeId;
        pinnedEdgeId = clickedNodeId ? null : params.edges[0] || null;

        if (pinnedNodeId) showInfo(getNodeInfoHtml(pinnedNodeId));
        else if (pinnedEdgeId) showInfo(getEdgeInfoHtml(pinnedEdgeId));
        else { network.unselectAll(); hideInfo(); }
        
        applyAllStyles();
        infoPanel.classList.toggle("fixed", !!(pinnedNodeId || pinnedEdgeId));
    });

    const languageSelector = document.getElementById('languageSelector');
    languageSelector.value = currentLang;
    languageSelector.addEventListener('change', (e) => {
        currentLang = e.target.value;
        setParamsWithoutReload({ lang: currentLang });
        updateUIForLanguage();
    });

    updateUIForLanguage();
    applyAllStyles();

    const createNodeIconHtml = (groupName) => {
        const style = APP_CONFIG.GROUP_STYLES[groupName] || APP_CONFIG.GROUP_STYLES.Other;
        const classIri = APP_CONFIG.GROUP_IRI_MAP[groupName];
        const { text: label } = getLocalizedText(allClassesData[classIri]?.label, currentLang);
        const inlineStyle = `background-color: ${style.background}; border-color: ${style.border}; color: ${style.font.color};`;
        return `<div class="settings-node-icon" style="${inlineStyle}">${label || groupName}</div>`;
    };

    function populateSettings() {
        const TEXT = APP_CONFIG.UI_TEXT[currentLang];
        
        document.getElementById('settings-title').textContent = TEXT.settings;
        document.getElementById('settings-min-degree-title').textContent = TEXT.minDegree;
        document.getElementById('settings-node-classes-title').textContent = TEXT.visibleNodeClasses;
        document.getElementById('settings-relationship-types-title').textContent = TEXT.visibleRelationshipTypes;
        document.getElementById('settings-keywords-title').textContent = TEXT.filterKeywords;
        document.getElementById('settingsCancel').textContent = TEXT.cancel;
        document.getElementById('settingsSave').textContent = TEXT.saveAndReload;

        const minDegreeContainer = document.getElementById('settings-min-degree-container');
        minDegreeContainer.innerHTML = `
            <div class="settings-slider-wrapper">
                <input type="range" min="0" max="5" value="${minDegree}" class="settings-slider" id="min-degree-slider">
                <span id="min-degree-value">${minDegree}</span>
            </div>
        `;
        const slider = document.getElementById('min-degree-slider');
        const sliderValueDisplay = document.getElementById('min-degree-value');
        slider.addEventListener('input', (e) => { sliderValueDisplay.textContent = e.target.value; });

        const createToggleItem = (container, { id, dataKey, dataValue, currentValue, label, comment, uri, curie, visualHtml }) => {
            let html = `<div class="class-toggle-row">
                <div class="tri-toggle" title="Toggle State">
                    <input type="radio" id="${id}_full" name="${id}" value="full" data-${dataKey}="${dataValue}" ${currentValue === 'full' ? 'checked' : ''}>
                    <label for="${id}_full" title="${TEXT.stateFull}"><i class="fas fa-sitemap"></i></label>

                    <input type="radio" id="${id}_collapsed" name="${id}" value="collapsed" data-${dataKey}="${dataValue}" ${currentValue === 'collapsed' ? 'checked' : ''}>
                    <label for="${id}_collapsed" title="${TEXT.stateCollapsed}"><i class="fas fa-layer-group"></i></label>

                    <input type="radio" id="${id}_off" name="${id}" value="off" data-${dataKey}="${dataValue}" ${currentValue === 'off' ? 'checked' : ''}>
                    <label for="${id}_off" title="${TEXT.stateOff}"><i class="fas fa-eye-slash"></i></label>

                    <div class="tri-toggle-slider"></div>
                </div>
                <div class="class-toggle-info">
                    <div class="class-toggle-header">
                        <strong>${label}</strong>
                        ${uri ? `<span class="settings-curie">(<a href="${uri}" target="_blank">${curie}</a>)</span>` : ''}
                        ${visualHtml || ''}
                    </div>
                    ${comment ? `<div class="settings-list-item-comment">${comment}</div>`:``}
                </div>
            </div>`;
            container.insertAdjacentHTML('beforeend', html);
        };

        const classesContainer = document.getElementById('settings-classes');
        classesContainer.innerHTML = '';
        const sortedClasses = Object.values(allClassesData).sort((a,b) => 
            (getLocalizedText(a.label, currentLang).text || '').localeCompare(getLocalizedText(b.label, currentLang).text || '')
        );

        sortedClasses.forEach(classData => {
            const groupName = mapClassIriToGroup(classData.id);
            if(groupName === "Other") return;
            const paramVal = getParam(groupName.toLowerCase()) || 'full';
            createToggleItem(classesContainer, {
                id: `setting-class-${groupName}`,
                dataKey: 'group',
                dataValue: groupName,
                currentValue: paramVal,
                label: getLocalizedText(classData.label, currentLang).text || TEXT.noLabel,
                comment: getLocalizedText(classData.comment, currentLang).text || '',
                uri: classData.id,
                curie: shortenIri(classData.id),
                visualHtml: createNodeIconHtml(groupName)
            });
        });

        const createCheckboxItem = (container, { id, dataKey, dataValue, isChecked, label, comment, uri, curie, visualHtml }) => {
            let html = `<div class="settings-list-item">
                <div class="settings-list-item-content">
                    <label>
                        <input type="checkbox" id="${id}" data-${dataKey}="${dataValue}" ${isChecked ? 'checked' : ''}>
                        <strong>${label}</strong>
                        ${uri ? `<span>(<a href="${uri}" target="_blank">${curie}</a>)&nbsp;&nbsp;</span>` : ''}
                        ${visualHtml || ''}
                    </label>
                    ${comment ? `<span class="settings-list-item-comment">${comment}</span>`:``}
                </div></div>`;
            container.insertAdjacentHTML('beforeend', html);
        };

        const predicatesContainer = document.getElementById('settings-predicates');
        predicatesContainer.innerHTML = '';
        const rawPredParam = getParam("predicates");
        const currentPreds = rawPredParam === null ? Object.keys(APP_CONFIG.PREDICATE_MAP) : (rawPredParam ? rawPredParam.split(/[;,+\s]+/) : []);

        const iriToKeyMap = {};
        const invertedPrefixes = Object.fromEntries(Object.entries(APP_CONFIG.PREFIXES).map(([base, prefix]) => [prefix, base]));
        for (const [key, curie] of Object.entries(APP_CONFIG.PREDICATE_MAP)) {
            const [prefix, suffix] = curie.split(':');
            if (invertedPrefixes[prefix]) {
                iriToKeyMap[invertedPrefixes[prefix] + suffix] = key;
            }
        }
        
        const sortedPredicates = Object.values(allEdgeMetadata).sort((a,b) => 
            (getLocalizedText(a.label, currentLang).text || '').localeCompare(getLocalizedText(b.label, currentLang).text || '')
        );

        sortedPredicates.forEach(predData => {
            const key = iriToKeyMap[predData.id];
            if (key) {
                createCheckboxItem(predicatesContainer, {
                    id: `setting-pred-${key}`,
                    dataKey: 'key',
                    dataValue: key,
                    isChecked: currentPreds.includes(key),
                    label: getLocalizedText(predData.label, currentLang).text || TEXT.noLabel,
                    comment: null, 
                    uri: predData.id,
                    curie: shortenIri(predData.id),
                    visualHtml: createEdgeDiagramHtml(predData.id)
                });
            }
        });

        const keywordSelect = document.getElementById('keyword-select');
        keywordSelect.innerHTML = ''; 

        const sortedKeywords = Object.entries(allKeywordsMap).map(([uri, langMap]) => {
            return { shortId: getKwId(uri), label: getLocalizedText(langMap, currentLang).text || TEXT.noLabel };
        }).sort((a, b) => a.label.localeCompare(b.label));

        sortedKeywords.forEach(kw => {
            const option = document.createElement('option');
            option.value = kw.shortId;
            option.textContent = kw.label;
            if (activeKeywords.includes(kw.shortId)) option.selected = true;
            keywordSelect.appendChild(option);
        });

        if (window.kwChoicesInstance) { window.kwChoicesInstance.destroy(); }
        window.kwChoicesInstance = new Choices(keywordSelect, {
            removeItemButton: true,
            searchResultLimit: 5,
            renderChoiceLimit: -1,
            placeholderValue: TEXT.searchPlaceholder,
            itemSelectText: ''
        });
    }
}

function setupSettingsPanel(onOpen, onSave) {
    const overlay = document.getElementById('settings-overlay');
    const trigger = document.getElementById('settings-trigger');

    const openSettings = () => { onOpen(); overlay.classList.remove('hidden'); };
    const closeSettings = () => overlay.classList.add('hidden');

    trigger.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
    document.getElementById('settingsCancel').addEventListener('click', closeSettings);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
    document.getElementById('settingsSave').addEventListener('click', onSave);
}

document.addEventListener("DOMContentLoaded", init);