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
  consumes       : "service:consumes",
  access         : "systemmap:access",
  references     : "systemmap:references"
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

// build a SPARQL-ready VALUES list string
window.predicateValues = predicateIris
  .map(iri => `      ${iri}`)
  .join("\n");

// set SPARQL endpoint
window.ENDPOINT = "https://lindas.admin.ch/query";

// query nodes
window.NODE_QUERY = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX service: <http://purl.org/ontology/service#>

SELECT ?id ?group ?displayLabel ?comment ?abbreviation
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ?id a ?group .
    VALUES ?group { ${organization} ${system} ${information} ${service} }

    OPTIONAL { ?id schema:name ?l_user . FILTER( LANG(?l_user) = "${lang}" ) }
    OPTIONAL { ?id schema:name ?l_en   . FILTER( LANG(?l_en)  = "en" ) }
    OPTIONAL { ?id schema:name ?l_de   . FILTER( LANG(?l_de)  = "de" ) }
    OPTIONAL { ?id schema:name ?l_fr   . FILTER( LANG(?l_fr)  = "fr" ) }
    OPTIONAL { ?id schema:name ?l_it   . FILTER( LANG(?l_it)  = "it" ) }
    BIND( COALESCE(?l_user, ?l_en, ?l_de, ?l_fr, ?l_it, "") AS ?displayLabel )

    OPTIONAL { ?id schema:description ?c_user . FILTER( LANG(?c_user) = "${lang}" ) }
    OPTIONAL { ?id schema:description ?c_en   . FILTER( LANG(?c_en)  = "en" ) }
    OPTIONAL { ?id schema:description ?c_de   . FILTER( LANG(?c_de)  = "de" ) }
    OPTIONAL { ?id schema:description ?c_fr   . FILTER( LANG(?c_fr)  = "fr" ) }
    OPTIONAL { ?id schema:description ?c_it   . FILTER( LANG(?c_it)  = "it" ) }
    BIND( COALESCE(?c_user, ?c_en, ?c_de, ?c_fr, ?c_it, "") AS ?comment )

    OPTIONAL { ?id systemmap:abbreviation ?a_user . FILTER( LANG(?a_user) = "${lang}" ) }
    OPTIONAL { ?id systemmap:abbreviation ?a_en . FILTER( LANG(?a_en) = "en" ) }
    OPTIONAL { ?id systemmap:abbreviation ?a_de . FILTER( LANG(?a_de) = "de" ) }
    OPTIONAL { ?id systemmap:abbreviation ?a_fr . FILTER( LANG(?a_fr) = "fr" ) }
    OPTIONAL { ?id systemmap:abbreviation ?a_it . FILTER( LANG(?a_it) = "it" ) }
    BIND( COALESCE(?a_user, ?a_en, ?a_de, ?a_fr, ?a_it, "") AS ?abbreviation )
  }
}
`;

// query edges between the nodes
window.EDGE_QUERY = `
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
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

    OPTIONAL { ?property schema:name ?l_user . FILTER(LANG(?l_user) = "${lang}") }
    OPTIONAL { ?property schema:name ?l_en . FILTER(LANG(?l_en) = "en") }
    OPTIONAL { ?property schema:name ?l_de . FILTER(LANG(?l_de) = "de") }
    OPTIONAL { ?property schema:name ?l_fr . FILTER(LANG(?l_fr) = "fr") }
    OPTIONAL { ?property schema:name ?l_it . FILTER(LANG(?l_it) = "it") }
    BIND(COALESCE(?l_user, ?l_en, ?l_de, ?l_fr, ?l_it, "") AS ?label)

    OPTIONAL { ?property schema:description ?c_user . FILTER(LANG(?c_user) = "${lang}") }
    OPTIONAL { ?property schema:description ?c_en . FILTER(LANG(?c_en) = "en") }
    OPTIONAL { ?property schema:description ?c_de . FILTER(LANG(?c_de) = "de") }
    OPTIONAL { ?property schema:description ?c_fr . FILTER(LANG(?c_fr) = "fr") }
    OPTIONAL { ?property schema:description ?c_it . FILTER(LANG(?c_it) = "it") }
    BIND(COALESCE(?c_user, ?c_en, ?c_de, ?c_fr, ?c_it, "") AS ?comment)
  }
}
`;

// query top class names and comments for the settings panel
window.CLASS_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX schema: <http://schema.org/>
  PREFIX dcat: <http://www.w3.org/ns/dcat#>
  PREFIX service: <http://purl.org/ontology/service#>
  SELECT ?iri ?label ?comment
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/system-map> {
      VALUES ?iri { schema:Organization schema:SoftwareApplication dcat:Dataset service:Service }
      
      OPTIONAL { ?iri schema:name ?l_user . FILTER(LANG(?l_user) = "${lang}") }
      OPTIONAL { ?iri schema:name ?l_en . FILTER(LANG(?l_en) = "en") }
      OPTIONAL { ?iri schema:name ?l_de . FILTER(LANG(?l_de) = "de") }
      OPTIONAL { ?iri schema:name ?l_fr . FILTER(LANG(?l_fr) = "fr") }
      OPTIONAL { ?iri schema:name ?l_it . FILTER(LANG(?l_it) = "it") }
      BIND(COALESCE(?l_user, ?l_en, ?l_de, ?l_fr, ?l_it, "") AS ?label)

      OPTIONAL { ?iri schema:description ?c_user . FILTER(LANG(?c_user) = "${lang}") }
      OPTIONAL { ?iri schema:description ?c_en . FILTER(LANG(?c_en) = "en") }
      OPTIONAL { ?iri schema:description ?c_de . FILTER(LANG(?c_de) = "de") }
      OPTIONAL { ?iri schema:description ?c_fr . FILTER(LANG(?c_fr) = "fr") }
      OPTIONAL { ?iri schema:description ?c_it . FILTER(LANG(?c_it) = "it") }
      BIND(COALESCE(?c_user, ?c_en, ?c_de, ?c_fr, ?c_it, "") AS ?comment)
    }
  }
`;

