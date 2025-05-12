// handle clicks on the burger menu to open/close the mobile menu
const menuButtonElement = document.querySelector('#main-header button.burger')
menuButtonElement.addEventListener('click', () => {
  document.body.classList.toggle('body--mobile-menu-is-open')
})

// Ensure your getSparqlData function is available, for example:
window.getSparqlData = async function(query) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
  });
  return response.json();
};

window.ENDPOINT = "https://lindas.admin.ch/query";

// Function to load data and build the table
// Function to load data and build the extended table
async function loadSystemTable() {
  // Updated SPARQL query (make sure to use the updated version above)
  const query = `
    PREFIX schema: <http://schema.org/>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX systemmap: <https://agriculture.ld.admin.ch/system-map/>

    SELECT ?system ?systemName ?systemAbbreviation (GROUP_CONCAT(DISTINCT ?parentName; separator=", ") AS ?parentNames) ?personal ?sensitive
    WHERE {
      GRAPH <https://lindas.admin.ch/foag/system-map> {
        ?system a schema:SoftwareApplication .
        ?system systemmap:operatedBy ?operator .
        ?operator schema:parentOrganization* ?parent .
        FILTER (NOT EXISTS { ?parent schema:parentOrganization ?grandparent . } )
        ?parent rdfs:label ?parentName .
        FILTER(LANG(?parentName) = "de")
        
        ?system rdfs:label ?systemName .
        FILTER(LANG(?systemName) = "de")
        
        OPTIONAL {
          ?system systemmap:abbreviation ?systemAbbreviation .
          FILTER(LANG(?systemAbbreviation) = "de")
        }
      }
      
      OPTIONAL {
        SELECT ?system (IF(COUNT(?pi) > 0, true, false) AS ?personalValue)
        WHERE {
          ?system systemmap:contains ?info .
          OPTIONAL {
            ?info a termdat:52451 .
            BIND(?info AS ?pi)
          }
        }
        GROUP BY ?system
      }
      BIND(?personalValue AS ?personal)
      
      OPTIONAL {
        SELECT ?system (IF(COUNT(?pi) > 0, true, false) AS ?sensitivePersonalValue)
        WHERE {
          ?system systemmap:contains ?info .
          OPTIONAL {
            ?info a termdat:52453 .
            BIND(?info AS ?pi)
          }
        }
        GROUP BY ?system
      }
      BIND(?sensitivePersonalValue AS ?sensitive)
    }
    GROUP BY ?system ?systemName ?systemAbbreviation ?personal ?sensitive
  `;

  try {
    const data = await getSparqlData(query);
    const results = data.results.bindings;
    const tbody = document.querySelector('#system-table tbody');
    tbody.innerHTML = ""; // Clear existing rows

    results.forEach(row => {
      // Extract values with fallbacks if not present
      const systemIRI = row.system ? row.system.value : '#';
      const systemName = row.systemName ? row.systemName.value : '';
      const systemAbbreviation = row.systemAbbreviation ? row.systemAbbreviation.value : '';
      const parentNames = row.parentNames ? row.parentNames.value : '';
      // For boolean fields, display a cross (✗) when true; else empty
      const personal = (row.personal && row.personal.value === "true") ? "✗" : "";
      const sensitive = (row.sensitive && row.sensitive.value === "true") ? "✗" : "";

      // Combine system name and abbreviation (if available)
      const displayName = systemAbbreviation ? `${systemName} (${systemAbbreviation})` : systemName;
      // Create a hyperlink for the system name
      const systemLink = `<a href="${systemIRI}">${displayName}</a>`;

      // Build a table row with the new operator column included
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${systemLink}</td>
        <td>${parentNames}</td>
        <td style="text-align: center;">${personal}</td>
        <td style="text-align: center;">${sensitive}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error loading system table:", error);
  }
}

// Run the function when the DOM is ready
document.addEventListener("DOMContentLoaded", loadSystemTable);
