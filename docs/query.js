// Function to get query parameters from URL
function getQueryParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) || defaultValue;
}

// language code used in the queries
window.lang = getQueryParam("lang", "de");

// should schema:Organization, schema:SoftwareApplication, service:Service and dcat:Dataset be displayed
window.organization = getQueryParam("organization", "true") === "true" ? "schema:Organization" : "";
window.system = getQueryParam("system", "true") === "true" ? "schema:SoftwareApplication" : "";
window.service = getQueryParam("service", "true") === "true" ? "service:Service" : "";
window.information = getQueryParam("information", "true") === "true" ? "dcat:Dataset" : "";

/* -------------------------------------------------------------
Toggle which edge predicates are fetched.
  - The user passes  ?predicates=key1;key2;key3
  - Keys come from the table below.
  - If the param is missing or empty, we include *all* predicates.
----------------------------------------------------------------*/
const PREDICATE_MAP = {
  isPartOf       : "dcterms:isPartOf",
  wasDerivedFrom : "prov:wasDerivedFrom",
  parentOrg      : "schema:parentOrganization",
  operates       : "systemmap:operates",
  owns           : "systemmap:owns",
  contains       : "systemmap:contains",
  usesMasterData : "systemmap:usesMasterData",
  memberOf       : "schema:memberOf",
  provides       : "service:provides",
  consumes       : "service:consumes"
};

// read “…&predicates=…”  we treat  ; , + or whitespace as separators
const rawPredParam = getQueryParam("predicates", "").trim();
const selectedKeys = rawPredParam
  ? rawPredParam.split(/[;,+\s]+/).filter(Boolean)
  : [];

// translate keys → prefixed IRIs; unknown keys are ignored
let predicateIris = selectedKeys
  .map(k => PREDICATE_MAP[k])
  .filter(Boolean);

// If the user gave nothing valid, fall back to the full list
if (predicateIris.length === 0) {
  predicateIris = Object.values(PREDICATE_MAP);
}

// build a SPARQL-ready VALUES list string (every IRI on its own line keeps the query easy to read)
window.predicateValues = predicateIris
  .map(iri => `      ${iri}`)
  .join("\n");

// set SPARQL endpoint
window.ENDPOINT = "https://lindas.admin.ch/query";

// query nodes (everything that is instance of Organization, :System or :Information or a subclass thereof)
window.NODE_QUERY = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX service: <http://purl.org/ontology/service#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?id ?group ?displayLabel ?comment ?abbreviation          # <- only these come back
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ?id a ?group .
    VALUES ?group { ${organization} ${system} ${information} ${service} }

    # ---------- LABEL ----------
    OPTIONAL { ?id rdfs:label ?l_user . FILTER( LANG(?l_user) = "${lang}" ) }
    OPTIONAL { ?id rdfs:label ?l_en   . FILTER( LANG(?l_en)  = "en" ) }
    OPTIONAL { ?id rdfs:label ?l_de   . FILTER( LANG(?l_de)  = "de" ) }
    OPTIONAL { ?id rdfs:label ?l_fr   . FILTER( LANG(?l_fr)  = "fr" ) }
    OPTIONAL { ?id rdfs:label ?l_it   . FILTER( LANG(?l_it)  = "it" ) }
    BIND( COALESCE(?l_user, ?l_en, ?l_de, ?l_fr, ?l_it, "?") AS ?displayLabel )

    # ---------- COMMENT ----------
    OPTIONAL { ?id rdfs:comment ?c_user . FILTER( LANG(?c_user) = "${lang}" ) }
    OPTIONAL { ?id rdfs:comment ?c_en   . FILTER( LANG(?c_en)  = "en" ) }
    OPTIONAL { ?id rdfs:comment ?c_de   . FILTER( LANG(?c_de)  = "de" ) }
    OPTIONAL { ?id rdfs:comment ?c_fr   . FILTER( LANG(?c_fr)  = "fr" ) }
    OPTIONAL { ?id rdfs:comment ?c_it   . FILTER( LANG(?c_it)  = "it" ) }
    BIND( COALESCE(?c_user, ?c_en, ?c_de, ?c_fr, ?c_it) AS ?comment )

    # ---------- ABBREVIATION ----------
    OPTIONAL { ?id systemmap:abbreviation ?a_user .
    FILTER( LANG(?a_user) = "${lang}" ) }
    OPTIONAL { ?id systemmap:abbreviation ?a_en . FILTER( LANG(?a_en) = "en" ) }
    OPTIONAL { ?id systemmap:abbreviation ?a_de . FILTER( LANG(?a_de) = "de" ) }
    OPTIONAL { ?id systemmap:abbreviation ?a_fr . FILTER( LANG(?a_fr) = "fr" ) }
    OPTIONAL { ?id systemmap:abbreviation ?a_it . FILTER( LANG(?a_it) = "it" ) }
    BIND( COALESCE(?a_user, ?a_en, ?a_de, ?a_fr, ?a_it) AS ?abbreviation )
  }
}
`;

// query edges between the nodes
// -------------------------------------------------------------
//  EDGE_QUERY  — uses the dynamically built  ${predicateValues}
// -------------------------------------------------------------
window.EDGE_QUERY = `
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl:    <http://www.w3.org/2002/07/owl#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat:   <http://www.w3.org/ns/dcat#>
PREFIX prov:   <http://www.w3.org/ns/prov#>
PREFIX service:<http://purl.org/ontology/service#>
PREFIX dcterms:<http://purl.org/dc/terms/>

SELECT (?property AS ?id) ?from ?to ?label ?comment
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ?from ?property ?to .
    VALUES ?property {
      ${predicateValues}
    }

    ?property rdfs:label ?label .
    FILTER( LANG(?label) = "${lang}" )

    OPTIONAL {
      ?property rdfs:comment ?comment .
      FILTER( LANG(?comment) = "${lang}" )
    }
  }
}
`;

// query top class names and comments
window.CLASS_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl: <http://www.w3.org/2002/07/owl#>
  PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
  PREFIX schema: <http://schema.org/>
  PREFIX dcat: <http://www.w3.org/ns/dcat#>
  PREFIX service: <http://purl.org/ontology/service#>
  SELECT ?iri ?label ?comment
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/system-map> {
      VALUES ?iri { schema:Organization schema:SoftwareApplication dcat:Dataset service:Service }
      ?iri rdfs:label ?label .
      ?iri rdfs:comment ?comment .    
      FILTER(LANG(?label) = "${lang}" && LANG(?comment) = "${lang}")
      FILTER NOT EXISTS { ?iri rdfs:subClassOf ?superclass }
    }
  }
`;

// query the ontology title
window.TITLE_QUERY = `
PREFIX schema: <http://schema.org/>
SELECT ?title
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    <https://agriculture.ld.admin.ch/system-map/metadata> schema:name ?title .
    FILTER(LANG(?title)="${lang}")
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

// Map the IRIs for classes onto simpler group names
window.mapClassIriToGroup = function(iri) {
  switch (iri) {
    case "http://schema.org/Organization":
      return "Organization";
    case "http://schema.org/SoftwareApplication":
      return "System";
    case "http://www.w3.org/ns/dcat#Dataset":
      return "Information";
    case "http://purl.org/ontology/service#Service":
      return "Service";
    default:
      return "Other";
  }
};
