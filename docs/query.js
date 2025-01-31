// Function to get query parameters from URL
function getQueryParam(name, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) || defaultValue;
}

// language code used in the queries
window.lang = getQueryParam("lang", "de");

// set SPARQL endpoint
window.ENDPOINT = "https://test.lindas.admin.ch/query";

// query nodes (everything that is instance of Organization, :System or :Information or a subclass thereof)
window.NODE_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl: <http://www.w3.org/2002/07/owl#>
  PREFIX systemmap: <https://agriculture.ld.admin.ch/foag/system-map#>
  SELECT ?id ?group ?label ?comment ?abbreviation
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/ontologies> {
      ?id a ?group .
      ?group rdfs:subClassOf* ?supergroup .
      VALUES ?supergroup { systemmap:CLS001 systemmap:CLS002 systemmap:CLS003 }
      ?id rdfs:label ?label .
      FILTER(LANG(?label) = "${lang}")
      OPTIONAL {
        ?id rdfs:comment ?comment .
        FILTER(LANG(?comment) = "${lang}")
      }
      OPTIONAL {
        ?id ?hasAbbreviation ?abbreviation .
        FILTER(LANG(?abbreviation) = "${lang}")
        VALUES ?hasAbbreviation { systemmap:PRP101 systemmap:PRP102 }
      }
    }
  }
`;

// query edges between the nodes
window.EDGE_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl: <http://www.w3.org/2002/07/owl#>
  SELECT (?property AS ?id) ?from ?to ?label ?comment
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/ontologies> {
      ?from ?property ?to .
      ?property a owl:ObjectProperty .
      ?property rdfs:label ?label .
      FILTER(LANG(?label)="${lang}")
      OPTIONAL {
          ?property rdfs:comment ?comment .
          FILTER(LANG(?comment)="${lang}")
      }
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
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS001":
      return "Organization";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS002":
      return "System";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS003":
      return "Information";
    default:
      return "Other";
  }
};
