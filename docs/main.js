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
    if (params.get('infopanel') === 'true') params.delete('infopanel');

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
 * Main application initialization.
 */
async function init() {
    // Initialize style constants by reading them from the CSS variables
    APP_CONFIG.initializeStylesFromCSS();

    const currentLang = getParam("lang") || "de";
    let pinnedNodeId = null,
        pinnedEdgeId = null;

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
        const htmlLabel = labelLang && labelLang !== currentLang ?
            `<b>${labelLang.toUpperCase()}:</b> <i>${shortenLabel(label, abbreviation)}</i>` :
            `<b>${shortenLabel(label, abbreviation)}</b>`;

        const groupName = mapClassIriToGroup(row.group.value);
        return {
            id: row.id.value,
            label: htmlLabel,
            group: groupName,
            data: {
                iri: row.id.value,
                fullLabel: label,
                abbreviation,
                comment: row.comment.value,
                isFallback: labelLang && labelLang !== currentLang,
                labelLang
            }
        };
    });

    const edges = edgesJson.results.bindings.map(row => {
        const edge = {
            from: row.from.value,
            to: row.to.value,
            label: row.label.value,
            comment: row.comment.value,
            iri: row.id.value
        };

        // Use central config for dashed predicates
        if (APP_CONFIG.DASHED_PREDICATES.includes(edge.iri)) {
            edge.dashes = [2, 10];
            edge.length = 500;
            edge.springConstant = 0.001;
        }
        return edge;
    });

    const nodesDataset = new vis.DataSet(nodes);
    const edgesDataset = new vis.DataSet(edges);
    const container = document.getElementById("network");
    const data = {
        nodes: nodesDataset,
        edges: edgesDataset
    };

    const options = {
        nodes: {
            shape: "box",
            widthConstraint: 150,
            heightConstraint: 40,
            chosen: {
                node: (values, id, selected, hovering) => {
                    // Only apply hover effect if no node is pinned, OR if the hovered
                    // node is within the 2-hop distance of the pinned node.
                    if (hovering) {
                        let isDimmed = false;
                        if (pinnedNodeId) {
                            const distMap = getDistancesUpToTwoHops(network, pinnedNodeId);
                            if (distMap[id] === undefined || distMap[id] > 2) {
                                isDimmed = true;
                            }
                        }
                        // Apply highlight only if the node is not dimmed
                        if (!isDimmed) {
                            values.borderWidth = 3;
                            values.borderColor = "#000";
                        }
                    }
                }
            }
        },
        edges: {
            width: 2,
            selectionWidth: 1,
            font: {
                face: "Poppins",
                color: "#000000"
            },
            chosen: false,
            arrows: {
                to: {
                    enabled: true
                }
            },
            color: {
                color: '#000000',
                highlight: '#000000',
                inherit: false
            }
        },
        groups: APP_CONFIG.GROUP_STYLES, // Use styles from config
        interaction: {
            hover: true,
            dragNodes: true,
            hoverConnectedEdges: false,
            zoomView: true,
            dragView: true
        },
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -9000,
                centralGravity: 0.05,
                springLength: 250,
                springConstant: 0.2
            },
            stabilization: {
                iterations: 100
            }
        }
    };

    const network = new vis.Network(container, data, options);

    // Get original styles from the central config
    const originalStyles = Object.fromEntries(nodes.map(n => {
        const style = APP_CONFIG.GROUP_STYLES[n.group] || APP_CONFIG.GROUP_STYLES.Other;
        return [n.id, {
            background: style.background,
            border: style.border,
            fontColor: style.font.color
        }];
    }));

    const infoPanel = document.getElementById("infoPanel");

    /**
     * Central function to apply all dynamic styling (dimming, search) to nodes and edges.
     */
    const applyAllStyles = () => {
        const searchTerm = (getParam("search") || "").toLowerCase();
        const distMap = pinnedNodeId ? getDistancesUpToTwoHops(network, pinnedNodeId) : null;

        // Node styling
        const nodeUpdates = nodes.map(n => {
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

            // Apply search highlighting, using the central config color
            if (searchTerm) {
                const isMatch = (
                    (n.data.fullLabel || '').toLowerCase().includes(searchTerm) ||
                    (n.data.comment || '').toLowerCase().includes(searchTerm) ||
                    (n.data.abbreviation || '').toLowerCase().includes(searchTerm)
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
        const allEdges = edgesDataset.get({
            returnType: 'Array'
        });
        const edgeUpdates = allEdges.map(edge => {
            let newColor = '#000000',
                newWidth = 2,
                fontUpdate = {
                    color: '#000000'
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
                    const maxDist = Math.max(distFrom, distTo);
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

    setupSearchBox(applyAllStyles);
    applyAllStyles();

    const showInfo = (html) => {
        infoPanel.innerHTML = html;
        infoPanel.classList.remove("hidden");
    };
    const hideInfo = () => {
        infoPanel.classList.add("hidden");
        infoPanel.innerHTML = "";
        infoPanel.classList.remove("fixed");
    };

    // in main.js

    network.on("click", params => {
        let clickedNodeId = params.nodes[0] || null;

        // If a node is currently pinned, check if the newly clicked node is a dimmed one.
        // If so, treat it as a click on the background to un-pin everything.
        if (clickedNodeId && pinnedNodeId) {
            const distMap = getDistancesUpToTwoHops(network, pinnedNodeId);
            if (distMap[clickedNodeId] === undefined || distMap[clickedNodeId] > 2) {
                clickedNodeId = null; // Ignore click on dimmed node
            }
        }

        pinnedNodeId = clickedNodeId;
        // Only select an edge if no node was selected
        pinnedEdgeId = clickedNodeId ? null : params.edges[0] || null;

        if (pinnedNodeId) {
            const selectedNode = nodesDataset.get(pinnedNodeId);
            showInfo(getNodeInfoHtml(selectedNode.data, selectedNode.group));
        } else if (pinnedEdgeId) {
            showInfo(getEdgeInfoHtml(edgesDataset.get(pinnedEdgeId)));
        } else {
            // This now correctly triggers when clicking the background OR a dimmed node
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

    const getNodeInfoHtml = ({
        iri,
        fullLabel,
        abbreviation,
        comment,
        isFallback,
        labelLang
    }, group) => {
        // Use styles from central config
        const chipStyle = APP_CONFIG.GROUP_STYLES[group] || APP_CONFIG.GROUP_STYLES.Other;
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

        if (comment) {
            html += `<p class="info-panel-comment"><small>${comment}</small></p>`;
        }

        return html;
    };

    const getEdgeInfoHtml = ({
        iri,
        label,
        comment
    }) => {
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

    const openSettings = () => {
        populateSettings(classRows, predicateRows);
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

    document.getElementById('settingsSave').addEventListener('click', () => {
        const params = {};
        params.lang = document.getElementById('settingsLanguage').value;
        params.infopanel = document.getElementById('settingsFocusMode').checked ? 'false' : null;
        document.querySelectorAll('#settings-classes input').forEach(cb => {
            params[cb.dataset.group.toLowerCase()] = cb.checked ? null : 'false';
        });

        // Use central config for predicate keys
        const allPredicateKeys = Object.keys(APP_CONFIG.PREDICATE_MAP);
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

    const createCheckboxItem = (container, {
        id,
        dataKey,
        dataValue,
        isChecked,
        label,
        comment,
        uri,
        curie,
        swatchColor
    }) => {
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
            id: `setting-class-${groupName}`,
            dataKey: 'group',
            dataValue: groupName,
            isChecked: getParam(groupName.toLowerCase()) !== "false",
            label: row.label.value || 'No label',
            comment: row.comment.value || 'No comment',
            uri: row.iri.value,
            curie: shortenIri(row.iri.value),
            swatchColor: APP_CONFIG.GROUP_STYLES[groupName]?.background
        });
    });

    const predicatesContainer = document.getElementById('settings-predicates');
    predicatesContainer.innerHTML = '';
    const rawPredParam = getParam("predicates");
    const currentPreds = rawPredParam === null ? Object.keys(APP_CONFIG.PREDICATE_MAP) : (rawPredParam ? rawPredParam.split(/[;,+\s]+/) : []);

    // Create a map of full IRIs to their short keys (e.g., 'http://...#isPartOf' -> 'isPartOf')
    const iriToKeyMap = {};
    const invertedPrefixes = Object.fromEntries(
        Object.entries(APP_CONFIG.PREFIXES).map(([base, prefix]) => [prefix, base])
    );
    for (const [key, curie] of Object.entries(APP_CONFIG.PREDICATE_MAP)) {
        const [prefix, suffix] = curie.split(':');
        if (invertedPrefixes[prefix]) {
            const iri = invertedPrefixes[prefix] + suffix;
            iriToKeyMap[iri] = key;
        }
    }

    predicateRows.sort((a, b) => (a.label.value || '').localeCompare(b.label.value || '')).forEach(row => {
        const key = iriToKeyMap[row.iri.value];
        if (key) {
            createCheckboxItem(predicatesContainer, {
                id: `setting-pred-${key}`,
                dataKey: 'key',
                dataValue: key,
                isChecked: currentPreds.includes(key),
                label: row.label.value || 'No label',
                uri: row.iri.value,
                curie: shortenIri(row.iri.value)
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", init);