[![Combine Datasets](https://github.com/blw-ofag-ufag/system-map/actions/workflows/graph-processing-and-deployment.yml/badge.svg)](https://github.com/blw-ofag-ufag/metadata/actions/workflows/combine-datasets.yml)
[![Combine Datasets](https://github.com/blw-ofag-ufag/system-map/actions/workflows/graph-validation.yml/badge.svg)](https://github.com/blw-ofag-ufag/metadata/actions/workflows/graph-validation.yml)
[![Python 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/downloads/)
[![GitHub last commit](https://img.shields.io/github/last-commit/blw-ofag-ufag/metadata.svg)](https://github.com/blw-ofag-ufag/metadata/commits)
[![GitHub issues](https://img.shields.io/github/issues/blw-ofag-ufag/metadata.svg)](https://github.com/blw-ofag-ufag/metadata/issues)

<kbd>
  <a href="https://blw-ofag-ufag.github.io/system-map/index.html" target="_blank"><img src="https://github.com/user-attachments/assets/87d303c3-ed30-42af-888d-aa8abc307da7" /></a>
</kbd>

# 🧭 A system map for the Federal Office for Agriculture

This repository is set up to gather and visualize information about IT systems, the data those contain and their operating organizations in the Swiss agri-food sector.
You can visually explore this work on the following pages:

- [**DigiAgriFood system map**](https://blw-ofag-ufag.github.io/system-map/index.html?lang=de), a visualization of the system map knowledge graph that specifically shows the classes organization, system and information unit.
- [**Circular system map**](https://blw-ofag-ufag.github.io/system-map/varia/circle), an alternative visualization in circular arrangement.
- [**Table on a federal demo site**](https://blw-ofag-ufag.github.io/system-map/varia/table/) that shows (a) how quickly we can query LINDAS data and perform some computation and (b) how this information can be displayed on a (federal) webpage.
- [**Standalone search site**](https://blw-ofag-ufag.github.io/system-map/varia/search) to help you find an entity in case you're lost.
- [**Nanoid generator**](https://blw-ofag-ufag.github.io/system-map/varia/nanoid) just for internal use.

If instead you are interested in the *actual* data, you can have a look at the following files:

- [**`ontology.ttl`**](https://github.com/blw-ofag-ufag/system-map/blob/main/rdf/ontology.ttl) contains information about how the data is structured.
- [**`data.ttl`**](https://github.com/blw-ofag-ufag/system-map/blob/main/rdf/data.ttl) contains information about the organizations, systems and information units themselves.

Actually, there is a python script *reasoning* over the two files. This is described in more detail below.

# ⚙️ Setting query parameters in the system map visualization

The visualisation is driven entirely from its own URL.
Add or change the parameters below to filter what you see or to switch language.

| Parameter          | Values & Format                                                                      | Default           | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`lang`**         | `de`, `fr`, `it`, `en`                                                               | `de`              | Pick the UI language for labels and comments. If the chosen language is missing, the app falls back to **en → de → fr → it** and shows the fall-back text in *italic*.                                                                                                                                                                                                                                                                             |
| **`organization`** | `true` \| `false`                                                                    | `true`            | Show or hide **organisations** (`schema:Organization`).                                                                                                                                                                                                                                                                                                                                                                                            |
| **`system`**       | `true` \| `false`                                                                    | `true`            | Show or hide **IT systems** (`schema:SoftwareApplication`).                                                                                                                                                                                                                                                                                                                                                                                        |
| **`information`**  | `true` \| `false`                                                                    | `true`            | Show or hide **information units** (`dcat:Dataset`).                                                                                                                                                                                                                                                                                                                                                                                               |
| **`predicates`**   | *semicolon-, comma- or plus-separated* list of keys<br>`isPartOf;parentOrg;provides` | *(empty)* = *all* | Limit the **edge types** that are fetched from LINDAS. Keys map to properties as follows:<br>`isPartOf` → `dcterms:isPartOf`<br>`wasDerivedFrom` → `prov:wasDerivedFrom`<br>`parentOrg` → `schema:parentOrganization`<br>`operates` → `systemmap:operates`<br>`owns` → `systemmap:owns`<br>`contains` → `systemmap:contains`<br>`usesMasterData` → `systemmap:usesMasterData`<br>`memberOf` → `schema:memberOf`<br>`provides` → `service:provides` |
| **`infopanel`**    | `true` \| `false`                                                                    | `true`            | Show or hide the info-panel (top-right).                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`legend`**       | `true` \| `false`                                                                    | `true`            | Show or hide the legend (bottom-left).                                                                                                                                                                                                                                                                                                                                                                                                             |

*Only systems and their data flows, French UI:*

```
…/index.html?lang=fr&organization=false
```

*Everything in German, but show **only** “is part of”, “parent organisation” and “provides” edges:*

```
…/index.html?lang=de&predicates=isPartOf;parentOrg;provides
```

If the `predicates` parameter is omitted (or all keys are invalid) the
visualisation falls back to **all** edge types listed above.

# 🔎 Examples of SPARQL queries from LINDAS

The DigiAgriFoodCH System Map graph on LINDAS can be queried to return various tables as *data products* from one source. Here are some examples:

- [Is there (sensitive) personal data in a system?](https://s.zazuko.com/2xyqSxz)
- [Table of Cantons, their agricultural IT-Systems and the respective operating agency (if given)](https://s.zazuko.com/2vz9Y8X)
- [Table of federal offices, suborganizations and information they have access to](https://s.zazuko.com/2Upq8Qj)
- [Label and comment length for all objects](https://s.zazuko.com/2aYzkVt)
- [Get the name and address of all the companies](https://s.zazuko.com/3jQpKD3)
- [Count the number of datasets in each system, considering it may have subsystems and subdatasets.](https://s.zazuko.com/2rW3HSS) Query written as a one-liner property path.

# 📚 Further documentation

For a more detailed and technical documentation of the DigiAgriFoodCH System Map, we refer to our dedicated [GitHub wiki page](https://github.com/blw-ofag-ufag/system-map/wiki). There, you can learn about the repository structure, the thoughts behind the ontology, how the data is structured and how it is processed before being pushed to LINDAS.
