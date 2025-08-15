/**
 * Optional: shorten label if it's too long
 */
function shortenLabel(label, abbreviation) {
    if (label.length + (abbreviation || '').length <= 40) {
        return abbreviation ? `${label} (${abbreviation})` : label;
    }
    if (label.length <= 40) return label;
    if (abbreviation) return abbreviation;
    return label.substring(0, 40) + "...";
}

/**
 * BFS up to 2 hops. Returns { nodeId: distance }.
 */
function getDistancesUpToTwoHops(network, startId) {
    const distMap = {
        [startId]: 0
    };
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

/**
 * Blend two hex colors by a ratio in [0..1].
 */
function blendHexColors(c1, c2, ratio) {
    const hexToRgb = (hex) => hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b).substring(1).match(/.{2}/g).map(x => parseInt(x, 16));
    const rgbToHex = (r, g, b) => "#" + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
    const [r1, g1, b1] = hexToRgb(c1);
    const [r2, g2, b2] = hexToRgb(c2);
    return rgbToHex(r1 + ratio * (r2 - r1), g1 + ratio * (g2 - g1), b1 + ratio * (b2 - b1));
}

/**
 * Helper func to get value of an URL param
 */
function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

/**
 * Helper func to set URL params and trigger a page reload.
 */
function setParamsAndReload(paramsObj) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(paramsObj)) {
        (value === null || value === undefined || value === true) ? params.delete(key): params.set(key, value);
    }
    
    window.location.href = `${window.location.pathname}?${params.toString()}`;
}

/**
 * Helper func to set URL params without reloading the page.
 */
function setParamsWithoutReload(paramsObj) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(paramsObj)) {
        if (value === null || value === undefined || value === '') {
            params.delete(key);
        } else {
            params.set(key, value);
        }
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.pushState(null, '', newUrl);
}

/**
 * Convert a full IRI to a compact CURIE using the central configuration.
 */
function shortenIri(iri) {
    for (const [baseIRI, prefix] of Object.entries(APP_CONFIG.PREFIXES)) {
        if (iri.startsWith(baseIRI)) return `${prefix}:${iri.substring(baseIRI.length)}`;
    }
    return iri;
}

/**
 * Configures the search box and its event listeners.
 */
function setupSearchBox(onSearchChange) {
    const searchBox = document.getElementById('search-box');
    if (!searchBox) return;

    searchBox.value = getParam('search') || '';

    let searchTimeout;
    searchBox.addEventListener('keyup', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.trim();
            setParamsWithoutReload({
                search: searchTerm || null
            });
            onSearchChange();
        }, 300); // Update after 300ms of inactivity
    });
}

/**
 * Selects the best localized text based on language preferences.
 * @param {object} langMap - An object mapping lang codes to text (e.g., { de: 'Hallo', en: 'Hello' }).
 * @param {string} currentLang - The desired language code.
 * @returns {{text: string, lang: string, isFallback: boolean}}
 */
function getLocalizedText(langMap, currentLang) {
    if (!langMap) return { text: '', lang: '', isFallback: true };
    const langPrefs = [currentLang, 'en', 'de', 'fr', 'it', '']; // Added empty string for untagged literals
    for (const lang of langPrefs) {
        if (langMap[lang]) {
            return {
                text: langMap[lang],
                lang: lang,
                isFallback: lang !== currentLang
            };
        }
    }
    // Fallback to the first available language if none of the preferred ones match
    const firstKey = Object.keys(langMap)[0];
    if (firstKey) {
        return { text: langMap[firstKey], lang: firstKey, isFallback: true };
    }
    return { text: '', lang: '', isFallback: true };
}


/**
 * Processes raw SPARQL results into a structured map with all languages.
 */
function processSparqlResults(bindings, keyField, fields) {
    const dataMap = {};
    bindings.forEach(row => {
        const key = row[keyField]?.value;
        if (!key) return;

        if (!dataMap[key]) {
            dataMap[key] = {
                id: key,
                // Add other non-language-tagged fields
                ...(row.group && {group: mapClassIriToGroup(row.group.value)}),
                ...(row.domain && {domain: row.domain.value}),
                ...(row.range && {range: row.range.value})
            };
            fields.forEach(f => dataMap[key][f] = {});
        }

        fields.forEach(f => {
            if (row[f]) {
                const lang = row[`${f}Lang`]?.value || '';
                dataMap[key][f][lang] = row[f].value;
            }
        });
    });
    return dataMap;
}

