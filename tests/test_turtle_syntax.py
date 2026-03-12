import pytest
from pathlib import Path
import rdflib

# Define the target directory relative to the execution context
TARGET_DIR = Path(".") 

def discover_ttl_files():
    """
    Traverses the directory tree to discover all RDF Turtle files.
    Returns a list of Path objects.
    """
    if not TARGET_DIR.exists() or not TARGET_DIR.is_dir():
        return []
    
    # rglob provides recursive globbing, functionally equivalent to "**/*.ttl"
    return list(TARGET_DIR.rglob("*.ttl"))

# The ids parameter ensures the test output uses the filename, making debugging clearer.
@pytest.mark.parametrize("filepath", discover_ttl_files(), ids=lambda p: str(p))
def test_turtle_syntax(filepath):
    """
    Instantiates an ephemeral RDF graph and attempts to parse the Turtle file.
    A parsing exception indicates invalid syntax and fails the test.
    """
    graph = rdflib.Graph()
    
    try:
        graph.parse(str(filepath), format="turtle")
    except Exception as e:
        # pytest.fail terminates this specific parameterized run with the provided message
        pytest.fail(f"Syntax validation failed for {filepath}\nDetails: {str(e)}")