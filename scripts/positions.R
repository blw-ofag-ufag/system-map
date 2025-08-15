# Step 1: Load necessary packages
# package rdfhelper is from https://github.com/damian-oswald/rdfhelper

library(rdfhelper)
library(igraph)
library(ggraph)
library(dplyr)
library(stringr)

# Step 2: Fetch the network data from the SPARQL endpoint
query <- '
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>
PREFIX schema: <http://schema.org/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX service: <http://purl.org/ontology/service#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX zefix: <https://register.ld.admin.ch/zefix/company/>

SELECT ?subject ?predicate ?object
FROM <https://lindas.admin.ch/foag/system-map>
WHERE
{
  ?subject ?predicate ?object .
  ?subject a ?subjectClass .
  ?object  a ?objectClass .
  FILTER(
    ?subjectClass IN (
      schema:Organization,
      schema:SoftwareApplication,
      service:Service,
      dcat:Dataset
      ) &&
    ?objectClass  IN (
      schema:Organization,
      schema:SoftwareApplication,
      service:Service,
      dcat:Dataset
      ) &&
    ?predicate IN (
      dcterms:isPartOf,
      prov:wasDerivedFrom,
      schema:parentOrganization,
      systemmap:operates,
      systemmap:owns,
      systemmap:contains,
      systemmap:usesMasterData,
      schema:memberOf,
      service:provides,
      service:consumes,
      systemmap:access,
      systemmap:references
    )
  )
}
'

edges <- sparql(query, 'https://ld.admin.ch/query')

# Step 3: Assign numerical weights based on the predicate
edges_with_weights <- edges %>%
  mutate(weight = case_when(
    predicate %in% c("http://schema.org/memberOf",
                     "http://purl.org/ontology/service#consumes",
                     "https://agriculture.ld.admin.ch/system-map/owns",
                     "https://agriculture.ld.admin.ch/system-map/access") ~ 0.1,
    predicate %in% c("https://agriculture.ld.admin.ch/system-map/usesMasterData",
                     "http://www.w3.org/ns/prov#wasDerivedFrom",
                     "https://agriculture.ld.admin.ch/system-map/references") ~ 0.5,
    predicate %in% c("http://purl.org/dc/terms/isPartOf",
                     "https://agriculture.ld.admin.ch/system-map/contains") ~ 1.5,
    TRUE ~ 1.0
  ))

# Step 3: Create a graph object from the edge list
graph <- graph_from_data_frame(edges_with_weights[,c(1,3:4)], directed = TRUE)

# Step 4: Compute the canonical layout
set.seed(42)

# First, create the layout using the default settings
layout <- create_layout(graph,
                        layout = "fr",
                        niter = 5000,
                        weights = E(graph)$weight)

# normalize the positions (makes sure x, y are between -10 and 10)
for (i in 1:2) layout[,i] <- scale(layout[,i]) * 10

# Step 5: Write the canonical layout to a JSON file
jsonlite::write_json(layout[,1:3], "docs/layout.json", pretty = TRUE, digits = 6)
