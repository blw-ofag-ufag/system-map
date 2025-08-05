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
 * Used for settings that require refetching data.
 */
function setParamsAndReload(paramsObj) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(paramsObj)) {
        (value === null || value === undefined || value === true) ? params.delete(key) : params.set(key, value);
    }
    if (params.get('infopanel') === 'true') params.delete('infopanel');

    window.location.href = `${window.location.pathname}?${params.toString()}`;
}

/**
 * Helper func to set URL params without reloading the page.
 * Used for interactive filtering like search.
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
 * Convert a full IRI to a compact CURIE.
 */
function shortenIri(iri) {
    const PREFIXES = {
      "http://www.w3.org/2000/01/rdf-schema#": "rdfs", "http://www.w3.org/2002/07/owl#": "owl",
      "https://agriculture.ld.admin.ch/system-map/": "systemmap", "http://schema.org/": "schema",
      "http://www.w3.org/ns/dcat#": "dcat", "http://www.w3.org/ns/prov#": "prov",
      "http://purl.org/ontology/service#": "service", "http://purl.org/dc/terms/": "dcterms",
      "https://register.ld.admin.ch/zefix/company/": "zefix"
    };
    for (const [baseIRI, prefix] of Object.entries(PREFIXES)) {
      if (iri.startsWith(baseIRI)) return `${prefix}:${iri.substring(baseIRI.length)}`;
    }
    return iri;
}

const groupColors = {
    System:       { background: "#1967D3", border: "#000000", font: { color: "#FFFFFF" } },
    Information:  { background: "#354C5D", border: "#000000", font: { color: "#FFFFFF" } },
    Organization: { background: "#D2D9E4", border: "#000000", font: { color: "#000000" } },
    Service:      { background: "#DBCCA0", border: "#000000", font: { color: "#000000" } },
    Other:        { background: "#D2D9E4", border: "#000000", font: { color: "#FFFFFF" } }
};

const SEARCH_HIGHLIGHT_COLOR = {
    background: "#ffa551",
    border: "#ffa551",
    font: { color: "#000000" }
};

/**
 * Configures the search box and its event listeners.
 * @param {function} onSearchChange - Callback function to execute when the search term changes.
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
            setParamsWithoutReload({ search: searchTerm || null });
            onSearchChange();
        }, 300); // Update after 300ms of inactivity
    });
}

/**
 * Main application initialization.
 */
