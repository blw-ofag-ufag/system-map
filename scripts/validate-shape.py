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

    # Print overall results
    print("Conforms:", conforms)

    if not conforms:
        # Print GitHub Actions annotation to clearly indicate a SHACL validation failure.
        # This annotation will be parsed by GitHub and shown inline on the PR.
        print(results_text)
        sys.exit(1)

if __name__ == "__main__":
    main()
