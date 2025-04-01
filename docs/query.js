// Function to get query parameters from URL
function getQueryParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) || defaultValue;
}

// language code used in the queries
window.lang = getQueryParam("lang", "de");

// should schema:Organization, schema:SoftwareApplication and systemmap:Information be displayed
window.organization = getQueryParam("organization", "true") === "true" ? "schema:Organization" : "";
window.system = getQueryParam("system", "true") === "true" ? "schema:SoftwareApplication" : "";
window.information = getQueryParam("information", "true") === "true" ? "systemmap:Information" : "";

// set SPARQL endpoint
window.ENDPOINT = "https://lindas.admin.ch/query";

// query nodes (everything that is instance of Organization, :System or :Information or a subclass thereof)
window.NODE_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl: <http://www.w3.org/2002/07/owl#>
  PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
  PREFIX schema: <http://schema.org/>
  SELECT ?id ?group ?displayLabel ?comment ?abbreviation
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/system-map> {
      ?id a ?group .
      VALUES ?group { ${organization} ${system} ${information} }
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
  SELECT (?property AS ?id) ?from ?to ?label ?comment
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/system-map> {
      ?from ?property ?to .
      VALUES ?property { systemmap:informs schema:parentOrganization systemmap:operates systemmap:owns systemmap:access systemmap:contains systemmap:usesIdentifier schema:memberOf }
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
  SELECT ?iri ?label ?comment
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/system-map> {
      VALUES ?iri { schema:Organization schema:SoftwareApplication systemmap:Information }
      ?iri rdfs:label ?label .
      ?iri rdfs:comment ?comment .    
      FILTER(LANG(?label) = "${lang}" && LANG(?comment) = "${lang}")
      FILTER NOT EXISTS { ?iri rdfs:subClassOf ?superclass }
    }
  }
`;

// query the ontology title
window.TITLE_QUERY = `
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT ?title
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    <https://agriculture.ld.admin.ch/system-map/> dcterms:title ?title .
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
    case "https://agriculture.ld.admin.ch/system-map/Information":
      return "Information";
    default:
      return "Other";
  }
};
