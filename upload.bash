set -e # immediately exit on error
source .env # load environment variables

echo Validate syntax of turtle files
python3 src/python/validate.py rdf

echo Create a dedicated ontology file for subsequent WebVOWL visualization
python3 src/python/rdf-processing.py \
  -i rdf/ontology/*.ttl rdf/data/*.ttl \
  -o rdf/processed/ontology.ttl \
  -r src/sparql/inference-rules/*.rq src/sparql/processing-rules/*.rq

echo Merge all data into one graph for subsequent LINDAS upload
python3 src/python/rdf-processing.py \
  -i rdf/ontology/*.ttl rdf/data/*.ttl rdf/shape/*.ttl \
  -o rdf/processed/graph.ttl \
  -r src/sparql/inference-rules/*.sparql

echo Apply SHACL rules to check for constraint violations
pyshacl -f human rdf/processed/graph.ttl

echo Delete existing data from LINDAS
curl \
  --user "$USER:$PASSWORD" \
  -X DELETE \
  "$ENDPOINT?graph=$GRAPH"

echo Upload graph.ttl file to LINDAS
curl \
  --user "$USER:$PASSWORD" \
  -X POST \
  -H "Content-Type: text/turtle" \
  --data-binary @rdf/processed/graph.ttl \
  "$ENDPOINT?graph=$GRAPH"

echo All commands executed
