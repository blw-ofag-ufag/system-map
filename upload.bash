# load environment variables
. .env

# Run the Python/SPARQL reasoning script
echo "Running Python reasoning script..."
python3 scripts/reason.py

# Apply SHACL rules to check for constraint violations
pyshacl -s rdf/shape.ttl -f human rdf/graph.ttl

echo "Delete existing data from LINDAS"
curl \
  --user "$USER:$PASSWORD" \
  -X DELETE \
  "$ENDPOINT?graph=$GRAPH"

echo "Upload graph.ttl file to LINDAS"
curl \
  --user "$USER:$PASSWORD" \
  -X POST \
  -H "Content-Type: text/turtle" \
  --data-binary @rdf/graph.ttl \
  "$ENDPOINT?graph=$GRAPH"

echo "Remove graph.ttl file"
rm rdf/graph.ttl

echo "All commands executed."
