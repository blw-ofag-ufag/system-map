import os
import pytest
from SPARQLWrapper import SPARQLWrapper, JSON

QUERY_DIR = "src/sparql/queries/"
ENDPOINT_URL = "https://agriculture.ld.admin.ch/query"

def discover_queries():
    """Reads all SPARQL files from the target directory."""
    query_files = []
    if not os.path.exists(QUERY_DIR):
        return query_files
        
    for filename in os.listdir(QUERY_DIR):
        if filename.endswith((".rq", ".sparql")):
            filepath = os.path.join(QUERY_DIR, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                query_files.append((filename, f.read()))
    return query_files

@pytest.mark.parametrize("filename, query_string", discover_queries())
def test_sparql_execution(filename, query_string):
    """Executes each query and asserts the result set is non-empty."""
    sparql = SPARQLWrapper(ENDPOINT_URL)
    sparql.setQuery(query_string)
    sparql.setReturnFormat(JSON)

    try:
        response = sparql.query().convert()
        assert isinstance(response, dict), f"Response for {filename} is not a valid JSON object."        
        if "results" in response:
            bindings = response["results"].get("bindings", [])
            assert len(bindings) > 0, f"Query {filename} failed: The result set contains 0 rows."
        elif "boolean" in response:
            assert isinstance(response["boolean"], bool), f"ASK query {filename} lacks boolean payload."
        else:
            pytest.fail(f"Unrecognized SPARQL protocol response type for {filename}.")

    except Exception as e:
        pytest.fail(f"Execution of {filename} failed: {str(e)}")