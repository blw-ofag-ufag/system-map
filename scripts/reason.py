import rdflib
from rdflib import Graph, RDF, RDFS, OWL, URIRef, Namespace
from rdflib.namespace import NamespaceManager
from otsrdflib import OrderedTurtleSerializer

SCHEMA = Namespace("http://schema.org/") # set schema prefix to the old, outdated http://... prefix because LINDAS works with these

def sort_and_overwrite_turtle(graph: Graph, file_path: str):
    """
    Sorts the given RDF graph and overwrites the given Turtle file in sorted form.
    Forcibly rebinds 'schema:' to http://schema.org/ so we don't get schema1:, etc.
    """

    # 1) Create a new, empty namespace manager
    nm = NamespaceManager(Graph())

    # 2) Copy over all *existing* prefixes except those that
    #    point to http://schema.org/ or start with "schema"
    for prefix, uri in graph.namespace_manager.namespaces():
        if str(uri) == str(SCHEMA) or prefix.startswith("schema"):
            # Skip any existing schema or schema1, schema2, etc.
            continue
        nm.bind(prefix, uri)

    # 3) Bind "schema" -> "http://schema.org/" exactly once
    nm.bind("schema", str(SCHEMA), replace=True)

    # 4) Assign the new namespace manager to the graph
    graph.namespace_manager = nm

    # 5) Serialize with the OrderedTurtleSerializer,
    #    ensuring it uses this updated namespace manager
    with open(file_path, "wb") as f:
        serializer = OrderedTurtleSerializer(graph)
        serializer.namespace_manager = graph.namespace_manager
        serializer.serialize(f)

    print(f"File '{file_path}': Triples sorted and overwritten.")

def load_and_sort_ttl(file_path: str) -> Graph:
    """
    Loads a TTL file into an RDF graph, sorts it, and overwrites the original file.
    Returns the loaded (and sorted) graph.
    """
    g = Graph()
    g.parse(file_path, format="turtle")
    # Sort the file's content, overwriting the original.
    sort_and_overwrite_turtle(g, file_path)
    return g

def reason_subclass_and_inverse(ontology_graph: Graph, data_graph: Graph) -> Graph:
    """
    Merges ontology_graph and data_graph, then applies:
      1) Subclass reasoning: If A rdfs:subClassOf B, and x is instance of A -> x is instance of B.
      2) Inverse reasoning: If p owl:inverseOf q, then (s p o) implies (o q s).
    Returns the final inferred graph.
    """
    # Merge into a single graph
    g = ontology_graph + data_graph

    # Collect direct subclass relationships and inverse-of relationships
    subclass_of = {}
    inverse_of = {}

    for s, p, o in ontology_graph:
        if p == RDFS.subClassOf and isinstance(s, URIRef) and isinstance(o, URIRef):
            subclass_of.setdefault(s, set()).add(o)
        if p == OWL.inverseOf and isinstance(s, URIRef) and isinstance(o, URIRef):
            inverse_of[s] = o
            inverse_of[o] = s

    # Iterative expansion
    changed = True
    while changed:
        changed = False
        existing_triples = set(g)

        # 1) Inverse property expansions
        for (s, p, o) in list(existing_triples):
            p_inv = inverse_of.get(p)
            if p_inv and (o, p_inv, s) not in g:
                g.add((o, p_inv, s))

        # 2) Subclass expansions
        # If we see (x rdf:type A), and A rdfs:subClassOf B, add (x rdf:type B)
        for (x, rdf_type, classA) in list(existing_triples):
            if rdf_type == RDF.type and classA in subclass_of:
                for classB in subclass_of[classA]:
                    if (x, RDF.type, classB) not in g:
                        g.add((x, RDF.type, classB))

        # Optionally remove any triple whose subject is a literal
        for s, p, o in list(g):
            if isinstance(s, rdflib.Literal):
                g.remove((s, p, o))

        if len(g) > len(existing_triples):
            changed = True

    # --- New part: duplicate langstring labels/comments as schema:name/description ---
    # We'll do a final pass to copy over rdfs:label => schema:name, rdfs:comment => schema:description
    # preserving language tags if present.
    new_triples = []
    for s, p, o in g.triples((None, None, None)):
        # Check if it's a label
        if p == RDFS.label:
            # (s, schema:name, o) if not already in the graph
            if (s, SCHEMA.name, o) not in g:
                new_triples.append((s, SCHEMA.name, o))

        # Check if it's a comment
        elif p == RDFS.comment:
            # (s, schema:description, o) if not already in the graph
            if (s, SCHEMA.description, o) not in g:
                new_triples.append((s, SCHEMA.description, o))

    for triple in new_triples:
        g.add(triple)
    # ---

    print(f"File 'graph.ttl': Finished reasoning, added new triples.")
    return g

if __name__ == "__main__":
    # Paths
    ontology_path = "rdf/ontology.ttl"
    data_path = "rdf/data.ttl"
    output_path = "rdf/graph.ttl"

    # 1) Load and sort the individual TTL files
    #    This step ensures the source TTL files are also "cleanly" sorted
    ont_graph = load_and_sort_ttl(ontology_path)
    data_graph = load_and_sort_ttl(data_path)

    # 2) Run custom reasoning
    reasoned_graph = reason_subclass_and_inverse(ont_graph, data_graph)

    # 3) Save reasoned output
    reasoned_graph.serialize(destination=output_path, format="turtle")

    # 4) Finally, sort and overwrite the final output file
    final_graph = Graph()
    final_graph.parse(output_path, format="turtle")
    sort_and_overwrite_turtle(final_graph, output_path)
