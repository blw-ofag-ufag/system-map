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

// set SPARQL endpoint
window.ENDPOINT = "https://lindas.admin.ch/query";

// query nodes (everything that is instance of Organization, :System or :Information or a subclass thereof)
window.NODE_QUERY = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX service: <http://purl.org/ontology/service#>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
SELECT ?id ?group ?displayLabel ?comment ?abbreviation
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ?id a ?group .
    VALUES ?group {
      ${organization}
      ${system}
      ${information}
      ${service}
    }
    OPTIONAL {
      ?id rdfs:label ?label .
      FILTER(LANG(?label) = "${lang}")
    }
    BIND(COALESCE(?label, "?") AS ?displayLabel)
    OPTIONAL {
      ?id rdfs:comment ?comment .
      FILTER(LANG(?comment) = "${lang}")
    }
    OPTIONAL {
      ?id ?hasAbbreviation ?abbreviation .
      FILTER(LANG(?abbreviation) = "${lang}")
      VALUES ?hasAbbreviation { systemmap:abbreviation }
    }
  }
}
`;

// query edges between the nodes
window.EDGE_QUERY = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX service: <http://purl.org/ontology/service#>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT (?property AS ?id) ?from ?to ?label ?comment
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    ?from ?property ?to .
    VALUES ?property { 
      dcterms:isPartOf
      prov:wasDerivedFrom
      schema:parentOrganization
      systemmap:operates
      systemmap:owns
      systemmap:access
      systemmap:contains
      systemmap:usesMasterData
      schema:memberOf
      service:provides
      service:consumes
    }
    ?property rdfs:label ?label .
    FILTER(LANG(?label)="${lang}")
    OPTIONAL {
        ?property rdfs:comment ?comment .
        FILTER(LANG(?comment)="${lang}")
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