async function init() {
    const currentLang = getParam("lang") || "de";
    let pinnedNodeId = null, pinnedEdgeId = null;

    if (getParam("infopanel") === "false") {
        document.getElementById("infoPanel").classList.add("param-hidden");
    }

    try {
        const titleJson = await getSparqlData(TITLE_QUERY);
        document.getElementById("systemmapTitle").textContent = titleJson.results.bindings[0]?.title.value || "System Map";
    } catch (error) {
        console.error("Error fetching title:", error);
    }
    
    const [classesJson, predicatesJson, nodesJson, edgesJson] = await Promise.all([
        getSparqlData(CLASS_QUERY), getSparqlData(PREDICATES_QUERY),
        getSparqlData(NODE_QUERY), getSparqlData(EDGE_QUERY)
    ]);

    // Create a map from group name to its translated label for the info panel chip
    const classLabelsByGroup = {};
    classesJson.results.bindings.forEach(row => {
        const groupName = mapClassIriToGroup(row.iri.value);
        classLabelsByGroup[groupName] = row.label.value || groupName;
    });

    setupSettingsPanel(classesJson.results.bindings, predicatesJson.results.bindings);

    const nodes = nodesJson.results.bindings.map(row => {
        const label = row.displayLabel.value;
        const abbreviation = row.abbreviation.value;
        const labelLang = row.displayLabel["xml:lang"] || "";
        const htmlLabel = labelLang && labelLang !== currentLang
            ? `<b>${labelLang.toUpperCase()}:</b> <i>${shortenLabel(label, abbreviation)}</i>`
            : `<b>${shortenLabel(label, abbreviation)}</b>`;
        
        const groupName = mapClassIriToGroup(row.group.value);
        return {
          id: row.id.value,
          label: htmlLabel,
          group: groupName,
          data: { iri: row.id.value, fullLabel: label, abbreviation, comment: row.comment.value, isFallback: labelLang && labelLang !== currentLang, labelLang }
        };
    });

    const edges = edgesJson.results.bindings.map(row => {
        const edge = { from: row.from.value, to: row.to.value, label: row.label.value, comment: row.comment.value, iri: row.id.value };
        const dashedPredicates = [
            "http://www.w3.org/ns/prov#wasDerivedFrom", "http://purl.org/ontology/service#consumes",
            "https://agriculture.ld.admin.ch/system-map/owns", "https://agriculture.ld.admin.ch/system-map/usesMasterData",
            "https://agriculture.ld.admin.ch/system-map/access", "https://agriculture.ld.admin.ch/system-map/references"
        ];
        if (dashedPredicates.includes(edge.iri)) {
            edge.dashes = [2, 10];
            edge.length = 500;
            edge.springConstant = 0.001;
        }
        return edge;
    });

    const nodesDataset = new vis.DataSet(nodes);
    const edgesDataset = new vis.DataSet(edges);
    const container = document.getElementById("network");
    const data = { nodes: nodesDataset, edges: edgesDataset };

    const options = {
        nodes: {
            shape: "box", widthConstraint: 150, heightConstraint: 40,
            chosen: { node: (v, i, s, h) => { if (h) { v.borderWidth = 3; v.borderColor = "#000"; } } }
        },
        edges: {
            width: 2,
            selectionWidth: 1,
            font: { face: "Poppins", color: "#000000" }, // Set default font color
            chosen: false,
            arrows: { to: { enabled: true } },
            color: { 
                color: '#000000',
                highlight: '#000000',
                inherit: false 
            }
        },
        groups: groupColors,
        interaction: { hover: true, dragNodes: true, hoverConnectedEdges: false, zoomView: true, dragView: true },
        physics: { enabled: true, barnesHut: { gravitationalConstant: -9000, centralGravity: 0.05, springLength: 250, springConstant: 0.2 }, stabilization: { iterations: 100 } }
    };

    const network = new vis.Network(container, data, options);
    
    const originalStyles = Object.fromEntries(nodes.map(n => {
        const style = groupColors[n.group] || groupColors.Other;
        return [n.id, { background: style.background, border: style.border, fontColor: style.font.color }];
    }));
    
    const infoPanel = document.getElementById("infoPanel");

    /**
     * Central function to apply all dynamic styling (dimming, search) to nodes and edges.
     */
    const applyAllStyles = () => {
        const searchTerm = (getParam("search") || "").toLowerCase();
        const distMap = pinnedNodeId ? getDistancesUpToTwoHops(network, pinnedNodeId) : null;

        // --- 1. Update Node Styles ---
        const nodeUpdates = nodes.map(n => {
            const originalStyle = originalStyles[n.id];
            let newColor = originalStyle.background;
            let newBorder = originalStyle.border;
            let newFont = originalStyle.fontColor;

            // Apply dimming/hiding based on distance from the pinned node
            if (distMap) {
                const dist = distMap[n.id];
                if (dist === undefined || dist > 2) {
                    // Hide nodes that are more than 2 hops away
                    newColor = '#00000000'; // Transparent
                    newBorder = '#00000000';
                    newFont = '#00000000';
                } else {
                    // Dim nodes at 2 hops, keep 0 and 1 hops fully visible
                    const ratio = (dist === 2) ? 0.5 : 0;
                    newColor = blendHexColors(originalStyle.background, "#FAFAFA", ratio);
                    newBorder = blendHexColors(originalStyle.border, "#FAFAFA", ratio);
                    newFont = blendHexColors(originalStyle.fontColor, "#FAFAFA", ratio);
                }
            }

            // Apply search highlighting (this will override the dimming/hiding)
            if (searchTerm) {
                const isMatch = (
                    (n.data.fullLabel || '').toLowerCase().includes(searchTerm) ||
                    (n.data.comment || '').toLowerCase().includes(searchTerm) ||
                    (n.data.abbreviation || '').toLowerCase().includes(searchTerm)
                );
                if (isMatch) {
                    newColor = SEARCH_HIGHLIGHT_COLOR.background;
                    newBorder = SEARCH_HIGHLIGHT_COLOR.border;
                    newFont = SEARCH_HIGHLIGHT_COLOR.font.color;
                }
            }

            return {
                id: n.id,
                color: { background: newColor, border: newBorder },
                font: { color: newFont, multi: 'html', face: 'Poppins' }
            };
        });
        nodesDataset.update(nodeUpdates);

        // --- 2. Update Edge Styles ---
        const allEdges = edgesDataset.get({ returnType: 'Array' });
        const edgeUpdates = allEdges.map(edge => {
            let newColor = '#000000';
            let newWidth = 2;
            let newFontColor = '#000000';

            if (distMap) {
                const distFrom = distMap[edge.from];
                const distTo = distMap[edge.to];
                
                // An edge is out of scope if either of its nodes is out of scope (undefined or > 2 hops)
                const isOutOfScope = distFrom === undefined || distFrom > 2 || distTo === undefined || distTo > 2;

                if (isOutOfScope) {
                    // Hide the edge completely
                    newColor = '#00000000';
                    newFontColor = '#00000000';
                    newWidth = 1;
                } else {
                    // Edge is within the 2-hop subgraph. Dim it if it connects to a 2-hop node.
                    const maxDist = Math.max(distFrom, distTo);
                    if (maxDist === 2) {
                        const dimRatio = 0.8;
                        newColor = blendHexColors('#000000', '#FAFAFA', dimRatio);
                        newFontColor = blendHexColors('#000000', '#FAFAFA', dimRatio);
                        newWidth = 1;
                    } else {
                        // This is a "core" edge (between 0-1, 1-1 hop nodes). Make it prominent.
                        newColor = '#000000';
                        newFontColor = '#000000';
                        newWidth = 2;
                    }
                }
            }

            return {
                id: edge.id,
                color: { color: newColor },
                width: newWidth,
                font: { color: newFontColor }
            };
        });
        edgesDataset.update(edgeUpdates);
    };
    
    // Setup search box and apply initial styles (e.g., from URL on page load)
    setupSearchBox(applyAllStyles);
    applyAllStyles();

    const showInfo = (html) => { infoPanel.innerHTML = html; infoPanel.classList.remove("hidden"); };
    const hideInfo = () => { infoPanel.classList.add("hidden"); infoPanel.innerHTML = ""; infoPanel.classList.remove("fixed"); };

    network.on("click", params => {
        pinnedNodeId = params.nodes[0] || null;
        pinnedEdgeId = params.edges[0] || null;

        if (pinnedNodeId) {
            pinnedEdgeId = null;
            const selectedNode = nodesDataset.get(pinnedNodeId);
            showInfo(getNodeInfoHtml(selectedNode.data, selectedNode.group));
        } else if (pinnedEdgeId) {
            pinnedNodeId = null;
            showInfo(getEdgeInfoHtml(edgesDataset.get(pinnedEdgeId)));
        } else {
            network.unselectAll();
            hideInfo();
        }
        
        applyAllStyles();

        if (pinnedNodeId || pinnedEdgeId) {
            infoPanel.classList.add("fixed");
        } else {
            infoPanel.classList.remove("fixed");
        }
    });

    const getNodeInfoHtml = ({ iri, fullLabel, abbreviation, comment, isFallback, labelLang }, group) => {
        const chipStyle = groupColors[group] || groupColors.Other;
        const chipLabel = classLabelsByGroup[group] || group;
    
        const inlineStyle = `
            background-color: ${chipStyle.background};
            border-color: ${chipStyle.border};
            color: ${chipStyle.font.color};
        `;
    
        const classChipHtml = `<span class="info-panel-chip" style="${inlineStyle}">${chipLabel}</span>`;
    
        let titleHtml = '<h4>';
        titleHtml += isFallback ? `${labelLang.toUpperCase()}: <i>${fullLabel}</i>` : fullLabel;
        if (abbreviation) titleHtml += ` (${abbreviation})`;
        titleHtml += '</h4>';
    
        let html = `
            <a href="${iri}" target="_blank"><small><code>${shortenIri(iri)}</code></small></a>
            <div class="info-panel-header">
                ${titleHtml}${classChipHtml}
            </div>`;
        // html += `<a href="${iri}" target="_blank"><small><code>${shortenIri(iri)}</code></small></a>`;
    
        if (comment) {
            html += `<p class="info-panel-comment"><small>${comment}</small></p>`;
        }
    
        return html;
    };
    
    const getEdgeInfoHtml = ({ iri, label, comment }) => {
        let html = iri ? `<a href="${iri}" target="_blank"><small><code>${shortenIri(iri)}</code></small></a><br/>` : '';
        html += `<h4>${label}</h4>`;
        if (comment) html += `<p><small>${comment}</small></p>`;
        return html;
    };
}

