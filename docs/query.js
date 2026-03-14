function getQueryParam(name, defaultValue) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name) || defaultValue;
}

window.subgraph = getQueryParam("subgraph", "");

const getGroupState = (name) => getQueryParam(name, "full");

window.groupStates = {
    Organization: getGroupState("organization"),
    System: getGroupState("system"),
    Information: getGroupState("information"),
    Service: getGroupState("service")
};

const activeGroupIris = [];
if (window.groupStates.Organization !== "off") activeGroupIris.push("schema:Organization");
if (window.groupStates.System !== "off") activeGroupIris.push("schema:SoftwareApplication");
if (window.groupStates.Information !== "off") activeGroupIris.push("dcat:Dataset");
if (window.groupStates.Service !== "off") activeGroupIris.push("service:Service");

window.groupValues = activeGroupIris.length > 0 ? activeGroupIris.join(' ') : "<http://example.org/None>";

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
  ?mapId a systemmap:SystemMap ; schema:name ?mapTitle .

  ?node a ?group ;
        schema:name ?name ;
        schema:description ?comment ;
        systemmap:abbreviation ?abbreviation ;
        schema:keywords ?keyword .
        
  ?keyword a schema:DefinedTerm ;
           schema:name ?keywordLabel .

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
         ?node schema:keywords ?keyword .
         OPTIONAL { ?keyword schema:name ?keywordLabel . }
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

window.getNodeDetailsQuery = function(nodeId) {
    return `
PREFIX schema: <http://schema.org/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>

CONSTRUCT {
    ?node schema:url ?landingPage ;
          systemmap:uid ?uid ;
          systemmap:streetAddress ?addressName ;
          systemmap:postalCode ?postalCode ;
          systemmap:addressLocality ?addressLocality ;
          systemmap:legalStatusName ?legalStatusName .
}
WHERE {
    BIND( <${nodeId}> AS ?node )
    
    OPTIONAL {
        {
            SELECT ?landingPage WHERE {
                GRAPH <https://lindas.admin.ch/foag/system-map> {
                    <${nodeId}> schema:url ?landingPage .
                }
            } LIMIT 1
        }
    }
    
    OPTIONAL {
        GRAPH <https://lindas.admin.ch/foj/zefix> {
            OPTIONAL {
                {
                    SELECT ?uid WHERE {
                        <${nodeId}> schema:identifier [
                            schema:name "CompanyUID" ;
                            schema:value ?uid
                        ] .
                    } LIMIT 1
                }
            }
            OPTIONAL {
                {
                    SELECT ?addressName ?postalCode ?addressLocality WHERE {
                        <${nodeId}> schema:address [
                            schema:streetAddress ?addressName ;
                            schema:postalCode ?postalCode ;
                            schema:addressLocality ?addressLocality
                        ] .
                    } LIMIT 1
                }
            }
            OPTIONAL {
                <${nodeId}> schema:additionalType ?legalStatus .
                GRAPH <https://lindas.admin.ch/lindas-ech> {
                    ?legalStatus schema:name ?legalStatusName .
                }
            }
        }
    }
}
`;
};

window.getSparqlData = async function(query) {
    const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/ld+json" } });
    return response.json();
};

window.mapClassIriToGroup = function(iri) {
    return APP_CONFIG.GROUP_MAP[iri] || "Other";
};