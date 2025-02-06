# 🧭 A system map for the FOAG

- [**DigiAgriFood system map**](https://blw-ofag-ufag.github.io/system-map/index.html?lang=de), a visualization of the system map knowledge graph that specifically shows the classes organization, system and information unit.
- [**Circular system map**](https://blw-ofag-ufag.github.io/system-map/index.html?lang=de), an alternative visualization in circular arrangement.
- [**Ontology visualization**](https://service.tib.eu/webvowl/#iri=https://raw.githubusercontent.com/blw-ofag-ufag/system-map/refs/heads/main/graph.ttl) made with WebVOWL, allowing to get a quick grasp of the ontology underlying the system map.

# 🔎 Examples of SPARQL queries from LINDAS

- [Get nodes from LINDAS](https://s.zazuko.com/gmh9NR)
- [Get edges from LINDAS](https://s.zazuko.com/3wDcscR)
- [A list of information units](https://s.zazuko.com/2XsfNRB) and their classification according to the data protection act.

# 💭 Python processing of the `.ttl` files

The repository includes a Python script `scripts/reason.py` that processes the two Turtle files (`data.ttl` and `ontology.ttl`) by first sorting them and then applying custom reasoning before producing the final output (`graph.ttl`). Here's how it works:

1. **Sorting the turtle files:** Before any reasoning is applied, both `ontology.ttl` and `data.ttl` are loaded and sorted using a custom serializer (based on [otsrdflib](https://pypi.org/project/otsrdflib/)). This ensures that:
   
   - The triple order is consistent for easier human reading and debugging.
   - The versioning of the files in GitHub stays more consistent.
   - The syntax stays consistent (e.g., new line for each triple etc.)

2. **Merging and custom reasoning:** The script then merges the ontology and data graphs into a single RDF graph and performs iterative reasoning based on two primary rules:
   
   - Subclass reasoning: If an instance is declared as being of a certain class `A`, and the ontology specifies that `A` is a subclass of another class `B` (using `rdfs:subClassOf`), the script infers that the instance is also of type `B`.   
   - Inverse Property Reasoning: If a property `p` is defined to have an inverse `q` (using `owl:inverseOf`), then for every triple `(s, p, o)`, the script adds the inverse triple `(o, q, s)` to the graph.

   This reasoning is applied iteratively—repeating the process until no new triples are added—so that all valid inferences are captured in the final graph.

3. **Final output:** Once reasoning is complete, the enriched graph is saved to `graph.ttl`. The output file is sorted as well, ensuring consistency and readability. This final sorted and reasoned graph is the one that is pushed to LINDAS.

This processing pipeline enhances the raw data with logical inferences based on the ontology and hence improves the consistency of the produced graph.

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