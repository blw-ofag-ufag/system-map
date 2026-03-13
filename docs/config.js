function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const APP_CONFIG = {

    ENDPOINT: "https://lindas.admin.ch/query",

    UI_TEXT: {
        en: {
            appTitle: "FOAG System Map",
            settings: "Settings",
            minDegree: "Minimum Node Connections",
            visibleNodeClasses: "Class visibility",
            stateFull: "Full",
            stateCollapsed: "Collapsed",
            stateOff: "Off",
            visibleRelationshipTypes: "Visible Relationship Types",
            filterKeywords: "Filter Datasets by Keyword",
            cancel: "Cancel",
            saveAndReload: "Save & Reload",
            searchPlaceholder: "Search...",
            settingsTooltip: "Settings",
            githubTooltip: "GitHub",
            emailTooltip: "Email",
            errorLoading: "Error loading data",
            fallbackSystemMapTitle: "DigiAgriFoodCH System Map",
            noLabel: "No label"
        },
        de: {
            appTitle: "Systemkarte BLW",
            settings: "Einstellungen",
            minDegree: "Minimale Anzahl Verbindungen",
            visibleNodeClasses: "Sichtbarkeit der Klassen",
            stateFull: "Vollständig",
            stateCollapsed: "Gruppiert",
            stateOff: "Aus",
            visibleRelationshipTypes: "Sichtbare Beziehungstypen",
            filterKeywords: "Datensätze nach Schlüsselwort filtern",
            cancel: "Abbrechen",
            saveAndReload: "Speichern & neu laden",
            searchPlaceholder: "Suchen...",
            settingsTooltip: "Einstellungen",
            githubTooltip: "GitHub",
            emailTooltip: "E-Mail",
            errorLoading: "Fehler beim Laden der Daten",
            fallbackSystemMapTitle: "DigiAgriFoodCH Systemlandkarte",
            noLabel: "Ohne Bezeichnung"
        },
        fr: {
            appTitle: "Carte des systèmes OFAG",
            settings: "Paramètres",
            minDegree: "Nombre de connexions de nœuds minimum",
            visibleNodeClasses: "Visibilité des classes",
            stateFull: "Complet",
            stateCollapsed: "Regroupé",
            stateOff: "Désactivé",
            visibleRelationshipTypes: "Types de relations visibles",
            filterKeywords: "Filtrer les jeux de données par mot-clé",
            cancel: "Annuler",
            saveAndReload: "Enregistrer & recharger",
            searchPlaceholder: "Rechercher...",
            settingsTooltip: "Paramètres",
            githubTooltip: "GitHub",
            emailTooltip: "E-mail",
            errorLoading: "Erreur de chargement des données",
            fallbackSystemMapTitle: "DigiAgriFoodCH Carte du Système",
            noLabel: "Sans étiquette"
        },
        it: {
            appTitle: "Mappa dei sistemi UFAG",
            settings: "Impostazioni",
            minDegree: "Numero minimo di connessioni dei nodi",
            visibleNodeClasses: "Visibilità delle classi",
            stateFull: "Completo",
            stateCollapsed: "Raggruppato",
            stateOff: "Spento",
            visibleRelationshipTypes: "Tipi di relazioni visibili",
            filterKeywords: "Filtra i set di dati per parola chiave",
            cancel: "Annulla",
            saveAndReload: "Salva e ricarica",
            searchPlaceholder: "Cerca...",
            settingsTooltip: "Impostazioni",
            githubTooltip: "GitHub",
            emailTooltip: "E-mail",
            errorLoading: "Errore nel caricamento dei dati",
            fallbackSystemMapTitle: "DigiAgriFoodCH Mappa del Sistema",
            noLabel: "Senza etichetta"
        }
    },

    PREFIXES: {
        "https://www.fedlex.admin.ch/eli/cc/1998/3033_3033_3033#": "LwG",
        "http://www.w3.org/ns/dcat#": "dcat",
        "http://purl.org/dc/terms/": "dcterms",
        "http://purl.org/dc/dcmitype/": "dcmitype",
        "http://www.w3.org/2002/07/owl#": "owl",
        "http://www.w3.org/ns/prov#": "prov",
        "http://www.w3.org/2000/01/rdf-schema#": "rdfs",
        "http://schema.org/": "schema",
        "http://purl.org/ontology/service#": "service",
        "https://register.ld.admin.ch/staatskalender/organization/": "staatskalender",
        "https://agriculture.ld.admin.ch/system-map/": "systemmap",
        "https://register.ld.admin.ch/termdat/": "termdat",
        "http://rdfs.org/ns/void#": "void",
        "http://www.w3.org/2004/02/skos/core#": "skos",
        "http://www.w3.org/2001/XMLSchema#": "xsd",
        "https://register.ld.admin.ch/zefix/company/": "zefix"
    },  

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
        references: "systemmap:references",
        develops: "systemmap:develops"
    },

    DASHED_PREDICATES: [
        "http://www.w3.org/ns/prov#wasDerivedFrom",
        "http://purl.org/ontology/service#consumes",
        "http://schema.org/memberOf",
        "https://agriculture.ld.admin.ch/system-map/owns",
        "https://agriculture.ld.admin.ch/system-map/usesMasterData",
        "https://agriculture.ld.admin.ch/system-map/access",
        "https://agriculture.ld.admin.ch/system-map/references",
        "https://agriculture.ld.admin.ch/system-map/develops"
    ],

    GROUP_MAP: {
        "http://schema.org/Organization": "Organization",
        "http://schema.org/SoftwareApplication": "System",
        "http://www.w3.org/ns/dcat#Dataset": "Information",
        "http://purl.org/ontology/service#Service": "Service"
    },

    initializeStylesFromCSS: function() {
        this.GROUP_IRI_MAP = Object.fromEntries(
            Object.entries(this.GROUP_MAP).map(([iri, group]) => [group, iri])
        );

        this.GROUP_STYLES = {
            System: {
                background: getCssVar('--color-group-system-bg'),
                border: getCssVar('--color-group-system-border'),
                font: { color: getCssVar('--color-group-system-font') }
            },
            Information: {
                background: getCssVar('--color-group-information-bg'),
                border: getCssVar('--color-group-information-border'),
                font: { color: getCssVar('--color-group-information-font') }
            },
            Organization: {
                background: getCssVar('--color-group-organization-bg'),
                border: getCssVar('--color-group-organization-border'),
                font: { color: getCssVar('--color-group-organization-font') }
            },
            Service: {
                background: getCssVar('--color-group-service-bg'),
                border: getCssVar('--color-group-service-border'),
                font: { color: getCssVar('--color-group-service-font') }
            },
            Other: {
                background: getCssVar('--color-group-other-bg'),
                border: getCssVar('--color-group-other-border'),
                font: { color: getCssVar('--color-group-other-font') }
            }
        };

        this.SEARCH_HIGHLIGHT_COLOR = {
            background: getCssVar('--color-highlight-bg'),
            border: getCssVar('--color-highlight-border'),
            font: { color: getCssVar('--color-highlight-font') }
        };
    }
};