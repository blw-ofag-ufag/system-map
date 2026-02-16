const ENDPOINT = "https://cached.lindas.admin.ch/query";

const SPARQL_QUERY = `
PREFIX schema: <http://schema.org/>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX termdat: <https://register.ld.admin.ch/termdat/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX dcterms: <http://purl.org/dc/terms/>

CONSTRUCT {
  ?dataset a schema:Dataset ;
    schema:name ?datasetName ;
    schema:description ?datasetDesc ;
    systemmap:isPersonal ?isPersonal ;
    systemmap:isSensitive ?isSensitive ;
    systemmap:inSystem ?directSystem .

  ?directSystem a schema:SoftwareApplication ;
    schema:name ?systemName ;
    schema:description ?systemDesc ;
    systemmap:abbreviation ?systemAbbr ;
    dcterms:isPartOf ?parentSystem ;
    schema:provider ?org .

  ?parentSystem a schema:SoftwareApplication ;
    schema:name ?parentName ;
    schema:description ?parentDesc ;
    systemmap:abbreviation ?parentAbbr ;
    dcterms:isPartOf ?grandparentSystem .

  ?org a schema:Organization ;
    schema:name ?orgName ;
    schema:address ?orgAddress .
}
WHERE {
    ?directSystem a schema:SoftwareApplication ;
                  dcterms:hasPart*/systemmap:contains ?dataset .

    ?dataset schema:name ?datasetName .
    FILTER(LANG(?datasetName) = "de")

    OPTIONAL {
        ?dataset schema:description|schema:description ?datasetDesc .
        FILTER(LANG(?datasetDesc) = "de")
    }

    BIND(EXISTS { ?dataset a termdat:52451 } AS ?isPersonal)
    BIND(EXISTS { ?dataset a termdat:52453 } AS ?isSensitive)

    # Get System Hierarchy
    ?directSystem dcterms:isPartOf* ?s .
    ?s schema:name ?systemName .
    FILTER(LANG(?systemName) = "de")

    OPTIONAL { ?s systemmap:abbreviation ?systemAbbr . FILTER(LANG(?systemAbbr)="de") }
    OPTIONAL { ?s schema:description ?systemDesc . FILTER(LANG(?systemDesc)="de") }

    OPTIONAL { ?s dcterms:isPartOf ?parentSystem . }
    FILTER(?s = ?directSystem || ?s = ?parentSystem || ?s = ?grandparentSystem)

    # Organization Traversal
    OPTIONAL {
        ?directSystem dcterms:isPartOf* ?pathSystem .
        ?pathSystem systemmap:operatedBy ?operator .
        ?operator schema:parentOrganization* ?org .
        FILTER(NOT EXISTS { ?org schema:parentOrganization ?grandparent })
        ?org schema:name ?orgName .
        FILTER(LANG(?orgName) = "de")

        OPTIONAL {
            { ?org schema:address ?addrNode } UNION { ?org owl:sameAs/schema:address ?addrNode }
            ?addrNode schema:streetAddress ?street ;
                      schema:postalCode ?zip ;
                      schema:addressLocality ?city .
            BIND(CONCAT(?street, ", ", ?zip, " ", ?city) AS ?orgAddress)
        }
    }
}
`;

const FRAME = {
    "@context": {
        "schema": "http://schema.org/",
        "systemmap": "https://agriculture.ld.admin.ch/system-map/",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "dcterms": "http://purl.org/dc/terms/"
    },
    "@type": "schema:Dataset",
    "systemmap:inSystem": {
        "@embed": "@always",
        "@type": "schema:SoftwareApplication",
        "dcterms:isPartOf": {
             "@embed": "@always",
             "@type": "schema:SoftwareApplication",
             "dcterms:isPartOf": {
                 "@embed": "@always",
                 "@type": "schema:SoftwareApplication"
             }
        },
        "schema:provider": {
            "@embed": "@always",
            "@type": "schema:Organization"
        }
    }
};

let flatItems = [];
let state = {
    search: '',
    personal: false,
    sensitive: false,
    filterSystem: null,
    filterOrg: null
};

async function init() {
    try {
        const rawJsonLd = await fetchSparql(SPARQL_QUERY);
        const framed = await jsonld.frame(rawJsonLd, FRAME);

        const rawDatasets = framed["@graph"] || [];
        const datasets = Array.isArray(rawDatasets) ? rawDatasets : [rawDatasets];

        flatItems = datasets.flatMap(ds => {
            let systems = ds["systemmap:inSystem"];
            if (!systems) return [];
            if (!Array.isArray(systems)) systems = [systems];

            return systems.flatMap(sys => {
                let providers = sys["schema:provider"];
                if (!providers) {
                    return [{ dataset: ds, system: sys, org: null }];
                }
                if (!Array.isArray(providers)) providers = [providers];

                return providers.map(org => ({
                    dataset: ds,
                    system: sys,
                    org: org
                }));
            });
        });

        document.getElementById('search-input').addEventListener('input', (e) => {
            state.search = e.target.value.toLowerCase();
            render();
        });

        render();

    } catch (e) {
        document.getElementById('catalog-grid').innerHTML =
            `<div id="status-msg" style="color:red">Error: ${e.message}</div>`;
        console.error(e);
    }
}

