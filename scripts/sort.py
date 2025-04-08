import rdflib
from rdflib import Graph
from rdflib.namespace import NamespaceManager
from otsrdflib import OrderedTurtleSerializer

# We keep SCHEMA here just in case you want to preserve or rebind "schema:".
# If that's not needed, you can remove it.
SCHEMA = rdflib.Namespace("http://schema.org/")

def sort_and_overwrite_turtle(graph: Graph, file_path: str):
    """
    Sorts the given RDF graph and overwrites the given Turtle file in sorted form.
    Forcibly rebinds 'schema:' to http://schema.org/ so we don't get schema1:, etc.
    """
    # 1) Create a new, empty namespace manager
    nm = NamespaceManager(Graph())

    # 2) Copy over existing prefixes except those that point to http://schema.org/
    #    or start with "schema"
    for prefix, uri in graph.namespace_manager.namespaces():
        if str(uri) == str(SCHEMA) or prefix.startswith("schema"):
            # Skip any existing schema or schema1, schema2, etc.
            continue
        nm.bind(prefix, uri)

    # 3) Bind "schema" -> "http://schema.org/" exactly once
    nm.bind("schema", str(SCHEMA), replace=True)

    # 4) Assign the new namespace manager to the graph
    graph.namespace_manager = nm

    # 5) Serialize with the OrderedTurtleSerializer
    with open(file_path, "wb") as f:
        serializer = OrderedTurtleSerializer(graph)
        serializer.namespace_manager = graph.namespace_manager
        serializer.serialize(f)

    print(f"File '{file_path}': Triples sorted and overwritten.")

def load_and_sort_ttl(file_path: str) -> Graph:
    """
    Loads a Turtle file into an RDF graph, sorts it, and overwrites the original file.
    Returns the loaded (and sorted) graph.
    """
    g = Graph()
    g.parse(file_path, format="turtle")
    # Sort the file's content and overwrite the original.
    sort_and_overwrite_turtle(g, file_path)
    return g

if __name__ == "__main__":
    # Example usage:
    file_path_to_sort = "rdf/data.ttl"
    load_and_sort_ttl(file_path_to_sort)