// Query all possible predicates and their details for the settings panel
window.PREDICATES_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
  PREFIX schema: <http://schema.org/>
  PREFIX dcat:   <http://www.w3.org/ns/dcat#>
  PREFIX prov:   <http://www.w3.org/ns/prov#>
  PREFIX service:<http://purl.org/ontology/service#>
  PREFIX dcterms:<http://purl.org/dc/terms/>
  SELECT ?iri ?label ?comment
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/system-map> {
      VALUES ?iri {
        dcterms:isPartOf prov:wasDerivedFrom schema:parentOrganization systemmap:operates
        systemmap:owns systemmap:contains systemmap:usesMasterData schema:memberOf
        service:provides service:consumes systemmap:access systemmap:references
      }
      OPTIONAL { ?iri schema:name ?l_user . FILTER(LANG(?l_user) = "${lang}") }
      OPTIONAL { ?iri schema:name ?l_en . FILTER(LANG(?l_en) = "en") }
      OPTIONAL { ?iri schema:name ?l_de . FILTER(LANG(?l_de) = "de") }
      OPTIONAL { ?iri schema:name ?l_fr . FILTER(LANG(?l_fr) = "fr") }
      OPTIONAL { ?iri schema:name ?l_it . FILTER(LANG(?l_it) = "it") }
      BIND(COALESCE(?l_user, ?l_en, ?l_de, ?l_fr, ?l_it, "") AS ?label)

      OPTIONAL { ?iri schema:description ?c_user . FILTER(LANG(?c_user) = "${lang}") }
      OPTIONAL { ?iri schema:description ?c_en . FILTER(LANG(?c_en) = "en") }
      OPTIONAL { ?iri schema:description ?c_de . FILTER(LANG(?c_de) = "de") }
      OPTIONAL { ?iri schema:description ?c_fr . FILTER(LANG(?c_fr) = "fr") }
      OPTIONAL { ?iri schema:description ?c_it . FILTER(LANG(?c_it) = "it") }
      BIND(COALESCE(?c_user, ?c_en, ?c_de, ?c_fr, ?c_it, "") AS ?comment)
    }
  }
`;

// query the ontology title
window.TITLE_QUERY = `
PREFIX schema: <http://schema.org/>
SELECT ?title
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    BIND(<https://agriculture.ld.admin.ch/system-map/metadata> as ?id)
    OPTIONAL { ?id schema:name ?l_user . FILTER(LANG(?l_user) = "${lang}") }
    OPTIONAL { ?id schema:name ?l_en . FILTER(LANG(?l_en) = "en") }
    OPTIONAL { ?id schema:name ?l_de . FILTER(LANG(?l_de) = "de") }
    OPTIONAL { ?id schema:name ?l_fr . FILTER(LANG(?l_fr) = "fr") }
    OPTIONAL { ?id schema:name ?l_it . FILTER(LANG(?l_it) = "it") }
    BIND(COALESCE(?l_user, ?l_en, ?l_de, ?l_fr, ?l_it, "System Map") AS ?title)
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