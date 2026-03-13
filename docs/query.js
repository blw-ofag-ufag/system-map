function getQueryParam(name, defaultValue) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name) || defaultValue;
}

window.subgraph = getQueryParam("subgraph", "");

window.organization = getQueryParam("organization", "true") === "true" ? "schema:Organization" : "";
window.system = getQueryParam("system", "true") === "true" ? "schema:SoftwareApplication" : "";
window.service = getQueryParam("service", "true") === "true" ? "service:Service" : "";
window.information = getQueryParam("information", "true") === "true" ? "dcat:Dataset" : "";

const activeGroups = [window.organization, window.system, window.information, window.service].filter(Boolean);
window.groupValues = activeGroups.length > 0 ? activeGroups.join(' ') : "<http://example.org/None>";

const rawPredParam = getQueryParam("predicates", "").trim();
const selectedKeys = rawPredParam ? rawPredParam.split(/[;,+\s]+/).filter(Boolean) : [];

let predicateIris = selectedKeys.map(k => APP_CONFIG.PREDICATE_MAP[k]).filter(Boolean);
if (predicateIris.length === 0) {
    predicateIris = Object.values(APP_CONFIG.PREDICATE_MAP);
}
window.predicateValues = predicateIris.map(iri => `      ${iri}`).join("\n");

window.ENDPOINT = APP_CONFIG.ENDPOINT;

window.MAIN_CONSTRUCT_QUERY = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX service: <http://purl.org/ontology/service#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

CONSTRUCT {
  ?mapId schema:name ?mapTitle .

  ?node a ?group ;
        schema:name ?name ;
        schema:description ?comment ;
        systemmap:abbreviation ?abbreviation ;
        dcat:keyword ?keyword .
  ?keyword schema:name ?keywordLabel .

  ?node schema:subOrganization ?subOrg ;
        schema:parentOrganization ?parentOrg ;
        dcterms:hasPart ?hasPart ;
        dcterms:isPartOf ?isPartOf .

  ?node ?property ?targetNode .

  ?classIri a owl:Class ;
            schema:name ?classLabel ;
            schema:description ?classComment .

  ?property a owl:ObjectProperty ;
            schema:name ?propLabel ;
            schema:description ?propComment ;
            rdfs:domain ?domain ;
            rdfs:range ?range .
}
WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> {
    {
       BIND(${ subgraph ? "systemmap:" + subgraph : "systemmap:metadata" } as ?mapId)
       OPTIONAL { ?mapId schema:name ?mapTitle }
    } UNION {
       ${ subgraph ? `systemmap:${subgraph} systemmap:containsNodes ?node .` : "" }
       ?node a ?group .
       VALUES ?group { ${groupValues} }
       OPTIONAL { ?node schema:name ?name }
       OPTIONAL { ?node schema:description ?comment }
       OPTIONAL { ?node systemmap:abbreviation ?abbreviation }
       OPTIONAL {
         ?node dcat:keyword ?keyword .
         ?keyword schema:name ?keywordLabel .
       }
    } UNION {
       ?node ?hierarchyProp ?targetNode .
       VALUES ?hierarchyProp {
         schema:subOrganization schema:parentOrganization
         dcterms:hasPart dcterms:isPartOf
       }
    } UNION {
       ?node ?property ?targetNode .
       VALUES ?property { ${predicateValues} }
    } UNION {
       VALUES ?classIri { schema:Organization schema:SoftwareApplication dcat:Dataset service:Service }
       OPTIONAL { ?classIri schema:name ?classLabel }
       OPTIONAL { ?classIri schema:description ?classComment }
    } UNION {
       VALUES ?property { ${predicateValues} }
       OPTIONAL { ?property schema:name ?propLabel }
       OPTIONAL { ?property schema:description ?propComment }
       OPTIONAL { ?property rdfs:domain/rdfs:subClassOf* ?domain . VALUES ?domain { schema:Organization schema:SoftwareApplication dcat:Dataset service:Service } }
       OPTIONAL { ?property rdfs:range/rdfs:subClassOf* ?range . VALUES ?range { schema:Organization schema:SoftwareApplication dcat:Dataset service:Service } }
    }
  }
}
`;

window.getSparqlData = async function(query) {
    const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/ld+json" } });
    return response.json();
};

window.mapClassIriToGroup = function(iri) {
    return APP_CONFIG.GROUP_MAP[iri] || "Other";
};