import sys
from pathlib import Path
import rdflib

def main():
    rdf_dir = Path("rdf")
    ttl_files = list(rdf_dir.glob("*.ttl"))
    
    if not ttl_files:
        print("No Turtle files found in 'rdf/'.")
        sys.exit(0)
    
    all_valid = True
    for ttl_file in ttl_files:
        print(f"Validating {ttl_file}...")
        g = rdflib.Graph()
        try:
            g.parse(ttl_file, format="turtle")
        except Exception as e:
            # Print GitHub Actions annotation for syntax error
            print(f"::error file={ttl_file},line=1::Syntax error in {ttl_file}: {e}")
            all_valid = False
    
    if all_valid:
        print("All Turtle files are valid!")
    else:
        print("Some Turtle files have syntax errors.")
        sys.exit(1)

if __name__ == "__main__":
    main()
