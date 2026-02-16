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
    systemmap:isMasterData ?isMasterData ;
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
    BIND(EXISTS { ?dataset a systemmap:MasterData } AS ?isMasterData)

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
    masterdata: false,
    filterSystem: null,
    filterOrg: null
};

async function init() {
    try {
        const rawJsonLd = await fetchSparql(SPARQL_QUERY);
        const framed = await jsonld.frame(rawJsonLd, FRAME);

        const rawDatasets = framed["@graph"] || [];
        const datasets = Array.isArray(rawDatasets) ? rawDatasets : [rawDatasets];

        // Group purely by dataset to prevent duplication entirely
        flatItems = datasets.map(ds => {
            let systems = ds["systemmap:inSystem"];
            if (!systems) systems = [];
            if (!Array.isArray(systems)) systems = [systems];

            let orgsMap = new Map();
            systems.forEach(sys => {
                let providers = sys["schema:provider"];
                if (providers) {
                    if (!Array.isArray(providers)) providers = [providers];
                    providers.forEach(org => {
                        if (org["@id"]) orgsMap.set(org["@id"], org);
                    });
                }
            });

            return {
                dataset: ds,
                systems: systems,
                orgs: Array.from(orgsMap.values())
            };
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
    document.getElementById('btn-masterdata').classList.toggle('active', state.masterdata);
    renderActiveFilters();

    const filtered = flatItems.filter(item => {
        const { dataset, systems, orgs } = item;

        const title = (getValue(dataset["schema:name"]) || "").toLowerCase();
        const desc = (getValue(dataset["schema:description"]) || "").toLowerCase();

        let hierarchyNames = systems.flatMap(sys => getAllSystemNames(sys)).join(" ").toLowerCase();

        const matchesText = title.includes(state.search) ||
                            desc.includes(state.search) ||
                            hierarchyNames.includes(state.search);

        if (!matchesText) return false;

        const isPersonal = getValue(dataset["systemmap:isPersonal"]) === true || getValue(dataset["systemmap:isPersonal"]) === "true";
        const isSensitive = getValue(dataset["systemmap:isSensitive"]) === true || getValue(dataset["systemmap:isSensitive"]) === "true";
        const isMasterData = getValue(dataset["systemmap:isMasterData"]) === true || getValue(dataset["systemmap:isMasterData"]) === "true";

        if (state.personal && !isPersonal) return false;
        if (state.sensitive && !isSensitive) return false;
        if (state.masterdata && !isMasterData) return false;

        if (state.filterSystem) {
            const names = systems.flatMap(sys => getAllSystemNames(sys));
            if (!names.includes(state.filterSystem)) return false;
        }

        if (state.filterOrg) {
            const orgNames = orgs.length > 0 ? orgs.map(o => getValue(o["schema:name"])) : ["Unknown Org"];
            if (!orgNames.includes(state.filterOrg)) return false;
        }

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
    const { dataset, systems, orgs } = item;

    const title = getValue(dataset["schema:name"]) || "Untitled";
    const desc = getValue(dataset["schema:description"]) || "No description available.";

    const isPersonal = getValue(dataset["systemmap:isPersonal"]) === true || getValue(dataset["systemmap:isPersonal"]) === "true";
    const isSensitive = getValue(dataset["systemmap:isSensitive"]) === true || getValue(dataset["systemmap:isSensitive"]) === "true";
    const isMasterData = getValue(dataset["systemmap:isMasterData"]) === true || getValue(dataset["systemmap:isMasterData"]) === "true";

    // Deduplicate all system nodes involved for this dataset
    const allSystemNodes = systems.flatMap(sys => getSystemHierarchy(sys));
    const uniqueSysNodes = [];
    const seenSys = new Set();
    allSystemNodes.forEach(node => {
        const id = node["@id"] || getValue(node["schema:name"]);
        if (!seenSys.has(id)) {
            seenSys.add(id);
            uniqueSysNodes.push(node);
        }
    });

    const tagsHtml = uniqueSysNodes.map(node => {
        const name = getValue(node["schema:name"]);
        const abbr = getValue(node["systemmap:abbreviation"]);
        const sysDesc = getValue(node["schema:description"]) || "No description.";

        // Notice the margin-right has been removed to rely purely on CSS gap, and join string is empty
        return `
        <span class="tag tag-sys"
              data-name="${name}"
              onclick="setFilter('system', this.dataset.name)">
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
    }).join(''); // Replaced ' / ' join string with ''

    const orgsHtml = orgs.length > 0 ? orgs.map(org => {
        const orgName = getValue(org["schema:name"]) || "Unknown Org";
        const orgAddress = getValue(org["schema:address"]);
        
        // Bonus fix: URL schema was slightly broken in your provided code
        const mapsUrl = orgAddress
            ? `https://maps.google.com/?q=${encodeURIComponent(orgAddress)}`
            : '#';

        return `
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
        `;
    }).join('') : `
        <div class="org-footer">
            <span class="org-link"><i class="bi bi-building"></i> Unknown Org</span>
        </div>
    `;

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
                ${isMasterData ? `<span class="tag tag-masterdata"><i class="bi bi-database-fill-gear"></i> Stammdaten</span>` : ''}
                ${isPersonal ? `<span class="tag tag-personal"><i class="bi bi-person"></i> Personal</span>` : ''}
                ${isSensitive ? `<span class="tag tag-sensitive"><i class="bi bi-shield-lock"></i> Sensitive</span>` : ''}
            </div>

            <div style="display: flex; flex-direction: column;">
                ${orgsHtml}
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