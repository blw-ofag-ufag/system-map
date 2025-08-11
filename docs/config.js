/**
 * Reads a CSS custom property (variable) from the :root element.
 * @param {string} name - The name of the CSS variable (e.g., '--color-highlight-bg').
 * @returns {string} The value of the variable.
 */
function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * This object holds all application-wide configurations.
 * Style-related values are dynamically populated from the CSS variables in styles.css.
 */
const APP_CONFIG = {
    // SPARQL Endpoint for fetching data
    ENDPOINT: "https://lindas.admin.ch/query",

    // Prefixes for shortening IRIs into CURIEs
    PREFIXES: {
        "http://www.w3.org/2000/01/rdf-schema#": "rdfs",
        "http://www.w3.org/2002/07/owl#": "owl",
        "https://agriculture.ld.admin.ch/system-map/": "systemmap",
        "http://schema.org/": "schema",
        "http://www.w3.org/ns/dcat#": "dcat",
        "http://www.w3.org/ns/prov#": "prov",
        "http://purl.org/ontology/service#": "service",
        "http://purl.org/dc/terms/": "dcterms",
        "https://register.ld.admin.ch/zefix/company/": "zefix"
    },

    // Maps keys used in URL parameters to their corresponding predicate IRIs
    PREDICATE_MAP: {
        isPartOf: "dcterms:isPartOf",
        wasDerivedFrom: "prov:wasDerivedFrom",
        parentOrg: "schema:parentOrganization",
        operates: "systemmap:operates",
        owns: "systemmap:owns",
        contains: "systemmap:contains",
        usesMasterData: "systemmap:usesMasterData",
        memberOf: "schema:memberOf",
        provides: "service:provides",
        consumes: "service:consumes",
        access: "systemmap:access",
        references: "systemmap:references"
    },

    // A list of predicates that should be rendered as dashed lines in the graph
    DASHED_PREDICATES: [
        "http://www.w3.org/ns/prov#wasDerivedFrom",
        "http://purl.org/ontology/service#consumes",
        "https://agriculture.ld.admin.ch/system-map/owns",
        "https://agriculture.ld.admin.ch/system-map/usesMasterData",
        "https://agriculture.ld.admin.ch/system-map/access",
        "https://agriculture.ld.admin.ch/system-map/references"
    ],

    // Maps RDF class IRIs to the group names used for styling and filtering
    GROUP_MAP: {
        "http://schema.org/Organization": "Organization",
        "http://schema.org/SoftwareApplication": "System",
        "http://www.w3.org/ns/dcat#Dataset": "Information",
        "http://purl.org/ontology/service#Service": "Service"
    },

    /**
     * Initializes style-related constants by reading them from the CSS root variables.
     * This should be called once the DOM is ready.
     */
    initializeStylesFromCSS: function() {
        // Create a reverse map from group name to IRI for easy lookup
        this.GROUP_IRI_MAP = Object.fromEntries(
            Object.entries(this.GROUP_MAP).map(([iri, group]) => [group, iri])
        );

        this.GROUP_STYLES = {
            System: {
                background: getCssVar('--color-group-system-bg'),
                border: getCssVar('--color-group-system-border'),
                font: {
                    color: getCssVar('--color-group-system-font')
                }
            },
            Information: {
                background: getCssVar('--color-group-information-bg'),
                border: getCssVar('--color-group-information-border'),
                font: {
                    color: getCssVar('--color-group-information-font')
                }
            },
            Organization: {
                background: getCssVar('--color-group-organization-bg'),
                border: getCssVar('--color-group-organization-border'),
                font: {
                    color: getCssVar('--color-group-organization-font')
                }
            },
            Service: {
                background: getCssVar('--color-group-service-bg'),
                border: getCssVar('--color-group-service-border'),
                font: {
                    color: getCssVar('--color-group-service-font')
                }
            },
            Other: {
                background: getCssVar('--color-group-other-bg'),
                border: getCssVar('--color-group-other-border'),
                font: {
                    color: getCssVar('--color-group-other-font')
                }
            }
        };

        this.SEARCH_HIGHLIGHT_COLOR = {
            background: getCssVar('--color-highlight-bg'),
            border: getCssVar('--color-highlight-border'),
            font: {
                color: getCssVar('--color-highlight-font')
            }
        };
    }
};