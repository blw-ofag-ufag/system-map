import sys
import rdflib
from pyshacl import validate

def main():
    data_file = 'rdf/graph.ttl'
    shapes_file = 'rdf/shape.ttl'

    data_graph = rdflib.Graph()
    data_graph.parse(data_file, format='turtle')

    shapes_graph = rdflib.Graph()
    shapes_graph.parse(shapes_file, format='turtle')

    conforms, results_graph, results_text = validate(
        data_graph,
        shacl_graph=shapes_graph,
        inference='rdfs',
        abort_on_first=False,
        meta_shacl=False,
        advanced=True,
        debug=False
    )

    # Print the overall results
    print("Conforms:", conforms)
    print(results_text)

    # If not conforming, exit with a non-zero code so CI will fail
    if not conforms:
        # Optionally, you could parse the results_graph to find how many violations there are,
        # but just a non-zero exit is enough for many CI setups.
        sys.exit(1)  # Return an error code so that the pipeline fails

if __name__ == "__main__":
    main()
