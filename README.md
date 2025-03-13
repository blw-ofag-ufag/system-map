# 🧭 A system map for the Federal Office for Agriculture

This repository is set up to gather and visualize information about IT systems, the data those contain and their operating organizations in the Swiss agri-food sector. You can visually explore this work on the following pages:

- [**DigiAgriFood system map**](https://blw-ofag-ufag.github.io/system-map/index.html?lang=de), a visualization of the system map knowledge graph that specifically shows the classes organization, system and information unit.
- [**Circular system map**](https://blw-ofag-ufag.github.io/system-map/circle), an alternative visualization in circular arrangement.
- [**Table on a federal demo site**](https://blw-ofag-ufag.github.io/system-map/table/) that shows (a) how quickly we can query LINDAS data and perform some computation and (b) how this information can be displayed on a (federal) webpage.
- [**Ontology visualization**](https://service.tib.eu/webvowl/#iri=https://raw.githubusercontent.com/blw-ofag-ufag/system-map/refs/heads/main/rdf/ontology.ttl) made with WebVOWL, allowing to get a quick grasp of the ontology underlying the system map.

If instead you are interested in the *actual* data, you can have a look at the following files:

- [**`ontology.ttl`**](https://github.com/blw-ofag-ufag/system-map/blob/main/rdf/ontology.ttl) contains information about how the data is structured.
- [**`data.ttl`**](https://github.com/blw-ofag-ufag/system-map/blob/main/rdf/data.ttl) contains information about the organizations, systems and information units themselves.

Actually, there is a python script *reasoning* over the two files. This is described in more detail below.

# ⚙️ Setting query parameters in the system map visualization

In the [DigiAgriFood system map](https://blw-ofag-ufag.github.io/system-map/index.html), we can set URL parameters to change the language or the underlying LINDAS SPARQL query. For example, you might want to visualize only IT systems and the data flow for the Swiss agri-food sector, without any organizational information, but in French. You can do that with:

[`https://blw-ofag-ufag.github.io/system-map/index.html?lang=fr&organization=false`](https://blw-ofag-ufag.github.io/system-map/index.html?lang=fr&organization=false)

Here's a table of the possible URL parameters, descriptions and their default values.

| Parameter     | Possible values | Default | Description |
|--------------|--------|---------|-------------|
| `lang`       | `de`, `fr`, `it`, `en` | `de`    | Defines the language for labels and descriptions. Currently, the graph contains *some* langstrings in German, French, Italian and English. If the node or edge label is not found in said language, a question mark is shown instead. |
| `organization` | `true`, `false` | `true` | Determines whether organizations (`schema:Organization`) should be displayed. |
| `system`     | `true`, `false` | `true` | Determines whether IT systems (`schema:SoftwareApplication`) should be displayed. |
| `information` | `true`, `false` | `true` | Determines whether information units (`systemmap:Information`) should be displayed. |

# 🔎 Examples of SPARQL queries from LINDAS

The DigiAgriFoodCH System Map graph on LINDAS can be queried to return various tables as *data products* from one source. Here are some examples:

- [Is there (sensitive) personal data in a system?](https://s.zazuko.com/2xyqSxz)
- [Table of Cantons, their agricultural IT-Systems and the respective operating agency (if given)](https://s.zazuko.com/2vz9Y8X)
- [Table of federal offices, suborganizations and information they have access to](https://s.zazuko.com/2Upq8Qj)
- [Label and comment length for all objects](https://s.zazuko.com/2aYzkVt)

# 📚 Further documentation

For a more detailed and technical documentation of the DigiAgriFoodCH System Map, we refer to our dedicated [GitHub wiki page](https://github.com/blw-ofag-ufag/system-map/wiki). There, you can learn about the repository structure, the thoughts behind the ontology, how the data is structured and how it is processed before being pushed to LINDAS.
