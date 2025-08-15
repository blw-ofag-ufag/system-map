// Function to get query parameters from URL
function getQueryParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) || defaultValue;
}

// Should there be any focus on a subset of a graph, a so-called subgraph?
// Note that the subgraphs themselves are encoded in the RDF data!
window.subgraph = getQueryParam("subgraph", "")

// should schema:Organization, schema:SoftwareApplication, service:Service and dcat:Dataset be displayed
window.organization = getQueryParam("organization", "true") === "true" ? "schema:Organization" : "";
window.system = getQueryParam("system", "true") === "true" ? "schema:SoftwareApplication" : "";
window.service = getQueryParam("service", "true") === "true" ? "service:Service" : "";
window.information = getQueryParam("information", "true") === "true" ? "dcat:Dataset" : "";

/* -------------------------------------------------------------
Toggle which edge predicates are fetched.
----------------------------------------------------------------*/
const rawPredParam = getQueryParam("predicates", "").trim();
const selectedKeys = rawPredParam
  ? rawPredParam.split(/[;,+\s]+/).filter(Boolean)
  : [];

let predicateIris = selectedKeys
  .map(k => APP_CONFIG.PREDICATE_MAP[k])
  .filter(Boolean);

if (predicateIris.length === 0) {
  predicateIris = Object.values(APP_CONFIG.PREDICATE_MAP);
}

window.predicateValues = predicateIris
  .map(iri => `      ${iri}`)
  .join("\n");

window.ENDPOINT = APP_CONFIG.ENDPOINT;

// query nodes - fetches all language data at once
window.NODE_QUERY = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX service: <http://purl.org/ontology/service#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?id ?group ?name ?nameLang ?comment ?commentLang ?abbreviation ?abbreviationLang
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ${ subgraph ? `systemmap:${subgraph} systemmap:containsNodes ?id .` : "" }
    ?id a ?group .
    VALUES ?group { ${organization} ${system} ${information} ${service} }
    OPTIONAL { ?id schema:name ?name . BIND(LANG(?name) AS ?nameLang) }
    OPTIONAL { ?id schema:description ?comment . BIND(LANG(?comment) AS ?commentLang) }
    OPTIONAL { ?id systemmap:abbreviation ?abbreviation . BIND(LANG(?abbreviation) AS ?abbreviationLang) }
  }
}
`;

// Simplified query for edge instances
window.EDGE_QUERY = `
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat:   <http://www.w3.org/ns/dcat#>
PREFIX prov:   <http://www.w3.org/ns/prov#>
PREFIX service:<http://purl.org/ontology/service#>
PREFIX dcterms:<http://purl.org/dc/terms/>

SELECT ?from ?property ?to
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ?from ?property ?to .
    VALUES ?property {
      ${predicateValues}
    }
  }
}
`;

// NEW: Query for predicate metadata (labels, domain, range)
window.EDGE_METADATA_QUERY = `
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat:   <http://www.w3.org/ns/dcat#>
PREFIX prov:   <http://www.w3.org/ns/prov#>
PREFIX service:<http://purl.org/ontology/service#>
PREFIX dcterms:<http://purl.org/dc/terms/>

SELECT DISTINCT ?predicate ?label ?labelLang ?comment ?commentLang ?domain ?range
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    VALUES ?predicate {
      dcterms:isPartOf prov:wasDerivedFrom schema:parentOrganization systemmap:operates
      systemmap:owns systemmap:contains systemmap:usesMasterData schema:memberOf
      service:provides service:consumes systemmap:access systemmap:references
    }
    
    # This ensures we only get metadata for predicates that are actually in use
    ?from ?predicate ?to .

    OPTIONAL { ?predicate schema:name ?label . BIND(LANG(?label) as ?labelLang) }
    OPTIONAL { ?predicate schema:description ?comment . BIND(LANG(?comment) as ?commentLang) }
    OPTIONAL { ?predicate rdfs:domain/rdfs:subClassOf* ?domain . FILTER NOT EXISTS { ?domain rdfs:subClassOf ?domainParent } }
    OPTIONAL { ?predicate rdfs:range/rdfs:subClassOf* ?range . FILTER NOT EXISTS { ?range rdfs:subClassOf ?rangeParent } }
  }
}
ORDER BY ?domain
`;


// query top class names and comments - fetches all language data at once
window.CLASS_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX schema: <http://schema.org/>
  PREFIX dcat: <http://www.w3.org/ns/dcat#>
  PREFIX service: <http://purl.org/ontology/service#>
  SELECT ?iri ?label ?labelLang ?comment ?commentLang
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/system-map> {
      VALUES ?iri { schema:Organization schema:SoftwareApplication dcat:Dataset service:Service }
      
      OPTIONAL { ?iri schema:name ?label . BIND(LANG(?label) AS ?labelLang) }
      OPTIONAL { ?iri schema:description ?comment . BIND(LANG(?comment) AS ?commentLang) }
    }
  }
`;

// query the ontology title - fetches all language data at once
window.TITLE_QUERY = `
PREFIX schema: <http://schema.org/>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
SELECT ?title ?lang
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    BIND(${ subgraph ? "systemmap:" + subgraph : "systemmap:metadata" } as ?id)
    OPTIONAL { ?id schema:name ?title . BIND(LANG(?title) AS ?lang) }
  }
}
`;

// fetch SPARQL data from the LINDAS endpoint
window.getSparqlData = async function(query) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
  });
  return response.json();
};

// Map the IRIs for classes onto simpler group names using the central config
window.mapClassIriToGroup = function(iri) {
  return APP_CONFIG.GROUP_MAP[iri] || "Other";
};