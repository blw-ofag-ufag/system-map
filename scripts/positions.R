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

SELECT ?subject ?object
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

# Step 3: Create a graph object from the edge list
# The 'edges' tibble is a data frame of connections, perfect for igraph.
graph <- graph_from_data_frame(edges, directed = TRUE)

# Step 4: Compute the canonical layout
set.seed(42)
layout <- data.frame(
  V(graph)$name,
  create_layout(
    graph,
    layout = 'fr', # use Fruchterman-Reingold force-directed layout
    niter = 500
    )
)
names(layout) <- c("uri", "x", "y")

# Step 5: Write the canonical layout to a JSON file
jsonlite::write_json(layout, "docs/layout.json", pretty = TRUE, digits = 6)