function render() {
    document.getElementById('btn-personal').classList.toggle('active', state.personal);
    document.getElementById('btn-sensitive').classList.toggle('active', state.sensitive);
    renderActiveFilters();

    const filtered = flatItems.filter(item => {
        const { dataset, system, org } = item;

        const title = (getValue(dataset["schema:name"]) || "").toLowerCase();
        const desc = (getValue(dataset["schema:description"]) || "").toLowerCase();
        const orgName = org ? (getValue(org["schema:name"]) || "Unknown Org") : "Unknown Org";

        let hierarchyNames = getAllSystemNames(system).join(" ").toLowerCase();

        const matchesText = title.includes(state.search) ||
                            desc.includes(state.search) ||
                            hierarchyNames.includes(state.search);

        if (!matchesText) return false;

        const isPersonal = getValue(dataset["systemmap:isPersonal"]) === true || getValue(dataset["systemmap:isPersonal"]) === "true";
        const isSensitive = getValue(dataset["systemmap:isSensitive"]) === true || getValue(dataset["systemmap:isSensitive"]) === "true";

        if (state.personal && !isPersonal) return false;
        if (state.sensitive && !isSensitive) return false;

        if (state.filterSystem) {
            const names = getAllSystemNames(system);
            if (!names.includes(state.filterSystem)) return false;
        }
        if (state.filterOrg && orgName !== state.filterOrg) return false;

        return true;
    });

    const grid = document.getElementById('catalog-grid');
    const count = document.getElementById('count-display');

    count.innerText = `${filtered.length} Datensätze gefunden`;
    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = `<div id="status-msg">No results match your criteria.</div>`;
        return;
    }

    filtered.forEach(item => grid.appendChild(createCard(item)));
}

function renderActiveFilters() {
    const container = document.getElementById('active-filters');
    container.innerHTML = '';
    const addChip = (text, onClick) => {
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.innerHTML = `${text} <i class="bi bi-x"></i>`;
        chip.onclick = onClick;
        container.appendChild(chip);
    };
    if (state.filterSystem) addChip(`System: ${state.filterSystem}`, () => setFilter('system', null));
    if (state.filterOrg) addChip(`Org: ${state.filterOrg}`, () => setFilter('org', null));
}

function getSystemHierarchy(systemNode) {
    let hierarchy = [];
    let current = systemNode;
    while(current) {
        hierarchy.push(current);
        let parent = current["dcterms:isPartOf"];
        if (Array.isArray(parent)) parent = parent[0];
        current = parent;
    }
    return hierarchy.reverse();
}

function getAllSystemNames(systemNode) {
    return getSystemHierarchy(systemNode).map(s => getValue(s["schema:name"]));
}

function createCard(item) {
    const { dataset, system, org } = item;

    const title = getValue(dataset["schema:name"]) || "Untitled";
    const desc = getValue(dataset["schema:description"]) || "No description available.";

    const isPersonal = getValue(dataset["systemmap:isPersonal"]) === true || getValue(dataset["systemmap:isPersonal"]) === "true";
    const isSensitive = getValue(dataset["systemmap:isSensitive"]) === true || getValue(dataset["systemmap:isSensitive"]) === "true";

    const orgName = org ? (getValue(org["schema:name"]) || "Unknown Org") : "Unknown Org";
    const orgAddress = org ? getValue(org["schema:address"]) : null;

    // Corrected URL interpolation syntax here
    const mapsUrl = orgAddress
        ? `https://www.google.com/maps/search/?api=1&query=$${encodeURIComponent(orgAddress)}`
        : '#';

    const systemNodes = getSystemHierarchy(system);

    const tagsHtml = systemNodes.map(node => {
        const name = getValue(node["schema:name"]);
        const abbr = getValue(node["systemmap:abbreviation"]);
        const sysDesc = getValue(node["schema:description"]) || "No description.";

        return `
        <span class="tag tag-sys"
              data-name="${name}"
              onclick="setFilter('system', this.dataset.name)"
              style="margin-right:0;">
            <i class="bi bi-cpu"></i> ${name}
            <div class="custom-tooltip">
                <div class="tt-header">
                    <span>
                      ${name}
                      ${abbr ? `(${abbr})` : ''}
                    </span>
                </div>
                <div class="tt-desc">${sysDesc}</div>
            </div>
        </span>`;
    }).join('<span style="color:#ccc; font-size: 0.8rem; display:flex; align-items:center;"> / </span>');

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${title}</h3>
        </div>
        <div class="card-desc">
            ${desc}
        </div>

        <div class="meta-row">
            <div class="tag-row">
                ${tagsHtml}
                ${isPersonal ? `<span class="tag tag-personal"><i class="bi bi-person"></i> Personal</span>` : ''}
                ${isSensitive ? `<span class="tag tag-sensitive"><i class="bi bi-shield-lock"></i> Sensitive</span>` : ''}
            </div>

            <div class="org-footer">
                <span class="org-link"
                      data-org="${orgName}"
                      onclick="setFilter('org', this.dataset.org)">
                    <i class="bi bi-building"></i> ${orgName}
                </span>
                ${orgAddress ? `
                    <a href="${mapsUrl}" target="_blank" class="address-link">
                        <i class="bi bi-geo-alt"></i> ${orgAddress}
                    </a>
                ` : ''}
            </div>
        </div>
    `;
    return card;
}

function toggleState(key) { state[key] = !state[key]; render(); }

window.setFilter = function(type, value) {
    if (type === 'system') state.filterSystem = value;
    if (type === 'org') state.filterOrg = value;
    render();
};

async function fetchSparql(query) {
    const url = new URL(ENDPOINT);
    url.searchParams.append('query', query);
    const res = await fetch(url, { headers: { 'Accept': 'application/ld+json' } });
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
}

function getValue(prop) {
    if (prop === undefined || prop === null) return null;
    if (prop === false) return false;
    if (Array.isArray(prop)) return getValue(prop[0]);
    if (typeof prop === 'object' && prop['@value'] !== undefined) return prop['@value'];
    return prop;
}

init();