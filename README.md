# 🧭 A system map for the FOAG

- [**DigiAgriFood system map**](https://blw-ofag-ufag.github.io/system-map/index.html?lang=de), a visualization of the system map knowledge graph that specifically shows the classes organization, system and information unit.
- [**Circular system map**](https://blw-ofag-ufag.github.io/system-map/index.html?lang=de), an alternative visualization in circular arrangement.
- [**Ontology visualization**](https://service.tib.eu/webvowl/#iri=https://raw.githubusercontent.com/blw-ofag-ufag/system-map/refs/heads/main/graph.ttl) made with WebVOWL, allowing to get a quick grasp of the ontology underlying the system map.

# 🔎 Examples of SPARQL queries from LINDAS

- [Get nodes from LINDAS](https://s.zazuko.com/gmh9NR)
- [Get edges from LINDAS](https://s.zazuko.com/3wDcscR)
- [A list of information units](https://s.zazuko.com/2XsfNRB) and their classification according to the data protection act.

# 🆙 Guide to upload the turtle files to LINDAS

In order to upload a graph (as a turtle `.ttl` file) to the linked data service LINDAS, use the following cURL command:

```curl
curl \
  --user lindas-foag:mySuperStrongPassword \
  -X POST \
  -H "Content-Type: text/turtle" \
  --data-binary @graph/plant-protection.ttl \
  "https://stardog-test.cluster.ldbar.ch/lindas?graph=https://lindas.admin.ch/foag/ontologies"
```

Replace `mySuperStrongPassword` with the actual password. Of course, `graph/plant-protection.ttl` could be set to another turtle file and `https://lindas.admin.ch/foag/ontologies` to another target graph.

*If* data that was already uploaded was changed, clear the existing graph before posting. (Otherwise, stardog creates duplicate nodes for the changes.) To clear the graph, run:

```curl
curl \
  --user lindas-foag:mySuperStrongPassword \
  -X DELETE \
  "https://stardog-test.cluster.ldbar.ch/lindas?graph=https://lindas.admin.ch/foag/ontologies"
```