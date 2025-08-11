// Function to get query parameters from URL
function getQueryParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) || defaultValue;
}

// should schema:Organization, schema:SoftwareApplication, service:Service and dcat:Dataset be displayed
window.organization = getQueryParam("organization", "true") === "true" ? "schema:Organization" : "";
window.system = getQueryParam("system", "true") === "true" ? "schema:SoftwareApplication" : "";
window.service = getQueryParam("service", "true") === "true" ? "service:Service" : "";
window.information = getQueryParam("information", "true") === "true" ? "dcat:Dataset" : "";

/* -------------------------------------------------------------
Toggle which edge predicates are fetched.
- The user passes  ?predicates=key1;key2;key3
- Keys are defined in APP_CONFIG.PREDICATE_MAP in config.js.
- If the param is missing or empty, we include *all* predicates.
----------------------------------------------------------------*/
const rawPredParam = getQueryParam("predicates", "").trim();
const selectedKeys = rawPredParam
  ? rawPredParam.split(/[;,+\s]+/).filter(Boolean)
  : [];

// translate keys → prefixed IRIs; unknown keys are ignored
let predicateIris = selectedKeys
  .map(k => APP_CONFIG.PREDICATE_MAP[k])
  .filter(Boolean);

// If the user gave nothing valid, fall back to the full list
if (predicateIris.length === 0) {
  predicateIris = Object.values(APP_CONFIG.PREDICATE_MAP);
}

// build a SPARQL-ready VALUES list string
window.predicateValues = predicateIris
  .map(iri => `      ${iri}`)
  .join("\n");

// set SPARQL endpoint from config
window.ENDPOINT = APP_CONFIG.ENDPOINT;

// query nodes - fetches all language data at once
window.NODE_QUERY = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX service: <http://purl.org/ontology/service#>

SELECT ?id ?group ?name ?nameLang ?comment ?commentLang ?abbreviation ?abbreviationLang
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ?id a ?group .
    VALUES ?group { ${organization} ${system} ${information} ${service} }

    OPTIONAL { ?id schema:name ?name . BIND(LANG(?name) AS ?nameLang) }
    OPTIONAL { ?id schema:description ?comment . BIND(LANG(?comment) AS ?commentLang) }
    OPTIONAL { ?id systemmap:abbreviation ?abbreviation . BIND(LANG(?abbreviation) AS ?abbreviationLang) }
  }
}
`;

// query edges between the nodes - fetches all language data at once
window.EDGE_QUERY = `
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat:   <http://www.w3.org/ns/dcat#>
PREFIX prov:   <http://www.w3.org/ns/prov#>
PREFIX service:<http://purl.org/ontology/service#>
PREFIX dcterms:<http://purl.org/dc/terms/>

SELECT ?property ?from ?to ?label ?labelLang ?comment ?commentLang
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ?from ?property ?to .
    VALUES ?property {
      ${predicateValues}
    }

    OPTIONAL { ?property schema:name ?label . BIND(LANG(?label) as ?labelLang) }
    OPTIONAL { ?property schema:description ?comment . BIND(LANG(?comment) as ?commentLang) }
  }
}
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

// Query all possible predicates - fetches all language data at once
window.PREDICATES_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
  PREFIX schema: <http://schema.org/>
  PREFIX dcat:   <http://www.w3.org/ns/dcat#>
  PREFIX prov:   <http://www.w3.org/ns/prov#>
  PREFIX service:<http://purl.org/ontology/service#>
  PREFIX dcterms:<http://purl.org/dc/terms/>
  SELECT ?iri ?label ?labelLang ?comment ?commentLang
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/system-map> {
      VALUES ?iri {
        dcterms:isPartOf prov:wasDerivedFrom schema:parentOrganization systemmap:operates
        systemmap:owns systemmap:contains systemmap:usesMasterData schema:memberOf
        service:provides service:consumes systemmap:access systemmap:references
      }
      OPTIONAL { ?iri schema:name ?label . BIND(LANG(?label) AS ?labelLang) }
      OPTIONAL { ?iri schema:description ?comment . BIND(LANG(?comment) AS ?commentLang) }
    }
  }
`;

// query the ontology title - fetches all language data at once
window.TITLE_QUERY = `
PREFIX schema: <http://schema.org/>
SELECT ?title ?lang
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    BIND(<https://agriculture.ld.admin.ch/system-map/metadata> as ?id)
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