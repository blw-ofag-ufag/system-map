import rdflib
from rdflib import Namespace, RDF, RDFS, OWL, URIRef

def load_and_collect_metadata(ontology_graph):
    """
    Scans the ontology graph to find:
      - transitive properties,
      - inverse-of relationships,
      - domain and range constraints,
      - etc.
    Returns dictionaries or sets that we can use for reasoning.
    """
    transitive_props = set()
    inverse_of = {}      # p -> q if p owl:inverseOf q
    domain_of = {}       # p -> [C1, C2, ...]
    range_of = {}        # p -> [C1, C2, ...]

    for (s, p, o) in ontology_graph:
        # Detect transitive properties
        if (s, RDF.type, OWL.ObjectProperty) in ontology_graph or (s, RDF.type, OWL.DatatypeProperty) in ontology_graph:
            # If we see s as a property, check if also declared transitive
            if (s, RDF.type, OWL.TransitiveProperty) in ontology_graph:
                transitive_props.add(s)
        
        # owl:inverseOf
        # If we see (prop1 owl:inverseOf prop2)
        if p == OWL.inverseOf and isinstance(s, URIRef) and isinstance(o, URIRef):
            inverse_of[s] = o
            inverse_of[o] = s  # Because inverse is bidirectional

        # domain
        if p == RDFS.domain and isinstance(s, URIRef) and isinstance(o, URIRef):
            domain_of.setdefault(s, set()).add(o)

        # range
        if p == RDFS.range and isinstance(s, URIRef) and isinstance(o, URIRef):
            range_of.setdefault(s, set()).add(o)

    return transitive_props, inverse_of, domain_of, range_of

def reason_custom(ontology_path, data_path, output_path):
    """
    1) Load ontology, gather property metadata.
    2) Load data.
    3) Expand data with (a) inverse properties, (b) transitive props,
       (c) domain/range => instance membership.
    4) Save result to output_path.
    """
    # 1) Load ontology
    ont_graph = rdflib.Graph()
    ont_graph.parse(ontology_path, format="turtle")

    # Collect property rules from the ontology
    transitive_props, inverse_of, domain_of, range_of = load_and_collect_metadata(ont_graph)

    # 2) Load data
    data_graph = rdflib.Graph()
    data_graph.parse(data_path, format="turtle")

    # Combine them for reasoning (or keep them separate if you prefer).
    # Usually you want to reason over the union:
    g = ont_graph + data_graph

    # 3) Iteratively add new statements until no change
    new_triples = True
    while new_triples:
        new_triples = False
        existing_triples = set(g)

        # A) Inverse property expansions
        for (s, p, o) in list(existing_triples):
            # if p has an inverse p_inv, add (o, p_inv, s)
            p_inv = inverse_of.get(p)
            if p_inv and (o, p_inv, s) not in g:
                g.add((o, p_inv, s))

        # B) Transitive expansions
        # If p is transitive, and we have (x p y) and (y p z), then add (x p z)
        for tp in transitive_props:
            # filter existing triples for those using tp
            # a naive approach: store them in a dict: subject -> [objects]
            # then for each (x p y), for each y's object z => (x p z)
            sp_map = {}
            for (x, p, y) in existing_triples:
                if p == tp:
                    sp_map.setdefault(x, []).append(y)
            # now expand
            for x, ys in sp_map.items():
                for y in ys:
                    if (y, tp, None) in g:
                        for z in g.objects(y, tp):
                            if (x, tp, z) not in g:
                                g.add((x, tp, z))

        # C) Domain/range -> instance membership
        # If p has domain C, and we see (s p o), then s a C.
        # If p has range C, then o a C.
        for (s, p, o) in existing_triples:
            # Domain expansions
            if p in domain_of:
                for domain_class in domain_of[p]:
                    if (s, RDF.type, domain_class) not in g:
                        g.add((s, RDF.type, domain_class))

            # Range expansions
            if p in range_of:
                for range_class in range_of[p]:
                    if (o, RDF.type, range_class) not in g:
                        g.add((o, RDF.type, range_class))

        #  Remove triples where the subject is a literal and unnecessary self sameAs statements
        for s, p, o in list(g):
            if isinstance(s, rdflib.Literal):
                g.remove((s, p, o))
            elif p == rdflib.OWL.sameAs and s == o:
                g.remove((s, p, o))
        
        # Check if new statements were added
        if len(g) > len(existing_triples):
            new_triples = True

    # Save final result
    g.serialize(destination=output_path, format="turtle")
    print(f"Custom reasoning done. Output in {output_path}")

# Namespace for the example
EX = Namespace("http://example.org/onto#")

# apply custom reasoning
if __name__ == "__main__":
    reason_custom("ontology.ttl", "data.ttl", "graph.ttl")