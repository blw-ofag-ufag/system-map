/**
 * Optional: shorten label if it's too long
 */
function shortenLabel(label, abbreviation) {
    // If combined length is fairly short, show them fully
    if (label.length + abbreviation.length <= 40) {
        return abbreviation ?
            `${label} (${abbreviation})` :
            label;
    }

    // If label alone is short enough, show label
    if (label.length <= 40) return label;

    // Otherwise prefer abbreviation if present
    if (abbreviation) return abbreviation;

    // Or else truncate
    return label.substring(0, 40) + "...";
}

/**
 * BFS up to 2 hops. Returns { nodeId: distance }.
 */
function getDistancesUpToTwoHops(network, startId) {
    const distMap = {};
    distMap[startId] = 0;
    const queue = [startId];

    while (queue.length > 0) {
        const current = queue.shift();
        const currentDist = distMap[current];
        if (currentDist < 2) {
            const neighbors = network.getConnectedNodes(current);
            neighbors.forEach((nbr) => {
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
 * ratio=0 => c1, ratio=1 => c2
 */
function blendHexColors(c1, c2, ratio) {
    c1 = c1.replace("#", "");
    c2 = c2.replace("#", "");
    const r1 = parseInt(c1.substring(0, 2), 16);
    const g1 = parseInt(c1.substring(2, 4), 16);
    const b1 = parseInt(c1.substring(4, 6), 16);

    const r2 = parseInt(c2.substring(0, 2), 16);
    const g2 = parseInt(c2.substring(2, 4), 16);
    const b2 = parseInt(c2.substring(4, 6), 16);

    const r = Math.round(r1 + ratio * (r2 - r1));
    const g = Math.round(g1 + ratio * (g2 - g1));
    const b = Math.round(b1 + ratio * (b2 - b1));

    return (
        "#" + [r, g, b]
        .map(val => val.toString(16).padStart(2, "0"))
        .join("")
    );
}

/**
 * Helper func to get value of an URL param
 * @param {string} name name of the URL param
 * @returns value of the URL param with given name
 */
function getParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name)
}

/**
 * Helper func to set value of an URL param and redirects
 * @paramsObj object with key-value pairs of URL params to set
 */
function setParamsRedirect(paramsObj) {
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(paramsObj)) {
        params.set(key, value);
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.location.href = newUrl;
}

/**
 * Event-function to show or hide certain classes, called by checkboxes
 * @param {*} element DOM-element of a checkbox input
 */
function toggleGroup(element) {
    const groupName = JSON.parse(element.getAttribute("data-group"));
    const checked = element.checked
    setParamsRedirect({ [groupName.toLowerCase()]: checked });
}

/**
 * Event-function to change the language of the webapp
 * @param {*} element DOM-element of the language select
 */
function changeLanguage(element) {
    const lang = element.value
    setParamsRedirect({lang: lang})
}

/**
 * Event-function to toggle focus mode of the webapp
 * @param {*} element DOM-element of the focus mode checkbox
 */
function toggleFocusMode(element) {
    const isChecked = element.checked;
    setParamsRedirect({
        infopanel: isChecked ? "false" : "true",
        legend: isChecked ? "false" : "true"
    });
}


/**
 * Name of focus mode label based on language
 */
const focusModeLabels = {
    "de": "Fokus-Modus",
    "fr": "Mode Focus",
    "it": "Modalità Focus",
    "en": "Focus Mode"
}

/**
 * Build the network and set up the BFS highlight + info panel
 */
async function init() {

    // what language did the user pick?  (falls back to "de")
    const currentLang = getParam("lang") || "de";

    // Track if a node/edge is pinned (i.e. clicked) so that the info panel remains fixed.
    let pinnedNodeId = null;
    let pinnedEdgeId = null;

    // Hide info panel and legend if URL params are set
    setComponentsVisibility()

    setLanguageOption()

    async function fetchAndDisplayTitle() {
        try {
            const titleJson = await getSparqlData(TITLE_QUERY);
            // Assuming the first binding contains the title
            const title = titleJson.results.bindings[0]?.title.value;
            if (title) {
            const titleEl = document.getElementById("systemmapTitle");
            titleEl.textContent = title;
            } else {
            console.warn("No title found in SPARQL response.");
            }
        } catch (error) {
            console.error("Error fetching title:", error);
        }
    }

    await fetchAndDisplayTitle();
    
    // 1) Fetch node & edge data from your queries (defined in query.js)
    const classesJson = await getSparqlData(CLASS_QUERY);
    const nodesJson = await getSparqlData(NODE_QUERY);
    const edgesJson = await getSparqlData(EDGE_QUERY);

    // 2) Parse them into Vis-friendly arrays
    const nodes = nodesJson.results.bindings.map(row => {
        const iri           = row.id.value;
        const groupIri      = row.group.value;
        const labelObj      = row.displayLabel;
        const abbrObj       = row.abbreviation;
        const commentObj    = row.comment;
      
        const label         = labelObj ? labelObj.value : "?";
        const abbreviation  = abbrObj ? abbrObj.value  : "";
        const comment       = commentObj ? commentObj.value : "";
      
        // ---------- language test ----------
        const currentLang   = getParam("lang") || "de";
        const labelLang     = labelObj && labelObj["xml:lang"] ? labelObj["xml:lang"] : "";
        const isFallback    = labelLang && labelLang !== currentLang;
      
        // ---------- html for the node ----------
        const htmlLabel = isFallback
            ? `<i>${shortenLabel(label, abbreviation)}</i>`   // italic - no bold
            : `<b>${shortenLabel(label, abbreviation)}</b>`; // bold as before
      
        return {
          id: iri,
          label: htmlLabel,
          group: mapClassIriToGroup(groupIri),
      
          // data for the info panel
          data: {
            iri,
            fullLabel: label,
            abbreviation,
            comment,
            isFallback
          }
        };
    });

    const edges = edgesJson.results.bindings.map(row => {
        const edge = {
            from: row.from.value,
            to: row.to.value,
            label: row.label.value,
            comment: row.comment ? row.comment.value : ""
        };
        
        // If this edge represents an "informs" relationship,
        // add dashed styling and increase its length.
        if (row.id.value === "http://www.w3.org/ns/prov#wasDerivedFrom" ||
            row.id.value === "http://purl.org/ontology/service#consumes" ||
            row.id.value === "https://agriculture.ld.admin.ch/system-map/usesMasterData" ||
            row.id.value === "https://agriculture.ld.admin.ch/system-map/access" ||
            row.id.value === "https://agriculture.ld.admin.ch/system-map/references" ) {

            edge.dashes = [3, 7]; // Dash pattern: 5px dash, 5px gap
            edge.length = 300;    // Increase edge length to allow more spacing
        }
        
        return edge;
    });

    // 3) Create Vis DataSets
    const nodesDataset = new vis.DataSet(nodes);
    const edgesDataset = new vis.DataSet(edges);

    // 4) Create the network
    const container = document.getElementById("network");
    const data = {
        nodes: nodesDataset,
        edges: edgesDataset
    };

    // Keep your old physics/layout/chosen styles
    const options = {

        nodes: {
            shape: "box",
            widthConstraint: 150,
            heightConstraint: 50,
            font: {
                color: "#000000",
                face: "Poppins",
                multi: "html"
            },
            chosen: {
                node: function(values, id, selected, hovering) {
                    if (hovering) {
                        values.borderWidth = 3;; // Set border thickness on hover
                        values.borderColor = "#000000"; // Yellow border on hover
                    }
                }
            }
        },
        edges: {
            width: 1,
            selectionWidth: 1,
            font: {
                face: "Poppins"
            },
            chosen: false,
            arrows: {
                to: {
                    enabled: true
                },
                from: {
                    enabled: false
                }
            }
        },
        groups: {
            System:      {  color: { background: "#FF7F51", border: "#000000" }, font: { color: "#000000" } },
            Information: {  color: { background: "#ADB6C4", border: "#000000" }, font: { color: "#000000" } },
            Organization: { color: { background: "#383743", border: "#000000" }, font: { color: "#FFFFFF" } },
            Service: {      color: { background: "#0080ae", border: "#000000" }, font: { color: "#FFFFFF" } },
            Other: {        color: { background: "#383743", border: "#000000" }, font: { color: "#FFFFFF" } },
        },
        interaction: {
            hover: true,
            dragNodes: true,
            hoverConnectedEdges: true,
            selectConnectedEdges: false,
            zoomView: true,
            dragView: true
        },
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -8000, // negative in order to have nodes push each other appart
                centralGravity: 0.1, // increase for stronger central gravity, i.e. that nodes move to the center
                springLength: 200,
                springConstant: 0.1 // increase to make spring more rigid
            },
            stabilization: {
                iterations: 100
            }
        }
    };

    const network = new vis.Network(container, data, options);

    // 5) The BFS highlight color-blending
    //    Map group => original background/border/font
    const groupColors = {
        System: {       background: "#FF7F51", border: "#000000", font: "#000000" },
        Information: {  background: "#ADB6C4", border: "#000000", font: "#000000" },
        Organization: { background: "#383743", border: "#000000", font: "#FFFFFF" },
        Service: {      background: "#0080ae", border: "#000000", font: "#FFFFFF" },
        Other: {        background: "#383743", border: "#000000", font: "#FFFFFF" }
    };

    // Store each node’s “original” color
    const originalStyles = {};
    nodes.forEach(n => {
        const c = groupColors[n.group] || groupColors.Other;
        originalStyles[n.id] = {
            background: c.background,
            border: c.border,
            fontColor: c.font
        };
    });

    // 6) The info panel (top-right)
    const infoPanel = document.getElementById("infoPanel");

    function showNodeInfo(nodeData) {
        const {
            iri,
            fullLabel,
            abbreviation,
            comment,
            isFallback
            } = nodeData.data;
            
            let html = `<a href='${iri}' target='blank'><small><code>${iri}</code></small></a><br>`;
            html += `<h4>${isFallback ? "<i>" : ""}${fullLabel}`;
            if (abbreviation) html += ` (${abbreviation})`;
            html += `${isFallback ? "</i>" : ""}</h4>`;
            
            if (comment) html += `<p><small>${comment}</small></p>`;
            
            infoPanel.innerHTML = html;
            infoPanel.classList.remove("hidden");
    }

    function hideNodeInfo() {
        infoPanel.classList.add("hidden");
        infoPanel.innerHTML = "";
        // Ensure the info panel is not fixed anymore
        infoPanel.classList.remove("fixed");
    }

    function showEdgeInfo(edgeData) {
        // Build HTML for edge info (IRI as a clickable link, label, and comment)
        let html = `<h4>${edgeData.label}</h4>`;
        if (edgeData.comment) {
            html += `<p><small>${edgeData.comment}</small></p>`;
        }
        infoPanel.innerHTML = html;
        infoPanel.classList.remove("hidden");
    }
    
    function hideEdgeInfo() {
        infoPanel.classList.add("hidden");
        infoPanel.innerHTML = "";
        infoPanel.classList.remove("fixed");
    }

    function updateDimmingEffect(startId) {
        const distMap = getDistancesUpToTwoHops(network, startId);
        // Update nodes
        const updates = nodes.map(node => {
            const dist = distMap[node.id];
            let ratio = 1;
            if (dist === 0 || dist === 1) {
                ratio = 0;
            } else if (dist === 2) {
                ratio = 0.5;
            }
            const { background, border, fontColor } = originalStyles[node.id];
            const dimBG = "#F8F8F8";
            const dimBorder = "#EEEEEE";
            const dimFont = "#EEEEEE";
            return {
                id: node.id,
                color: {
                    background: blendHexColors(background, dimBG, ratio),
                    border: blendHexColors(border, dimBorder, ratio)
                },
                font: {
                    color: blendHexColors(fontColor, dimFont, ratio)
                }
            };
        });
        nodesDataset.update(updates);
    
        // Update edges
        const edgeUpdates = edgesDataset.get().map(edge => {
            const ratioFrom = (distMap[edge.from] === 0 || distMap[edge.from] === 1) ? 0 :
                              (distMap[edge.from] === 2 ? 0.5 : 1);
            const ratioTo = (distMap[edge.to] === 0 || distMap[edge.to] === 1) ? 0 :
                            (distMap[edge.to] === 2 ? 0.5 : 1);
            const ratioEdge = Math.max(ratioFrom, ratioTo);
            const originalEdgeFontColor = "#000000";
            const dimEdgeFontColor = "#CCCCCC";
            return {
                id: edge.id,
                font: {
                    color: blendHexColors(originalEdgeFontColor, dimEdgeFontColor, ratioEdge)
                }
            };
        });
        edgesDataset.update(edgeUpdates);
    }

    function setLanguageOption() {
        const selectBox = document.querySelector("#languageSelect")
        const focusModeLabel = document.querySelector("#focusModeLabel")

        langParam = getParam("lang")
        if(langParam) {
            selectBox.value = langParam
            focusModeLabel.textContent = focusModeLabels[langParam] || focusModeLabels["de"];
        }
    }

    function setComponentsVisibility() {
        const infopanelHidden = getParam("infopanel") === "false";
        const legendHidden = getParam("legend") === "false";

        if (infopanelHidden) {
            document.getElementById("infoPanel").classList.add("param-hidden");
        }
        if (legendHidden) {
            document.getElementById("legend").classList.add("param-hidden");
        }
        if (infopanelHidden && legendHidden) {
            document.getElementById("focusModeCheckbox").checked = true;
        }

    }

    network.on("hoverNode", (params) => {
        // If a node is pinned, do not update the dimming effect on hover.
        if (pinnedNodeId) return;
        const hoveredId = params.node;
        updateDimmingEffect(hoveredId);
        const hoveredNodeData = nodesDataset.get(hoveredId);
        if (hoveredNodeData && hoveredNodeData.data) {
            showNodeInfo(hoveredNodeData);
        }
    });
    
    network.on("blurNode", () => {
        // When a node is pinned, leave the dimming effect intact.
        if (pinnedNodeId) return;
        // Restore original styles since no node is pinned.
        const restoreArray = nodes.map(node => {
            const { background, border, fontColor } = originalStyles[node.id];
            return {
                id: node.id,
                color: { background, border },
                font: { color: fontColor }
            };
        });
        nodesDataset.update(restoreArray);
        const edgeRestore = edgesDataset.get().map(edge => ({
            id: edge.id,
            font: { color: "#000000" }
        }));
        edgesDataset.update(edgeRestore);
        hideNodeInfo();
    });    

    // When hovering over an edge, show its info (unless an entity is pinned)
    network.on("hoverEdge", (params) => {
        if (!pinnedEdgeId && !pinnedNodeId) {
            const hoveredEdgeId = params.edge; // vis.js provides the hovered edge's id here
            const edgeData = edgesDataset.get(hoveredEdgeId);
            if (edgeData) {
                showEdgeInfo(edgeData);
            }
        }
    });

    network.on("blurEdge", () => {
        if (!pinnedEdgeId && !pinnedNodeId) {
            hideEdgeInfo();
        }
    });
    
    network.on("click", (params) => {
        if (params.nodes.length > 0) {
            // A node was clicked — pin its info panel and fix the dimming.
            pinnedNodeId = params.nodes[0];
            pinnedEdgeId = null; // Clear any pinned edge.
            const nodeData = nodesDataset.get(pinnedNodeId);
            if (nodeData && nodeData.data) {
                showNodeInfo(nodeData);
            }
            infoPanel.classList.add("fixed");
            // Fix the dimming effect based on the clicked node.
            updateDimmingEffect(pinnedNodeId);
        } else if (params.edges.length > 0) {
            // An edge was clicked — pin its info panel.
            pinnedEdgeId = params.edges[0];
            pinnedNodeId = null; // Clear any pinned node.
            const edgeData = edgesDataset.get(pinnedEdgeId);
            if (edgeData) {
                showEdgeInfo(edgeData);
            }
            infoPanel.classList.add("fixed");
        } else {
            // Clicked on empty space — unpin and restore original styles.
            pinnedNodeId = null;
            pinnedEdgeId = null;
            hideNodeInfo();
            infoPanel.classList.remove("fixed");
            const restoreArray = nodes.map(node => {
                const { background, border, fontColor } = originalStyles[node.id];
                return {
                    id: node.id,
                    color: { background, border },
                    font: { color: fontColor }
                };
            });
            nodesDataset.update(restoreArray);
            const edgeRestore = edgesDataset.get().map(edge => ({
                id: edge.id,
                font: { color: "#000000" }
            }));
            edgesDataset.update(edgeRestore);
        }
    });

    function buildLegend(classRows) {
        // Grab the legend <div>
        const legendEl = document.getElementById("legend");

        // We'll accumulate HTML
        let html = "";

        classRows.forEach(row => {
            // Each row: row.iri.value, row.label.value, row.comment.value, etc.
            const iri = row.iri.value;
            const label = row.label.value;
            const comment = row.comment.value || "";

            // Convert IRI to group name using the same function you use for nodes
            const groupName = mapClassIriToGroup(iri);

            // Check if these objects are hidden based on URL params
            const hidden = getParam(groupName.toLowerCase()) === "false"

            // Look up the color in your groupColors map
            // Make sure it's the same `groupColors` used to color your nodes
            const c = groupColors[groupName];
            // If it's not recognized, fallback to groupColors.Other
            const color = c || groupColors.Other;

            // We'll show a color box + label. Optionally also show comment.
            html += `
            <div class="legend-item">
                <div class="legend-swatch" style="background: ${color.background}; border-color: ${color.border}"></div>
                <div>
                <strong class="${hidden ? "faded" : ""}">${label}</strong>
                <input type="checkbox" ${hidden ? "" : "checked"} data-group='${JSON.stringify(groupName)}' onclick="toggleGroup(this)" />
                <br style="${hidden ? "display: none;" : ""}">
                <small style="${hidden ? "display: none;" : ""}">${comment}</small>
                </div>
            </div>
            `;
        });

        legendEl.innerHTML = html;
    }

    buildLegend(classesJson.results.bindings);
}

// Kick off init() once page loads
document.addEventListener("DOMContentLoaded", init);