import rdflib
from pyshacl import validate

def main():
    data_file = 'rdf/graph.ttl'     # Path to your data file
    shapes_file = 'rdf/shape.ttl' # Path to your SHACL shapes file

    # Load the data graph
    data_graph = rdflib.Graph()
    data_graph.parse(data_file, format='turtle')

    # Load the shapes (SHACL) graph
    shapes_graph = rdflib.Graph()
    shapes_graph.parse(shapes_file, format='turtle')

    # Validate using pySHACL
    # - inference='rdfs' will apply simple RDFS inference
    #   if you do not want any inference, set inference=None
    # - advanced=True enables more advanced SHACL features if needed
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
    print(results_text)

if __name__ == "__main__":
    main()