/**
 * Main application initialization.
 */
async function init() {
    // Initialize style constants by reading them from the CSS variables
    APP_CONFIG.initializeStylesFromCSS();

    // --- STATE ---
    let currentLang = getParam("lang") || "de";
    let hidePercent = parseInt(getParam("hidePercent") || "0", 10);
    let pinnedNodeId = null,
        pinnedEdgeId = null;
    let allNodesData = {},
        allEdgesData = {},
        allEdgeMetadata = {},
        allClassesData = {},
        allTitles = {},
        nodeLayoutData = {};
    let network, nodesDataset, edgesDataset;
    // --- END STATE ---

    // --- DATA FETCHING & PROCESSING ---
    try {
        const [titleJson, classesJson, edgeMetadataJson, nodesJson, edgesJson, layoutJson] = await Promise.all([
            getSparqlData(TITLE_QUERY), 
            getSparqlData(CLASS_QUERY), 
            getSparqlData(EDGE_METADATA_QUERY),
            getSparqlData(NODE_QUERY), 
            getSparqlData(EDGE_QUERY),
            fetch('layout.json').then(res => res.json())
        ]);

        allNodesData = processSparqlResults(nodesJson.results.bindings, 'id', ['name', 'comment', 'abbreviation']);
        allClassesData = processSparqlResults(classesJson.results.bindings, 'iri', ['label', 'comment']);
        allEdgeMetadata = processSparqlResults(edgeMetadataJson.results.bindings, 'predicate', ['label', 'comment']);
        titleJson.results.bindings.forEach(row => {
            if (row.title) allTitles[row.lang.value || ''] = row.title.value;
        });
        
        layoutJson.forEach(pos => {
            nodeLayoutData[pos.name] = { x: pos.x, y: pos.y, rank: pos.rank };
        });

        edgesJson.results.bindings.forEach(row => {
            const from = row.from.value;
            const to = row.to.value;
            const property = row.property.value;
            const edgeId = `${from}-${property}-${to}`;
            allEdgesData[edgeId] = { id: edgeId, iri: property, from: from, to: to };
        });

    } catch (error) {
        console.error("Fatal error fetching or processing data:", error);
        document.getElementById("systemmapTitle").textContent = APP_CONFIG.UI_TEXT[currentLang].errorLoading;
        return;
    }

    const infoPanel = document.getElementById("infoPanel");

     const applyAllStyles = () => {
        const searchTerm = (getParam("search") || "").toLowerCase();
        const distMap = pinnedNodeId ? getDistancesUpToTwoHops(network, pinnedNodeId) : null;
        
        const originalStyles = Object.fromEntries(nodesDataset.map(n => {
            const style = APP_CONFIG.GROUP_STYLES[n.group] || APP_CONFIG.GROUP_STYLES.Other;
            return [n.id, {
                background: style.background,
                border: style.border,
                fontColor: style.font.color
            }];
        }));

        // Node styling
        const nodeUpdates = nodesDataset.map(n => {
            const originalStyle = originalStyles[n.id];
            let newColor = originalStyle.background;
            let newBorder = originalStyle.border;
            let newFont = originalStyle.fontColor;

            if (distMap) {
                const dist = distMap[n.id];
                if (dist === undefined || dist > 2) {
                    newColor = '#00000000';
                    newBorder = '#00000000';
                    newFont = '#00000000';
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
                color: {
                    background: newColor,
                    border: newBorder
                },
                font: {
                    color: newFont,
                    multi: 'html',
                    face: 'Poppins'
                }
            };
        });
        nodesDataset.update(nodeUpdates);

        // Edge styling logic
        const edgeUpdates = edgesDataset.map(edge => {
            let newColor = '#000000',
                newWidth = 2,
                fontUpdate = {
                    color: '#000000',
                    strokeWidth: 2
                };

            if (distMap) {
                const distFrom = distMap[edge.from];
                const distTo = distMap[edge.to];
                const isOutOfScope = distFrom === undefined || distFrom > 2 || distTo === undefined || distTo > 2;

                if (isOutOfScope) {
                    newColor = '#00000000';
                    newWidth = 1;
                    fontUpdate.color = '#00000000';
                    fontUpdate.strokeWidth = 0;
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
            return {
                id: edge.id,
                color: {
                    color: newColor
                },
                width: newWidth,
                font: fontUpdate
            };
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
        return html;
    };


    /**
     * Creates the HTML for the domain -> range visual diagram using SVG.
     */
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
            </div>
        `;
        
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
            if (pinnedNodeId) {
                showInfo(getNodeInfoHtml(pinnedNodeId));
            } else if (pinnedEdgeId) {
                showInfo(getEdgeInfoHtml(pinnedEdgeId));
            }
        }
        
        if(!document.getElementById('settings-overlay').classList.contains('hidden')) {
            populateSettings();
        }
    };


    // --- INITIALIZE GRAPH & UI ---
    
    /**
     * Filters all nodes and edges based on current URL params and updates the vis datasets.
     */
    function updateGraphData() {
        // 1. Get current filter settings from URL
        hidePercent = parseInt(getParam("hidePercent") || "0", 10);

        const visibleClasses = new Set();
        for (const group of Object.values(APP_CONFIG.GROUP_MAP)) {
            if (getParam(group.toLowerCase()) !== 'false') {
                visibleClasses.add(group);
            }
        }

        const rawPredParam = getParam("predicates");
        const visiblePredicateKeys = rawPredParam === null ? Object.keys(APP_CONFIG.PREDICATE_MAP) : (rawPredParam ? rawPredParam.split(/[;,+\s]+/) : []);
        const invertedPrefixes = Object.fromEntries(Object.entries(APP_CONFIG.PREFIXES).map(([base, prefix]) => [prefix, base]));
        const visiblePredicateIris = new Set(visiblePredicateKeys.map(k => {
            const curie = APP_CONFIG.PREDICATE_MAP[k];
            const [prefix, suffix] = curie.split(':');
            return invertedPrefixes[prefix] ? invertedPrefixes[prefix] + suffix : null;
        }).filter(Boolean));

        // 2. Preliminary Node Filter: Get all nodes that belong to a visible class.
        const preliminaryVisibleNodeIds = new Set(
            Object.values(allNodesData)
                .filter(node => visibleClasses.has(node.group))
                .map(node => node.id)
        );

        // 3. Edge Filter: Get edges where the predicate is visible AND both nodes are in the preliminary set.
        const visibleEdges = Object.values(allEdgesData).filter(edge =>
            visiblePredicateIris.has(edge.iri) &&
            preliminaryVisibleNodeIds.has(edge.from) &&
            preliminaryVisibleNodeIds.has(edge.to)
        );
        
        // 4. Final Node Filter (Connectivity): Now, the only nodes we want are those participating in the visible edges.
        const connectedNodeIds = new Set();
        visibleEdges.forEach(edge => {
            connectedNodeIds.add(edge.from);
            connectedNodeIds.add(edge.to);
        });

        let visibleNodes = Object.values(allNodesData).filter(node => connectedNodeIds.has(node.id));

        // 5. Apply PageRank filter on the connected nodes
        if (hidePercent > 0) {
            visibleNodes.sort((a, b) => (nodeLayoutData[b.id]?.rank || Infinity) - (nodeLayoutData[a.id]?.rank || Infinity));
            const numberToHide = Math.floor(visibleNodes.length * (hidePercent / 100));
            visibleNodes = visibleNodes.slice(0, visibleNodes.length - numberToHide);
        }
        const finalVisibleNodeIds = new Set(visibleNodes.map(n => n.id));

        // 6. Final Edge Pruning: Remove edges that may have been orphaned by the PageRank filter.
        const finalVisibleEdges = visibleEdges.filter(edge => 
            finalVisibleNodeIds.has(edge.from) && finalVisibleNodeIds.has(edge.to)
        );

        // 7. Update vis.js DataSets efficiently
        const currentGraphNodeIds = new Set(nodesDataset.getIds());
        const nodesToAdd = visibleNodes
            .filter(n => !currentGraphNodeIds.has(n.id))
            .map(nodeData => {
                const node = { id: nodeData.id, group: nodeData.group, label: " " };
                if (nodeLayoutData[node.id]) {
                    const scalingFactor = 150;
                    node.x = nodeLayoutData[node.id].x * scalingFactor;
                    node.y = nodeLayoutData[node.id].y * scalingFactor;
                    node.fixed = true;
                }
                return node;
            });

        const nodesToRemove = [...currentGraphNodeIds].filter(id => !finalVisibleNodeIds.has(id));
        if (nodesToAdd.length > 0) nodesDataset.add(nodesToAdd);
        if (nodesToRemove.length > 0) nodesDataset.remove(nodesToRemove);
        
        const currentGraphEdgeIds = new Set(edgesDataset.getIds());
        const finalVisibleEdgeIds = new Set(finalVisibleEdges.map(e => e.id));
        const edgesToAdd = finalVisibleEdges
            .filter(e => !currentGraphEdgeIds.has(e.id))
            .map(edgeData => {
                 const edge = { id: edgeData.id, from: edgeData.from, to: edgeData.to, label: " " };
                 if (APP_CONFIG.DASHED_PREDICATES.includes(edgeData.iri)) {
                     edge.dashes = [3, 4]; edge.length = 500; edge.springConstant = 0.001;
                 }
                 return edge;
            });
            
        const edgesToRemove = [...currentGraphEdgeIds].filter(id => !finalVisibleEdgeIds.has(id));
        if (edgesToAdd.length > 0) edgesDataset.add(edgesToAdd);
        if (edgesToRemove.length > 0) edgesDataset.remove(edgesToRemove);
    }
        
    nodesDataset = new vis.DataSet([]);
    edgesDataset = new vis.DataSet([]);
    
    const container = document.getElementById("network");
    const data = { nodes: nodesDataset, edges: edgesDataset };
    const options = { /* ... */ 
        nodes: { shape: "box", widthConstraint: 150, heightConstraint: 40, chosen: { node: (values, id, selected, hovering) => { if (hovering) { let isDimmed = false; if (pinnedNodeId) { const distMap = getDistancesUpToTwoHops(network, pinnedNodeId); if (distMap[id] === undefined || distMap[id] > 2) { isDimmed = true; } } if (!isDimmed) { values.borderWidth = 3; values.borderColor = "#000"; } } } } },
        edges: { width: 2, selectionWidth: 1, font: { face: "Poppins", color: "#000000" }, chosen: false, arrows: { to: { enabled: true, scaleFactor: 0.8 } }, color: { color: '#000000', highlight: '#000000', inherit: false }, smooth: { type: 'continuous', roundness: 0.5 } },
        groups: APP_CONFIG.GROUP_STYLES,
        interaction: { hover: true, dragNodes: true, hoverConnectedEdges: false, zoomView: true, dragView: true },
        physics: { enabled: false }
    };

    network = new vis.Network(container, data, options);
    
    updateGraphData();

    // --- EVENT LISTENERS ---
    setupSearchBox(applyAllStyles);
    
    setupSettingsPanel(
      () => populateSettings(),
      () => {
        const params = {};
        params.lang = currentLang;
        
        // Handle rank filter slider
        const hidePercentValue = parseInt(document.getElementById('rank-filter-slider').value, 10);
        params.hidePercent = hidePercentValue > 0 ? hidePercentValue : null;

        // Handle class checkboxes
        document.querySelectorAll('#settings-classes input').forEach(cb => {
            params[cb.dataset.group.toLowerCase()] = cb.checked ? null : 'false';
        });

        // Handle predicate checkboxes
        const allPredicateKeys = Object.keys(APP_CONFIG.PREDICATE_MAP);
        const selectedPreds = Array.from(document.querySelectorAll('#settings-predicates input')).filter(cb => cb.checked).map(cb => cb.dataset.key);
        params.predicates = selectedPreds.length === allPredicateKeys.length ? null : selectedPreds.join(';');
        
        setParamsAndReload(params);
    });

    network.on("click", params => {
        let clickedNodeId = params.nodes[0] || null;

        if (clickedNodeId && pinnedNodeId) {
            const distMap = getDistancesUpToTwoHops(network, pinnedNodeId);
            if (distMap[clickedNodeId] === undefined || distMap[clickedNodeId] > 2) {
                clickedNodeId = null; 
            }
        }

        pinnedNodeId = clickedNodeId;
        pinnedEdgeId = clickedNodeId ? null : params.edges[0] || null;

        if (pinnedNodeId) {
            showInfo(getNodeInfoHtml(pinnedNodeId));
        } else if (pinnedEdgeId) {
            showInfo(getEdgeInfoHtml(pinnedEdgeId));
        } else {
            network.unselectAll();
            hideInfo();
        }
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


    // --- FINAL UI POPULATION ---
    updateUIForLanguage();
    applyAllStyles();

    /**
     * Creates the HTML for a node-like icon for the settings panel.
     */
    const createNodeIconHtml = (groupName) => {
        const style = APP_CONFIG.GROUP_STYLES[groupName] || APP_CONFIG.GROUP_STYLES.Other;
        const classIri = APP_CONFIG.GROUP_IRI_MAP[groupName];
        const { text: label } = getLocalizedText(allClassesData[classIri]?.label, currentLang);
        const inlineStyle = `background-color: ${style.background}; border-color: ${style.border}; color: ${style.font.color};`;
        return `<div class="settings-node-icon" style="${inlineStyle}">${label || groupName}</div>`;
    };

    /**
     * Populates the settings form with values from URL params and data.
     */
    function populateSettings() {
        const TEXT = APP_CONFIG.UI_TEXT[currentLang];
        
        // Populate static text
        document.getElementById('settings-title').textContent = TEXT.settings;
        document.getElementById('settings-rank-filter-title').textContent = TEXT.hidePercentLabel;
        document.getElementById('settings-node-classes-title').textContent = TEXT.visibleNodeClasses;
        document.getElementById('settings-relationship-types-title').textContent = TEXT.visibleRelationshipTypes;
        document.getElementById('settingsCancel').textContent = TEXT.cancel;
        document.getElementById('settingsSave').textContent = TEXT.saveAndReload;

        // Populate rank filter slider
        const rankFilterContainer = document.getElementById('settings-rank-filter-container');
        rankFilterContainer.innerHTML = `
            <div class="settings-slider-wrapper">
                <input type="range" min="0" max="90" value="${hidePercent}" class="settings-slider" id="rank-filter-slider">
                <span id="rank-filter-value">${hidePercent}%</span>
            </div>
        `;
        const slider = document.getElementById('rank-filter-slider');
        const sliderValueDisplay = document.getElementById('rank-filter-value');
        slider.addEventListener('input', (e) => {
            sliderValueDisplay.textContent = `${e.target.value}%`;
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

        const classesContainer = document.getElementById('settings-classes');
        classesContainer.innerHTML = '';
        const sortedClasses = Object.values(allClassesData).sort((a,b) => 
            (getLocalizedText(a.label, currentLang).text || '').localeCompare(getLocalizedText(b.label, currentLang).text || '')
        );

        sortedClasses.forEach(classData => {
            const groupName = mapClassIriToGroup(classData.id);
            createCheckboxItem(classesContainer, {
                id: `setting-class-${groupName}`,
                dataKey: 'group',
                dataValue: groupName,
                isChecked: getParam(groupName.toLowerCase()) !== "false",
                label: getLocalizedText(classData.label, currentLang).text || TEXT.noLabel,
                comment: getLocalizedText(classData.comment, currentLang).text || '',
                uri: classData.id,
                curie: shortenIri(classData.id),
                visualHtml: createNodeIconHtml(groupName)
            });
        });

        const predicatesContainer = document.getElementById('settings-predicates');
        predicatesContainer.innerHTML = '';
        const rawPredParam = getParam("predicates");
        const currentPreds = rawPredParam === null ? Object.keys(APP_CONFIG.PREDICATE_MAP) : (rawPredParam ? rawPredParam.split(/[;,+\s]+/) : []);

        const iriToKeyMap = {};
        const invertedPrefixes = Object.fromEntries(Object.entries(APP_CONFIG.PREFIXES).map(([base, prefix]) => [prefix, base]));
        for (const [key, curie] of Object.entries(APP_CONFIG.PREDICATE_MAP)) {
            const [prefix, suffix] = curie.split(':');
            if (invertedPrefixes[prefix]) {
                const iri = invertedPrefixes[prefix] + suffix;
                iriToKeyMap[iri] = key;
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
    }
}


function setupSettingsPanel(onOpen, onSave) {
    const overlay = document.getElementById('settings-overlay');
    const trigger = document.getElementById('settings-trigger');

    const openSettings = () => {
        onOpen();
        overlay.classList.remove('hidden');
    };
    const closeSettings = () => overlay.classList.add('hidden');

    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        openSettings();
    });
    document.getElementById('settingsCancel').addEventListener('click', closeSettings);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSettings();
    });
    document.getElementById('settingsSave').addEventListener('click', onSave);
}

document.addEventListener("DOMContentLoaded", init);