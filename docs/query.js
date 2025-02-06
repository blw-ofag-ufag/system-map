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
  PREFIX schema: <https://schema.org/>
  SELECT ?id ?group ?displayLabel ?comment ?abbreviation
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/ontologies> {
      ?id a ?group .
      VALUES ?group { schema:Organization schema:SoftwareApplication systemmap:CLS003 }
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
        VALUES ?hasAbbreviation { systemmap:PRP101 systemmap:PRP102 }
      }
    }
  }
`;

// query edges between the nodes
window.EDGE_QUERY = `
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl: <http://www.w3.org/2002/07/owl#>
  PREFIX systemmap: <https://agriculture.ld.admin.ch/foag/system-map#>
  PREFIX schema: <https://schema.org/>
  SELECT (?property AS ?id) ?from ?to ?label ?comment
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/ontologies> {
      ?from ?property ?to .
      VALUES ?property { systemmap:PRP013 schema:parentOrganization systemmap:PRP007 systemmap:PRP005 systemmap:PRP015 systemmap:PRP011 systemmap:PRP001 }
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
  SELECT ?iri ?label ?comment
  WHERE {
    GRAPH <https://lindas.admin.ch/foag/ontologies> {
      ?iri a owl:Class .
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
  GRAPH <https://lindas.admin.ch/foag/ontologies> {
    <https://agriculture.ld.admin.ch/foag/system-map#> dcterms:title ?title .
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
    case "https://schema.org/Organization":
      return "Organization";
    case "https://schema.org/SoftwareApplication":
      return "System";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS002":
      return "Information";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS003":
      return "Information";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS004":
      return "Information";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS005":
      return "Information";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS006":
      return "Organization";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS007":
      return "Organization";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS008":
      return "Organization";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS009":
      return "Organization";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS010":
      return "Organization";
    case "https://agriculture.ld.admin.ch/foag/system-map#CLS011":
      return "Organization";
    default:
      return "Other";
  }
};