/**
 * Manages the settings panel logic, events, and state.
 */
function setupSettingsPanel(classRows, predicateRows) {
    const overlay = document.getElementById('settings-overlay');
    const trigger = document.getElementById('settings-trigger');

    const openSettings = () => { populateSettings(classRows, predicateRows); overlay.classList.remove('hidden'); };
    const closeSettings = () => overlay.classList.add('hidden');

    trigger.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
    document.getElementById('settingsCancel').addEventListener('click', closeSettings);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });

    document.getElementById('settingsSave').addEventListener('click', () => {
        const params = {};
        params.lang = document.getElementById('settingsLanguage').value;
        params.infopanel = document.getElementById('settingsFocusMode').checked ? 'false' : null;
        document.querySelectorAll('#settings-classes input').forEach(cb => { params[cb.dataset.group.toLowerCase()] = cb.checked ? null : 'false'; });
        const allPredicateKeys = Object.keys(PREDICATE_MAP);
        const selectedPreds = Array.from(document.querySelectorAll('#settings-predicates input')).filter(cb => cb.checked).map(cb => cb.dataset.key);
        params.predicates = selectedPreds.length === allPredicateKeys.length ? null : selectedPreds.join(';');
        
        setParamsAndReload(params);
    });
}

/**
 * Populates the settings form with values from URL params and SPARQL queries.
 */
