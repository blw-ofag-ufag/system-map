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
 * Build the network and set up the BFS highlight + info panel
 */
async function init() {

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
    const nodesJson = await getSparqlData(NODE_QUERY);
    const edgesJson = await getSparqlData(EDGE_QUERY);
    const classesJson = await getSparqlData(CLASS_QUERY);

    // 2) Parse them into Vis-friendly arrays
    const nodes = nodesJson.results.bindings.map(row => {
        const iri = row.id.value;
        const groupIri = row.group.value;
        const label = row.label.value;
        const comment = row.comment ? row.comment.value : "";
        const abbreviation = row.abbreviation ? row.abbreviation.value : "";

        const groupName = mapClassIriToGroup(groupIri);

        return {
            id: iri,
            label: `<b>${shortenLabel(label, abbreviation)}</b>`,
            group: groupName,
            // Store data for the info panel
            data: {
                iri: iri,
                fullLabel: label,
                abbreviation: abbreviation,
                comment: comment
            }
        };
    });

    const edges = edgesJson.results.bindings.map(row => ({
        from: row.from.value,
        to: row.to.value,
        label: row.label.value
    }));

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
            widthConstraint: {
                minimum: 150,
                maximum: 150
            },
            heightConstraint: {
                minimum: 50,
                maximum: 50
            },
            shape: "box",
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
                gravitationalConstant: -10000,
                centralGravity: 0.05,
                springLength: 250,
                springConstant: 0.05
            },
            stabilization: {
                iterations: 1000
            }
        }
    };

    const network = new vis.Network(container, data, options);
    network.fit();

    // 5) The BFS highlight color-blending
    //    Map group => original background/border/font
    const groupColors = {
        System: {       background: "#FF7F51", border: "#000000", font: "#000000" },
        Information: {  background: "#ADB6C4", border: "#000000", font: "#000000" },
        Organization: { background: "#383743", border: "#000000", font: "#FFFFFF" },
        Other: {        background: "#383743", border: "#000000", font: "#FFFFFF"
        }
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
            comment
        } = nodeData.data;
        let html = `<code>${iri}</code>`;
        html += `<h3>${fullLabel}`;
        if (abbreviation) {
            html += ` (${abbreviation})`;
        }
        html += `</h3>`;
        if (comment) {
            html += `<p>${comment}</p>`;
        }
        infoPanel.innerHTML = html;
        infoPanel.classList.remove("hidden");
    }

    function hideNodeInfo() {
        infoPanel.classList.add("hidden");
        infoPanel.innerHTML = "";
    }

    // 7) Hover => BFS highlight + show panel
    network.on("hoverNode", (params) => {
        const hoveredId = params.node;
    
        // BFS up to 2 hops for nodes
        const distMap = getDistancesUpToTwoHops(network, hoveredId);
    
        // Update node colors (existing code)
        const updates = nodes.map(node => {
            const dist = distMap[node.id];
            let ratio = 1; // default: fully dimmed
            if (dist === 0 || dist === 1) {
                ratio = 0; // no dimming for nearby nodes
            } else if (dist === 2) {
                ratio = 0.5; // partially dimmed
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
    
        // Update edge labels based on the positions of their endpoints.
        // Helper: compute a ratio for a given node id.
        const computeRatio = (nodeId) => {
            const dist = distMap[nodeId];
            if (dist === 0 || dist === 1) return 0;
            if (dist === 2) return 0.5;
            return 1; // not in the BFS range → fully dim
        };
    
        // For each edge, take the maximum ratio of its endpoints.
        const edgeUpdates = edgesDataset.get().map(edge => {
            const ratioFrom = computeRatio(edge.from);
            const ratioTo = computeRatio(edge.to);
            const ratioEdge = Math.max(ratioFrom, ratioTo);
    
            // Original edge font color (assumed) and the dim color.
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
    
        // Show the info panel for the hovered node (existing code)
        const hoveredNodeData = nodesDataset.get(hoveredId);
        if (hoveredNodeData && hoveredNodeData.data) {
            showNodeInfo(hoveredNodeData);
        }
    });    

    // Blur => restore colors + hide panel
    network.on("blurNode", () => {
        // Restore node styles (existing code)
        const restoreArray = nodes.map(node => {
            const { background, border, fontColor } = originalStyles[node.id];
            return {
                id: node.id,
                color: { background, border },
                font: { color: fontColor }
            };
        });
        nodesDataset.update(restoreArray);
    
        // Restore edge labels to the original font color
        const edgeRestore = edgesDataset.get().map(edge => {
            return {
                id: edge.id,
                font: {
                    color: "#000000" // Original edge label color
                }
            };
        });
        edgesDataset.update(edgeRestore);
    
        // Hide the info panel (existing code)
        hideNodeInfo();
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
            <strong>${label}</strong>
            <br>
            <small>${comment}</small>
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