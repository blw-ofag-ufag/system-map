[![Combine Datasets](https://github.com/blw-ofag-ufag/system-map/actions/workflows/graph-processing-and-deployment.yml/badge.svg)](https://github.com/blw-ofag-ufag/metadata/actions/workflows/combine-datasets.yml)
[![Combine Datasets](https://github.com/blw-ofag-ufag/system-map/actions/workflows/graph-validation.yml/badge.svg)](https://github.com/blw-ofag-ufag/metadata/actions/workflows/graph-validation.yml)
[![Python 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/downloads/)
[![GitHub last commit](https://img.shields.io/github/last-commit/blw-ofag-ufag/system-map.svg)](https://github.com/blw-ofag-ufag/system-map/commits)
[![GitHub issues](https://img.shields.io/github/issues/blw-ofag-ufag/system-map.svg)](https://github.com/blw-ofag-ufag/system-map/issues)

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

- [**`ontology.ttl`**](https://github.com/blw-ofag-ufag/system-map/blob/main/rdf/ontology.ttl) contains information about how the data is structured. You can visualize it [using WebVOWL](https://service.tib.eu/webvowl/#iri=https://raw.githubusercontent.com/blw-ofag-ufag/system-map/refs/heads/main/rdf/ontology.ttl).
- [**`data.ttl`**](https://github.com/blw-ofag-ufag/system-map/blob/main/rdf/data.ttl) contains information about the organizations, systems and information units themselves.

Actually, there is a python script *reasoning* over the two files. This is described in more detail below.

# 🔎 Subgraphs

Subgraphs of the system map allow inspecting one part of the overall system without being disturbed by the multitude of connected nodes around it. Have a look at the subgraphs for

- [MARS III](https://blw-ofag-ufag.github.io/system-map/index.html?lang=en&subgraph=SaAA0IQkj02jgbLEb)
- [digiFLUX](https://blw-ofag-ufag.github.io/system-map/index.html?lang=en&subgraph=Si8UnIQkj02jgbLEb)
- [Acontrol](https://blw-ofag-ufag.github.io/system-map/index.html?lang=en&subgraph=Sa9PcqsvnAMuiYCjx)
- [AGIS](https://blw-ofag-ufag.github.io/system-map/index.html?lang=en&subgraph=SAAAX37V802JgbLEb)

If you want a always up-to-date list of all subgraphs and their size, you can [query the system map accordingly](https://s.zazuko.com/221bFQW).

# ⚙️ Examples of SPARQL queries from LINDAS

The DigiAgriFoodCH System Map graph on LINDAS can be queried to return various tables as *data products* from one source. Here are some examples:

- [Is there (sensitive) personal data in a system?](https://s.zazuko.com/xTGEjj)
- [Label and comment length for all objects in any language](https://s.zazuko.com/3AANqKA)
- [Private sector system engagement](https://s.zazuko.com/4AqBRH)

You may find more examples [in this directory](sparql/queries/)

# 🔄 Run the data processing pipeline

To run the data processing and upload to LINDAS, follow these steps:

1. Add variables to `.env`

  ``` sh
  USER=lindas-foag
  PASSWORD=********
  GRAPH=https://lindas.admin.ch/foag/crops
  ENDPOINT=https://stardog.cluster.ldbar.ch/lindas
  ```

2. Start a virtual environment and install libraries:

  ``` sh
  python -m venv venv
  source venv/bin/activate  # On Windows use: venv\Scripts\activate
  pip install -r requirements.txt
  ```

3. Execute `upload.bash`

  ``` sh
  bash upload.bash
  ```

You can find the rest of the technical documentation [on the Wiki of this repository](https://github.com/blw-ofag-ufag/system-map/wiki). There, the ontology, the data processing pipeline and the visualization tool are explained in much more detail.
