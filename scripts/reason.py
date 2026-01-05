import sys
import os
import glob
from pathlib import Path
import rdflib
from rdflib import Graph, Namespace
from rdflib.namespace import NamespaceManager
from otsrdflib import OrderedTurtleSerializer

ONTOLOGY_PATH = Path("rdf/ontology.ttl")
DATA_PATH = Path("rdf/data.ttl")
OUTPUT_PATH = Path("rdf/graph.ttl")
RULES_DIR = Path("sparql/rules")
SCHEMA = Namespace("http://schema.org/")

def load_graph(path: Path) -> Graph:
    g = Graph()
    g.parse(str(path), format="turtle")
    print(f"[+] Loaded {len(g)} triples from {path}")
    return g

def apply_rules(graph: Graph, rules_dir: Path):
    rules = sorted(rules_dir.glob("*.sparql"))
    print(f"[i] Found {len(rules)} rules. Materializing...")
    for rule in rules:
        with open(rule, "r") as f:
            query_string = f.read()
        results = graph.query(query_string)
        initial_count = len(graph)
        for triple in results:
            graph.add(triple)
        added_count = len(graph) - initial_count
        print(f"  -> {rule.name}: +{added_count} triples")

def save_graph(graph: Graph, output_path: Path):
    nm = graph.namespace_manager
    nm.bind("schema", SCHEMA, replace=True) 
    print(f"[+] Writing {len(graph)} triples to {output_path}...")
    with open(output_path, "wb") as f:
        serializer = OrderedTurtleSerializer(graph)
        serializer.namespace_manager = nm
        serializer.serialize(f)

def main():
    print("Starting Python Reasoning...")
    g_ont = load_graph(ONTOLOGY_PATH)
    g_data = load_graph(DATA_PATH)
    full_graph = g_ont + g_data
    apply_rules(full_graph, RULES_DIR)
    save_graph(full_graph, OUTPUT_PATH)
    print("Done.")

if __name__ == "__main__":
    main()