function populateSettings(classRows, predicateRows) {
    document.getElementById('settingsLanguage').value = getParam("lang") || "de";
    document.getElementById('settingsFocusMode').checked = getParam("infopanel") === "false";

    const createCheckboxItem = (container, { id, dataKey, dataValue, isChecked, label, comment, uri, curie, swatchColor }) => {
        let html = `<div class="settings-list-item">`;
        if (swatchColor) html += `<div class="settings-list-swatch" style="background: ${swatchColor}; border-color: #555;"></div>`;
        html += `<div class="settings-list-item-content">
                    <label>
                        <input type="checkbox" id="${id}" data-${dataKey}="${dataValue}" ${isChecked ? 'checked' : ''}>
                        <strong>${label}</strong>
                        <code class="settings-curie"><a href="${uri}" target="_blank">${curie}<a></code>
                    </label>
                    ${comment ? `<span class="settings-list-item-comment">${comment}</span>`:``}
                </div></div>`;
        container.insertAdjacentHTML('beforeend', html);
    };

    const classesContainer = document.getElementById('settings-classes');
    classesContainer.innerHTML = '';
    classRows.forEach(row => {
        const groupName = mapClassIriToGroup(row.iri.value);
        createCheckboxItem(classesContainer, {
            id: `setting-class-${groupName}`, dataKey: 'group', dataValue: groupName,
            isChecked: getParam(groupName.toLowerCase()) !== "false",
            label: row.label.value || 'No label',
            comment: row.comment.value || 'No comment',
            uri: row.iri.value,
            curie: shortenIri(row.iri.value),
            swatchColor: groupColors[groupName]?.background
        });
    });

    const predicatesContainer = document.getElementById('settings-predicates');
    predicatesContainer.innerHTML = '';
    const rawPredParam = getParam("predicates");
    const currentPreds = rawPredParam === null ? Object.keys(PREDICATE_MAP) : (rawPredParam ? rawPredParam.split(/[;,+\s]+/) : []);
    
    const iriToKeyMap = {};
    const prefixMap = {
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#", "owl": "http://www.w3.org/2002/07/owl#",
        "systemmap": "https://agriculture.ld.admin.ch/system-map/", "schema": "http://schema.org/",
        "dcat": "http://www.w3.org/ns/dcat#", "prov": "http://www.w3.org/ns/prov#",
        "service": "http://purl.org/ontology/service#", "dcterms": "http://purl.org/dc/terms/"
    };
    for (const key in PREDICATE_MAP) {
        const [prefix, suffix] = PREDICATE_MAP[key].split(':');
        if (prefixMap[prefix]) { iriToKeyMap[prefixMap[prefix] + suffix] = key; }
    }
    
    predicateRows.sort((a,b) => (a.label.value || '').localeCompare(b.label.value || '')).forEach(row => {
        const key = iriToKeyMap[row.iri.value];
        if (key) {
            createCheckboxItem(predicatesContainer, {
                id: `setting-pred-${key}`, dataKey: 'key', dataValue: key,
                isChecked: currentPreds.includes(key),
                label: row.label.value || 'No label',
                uri: row.iri.value,
                curie: shortenIri(row.iri.value)
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", init);