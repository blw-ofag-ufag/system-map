# Run the Python/SPARQL reasoning script
echo "Running Python reasoning script..."
python3 scripts/reason.py

# Apply SHACL rules to check for constraint violations
pyshacl -s rdf/shape.ttl -f human rdf/graph.ttl