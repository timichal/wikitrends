// backend
// get json with fetch api
const request = (url, params = {}) => {
  const paramArray = Object.entries(params)
    .map(param => `${param[0]}=${encodeURIComponent(param[1])}`);
  const compiledURL = `${url}?${paramArray.join("&")}`;
  return fetch(compiledURL)
    .then(response => response.json());
};

// returns most visited pages in a given month
const fetchTopPages = async (lang, date, number) => request(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${lang}.wikipedia/all-access/${date.replace("-", "/")}/all-days`)
  .then(data => data.items[0].articles
    .slice(0, number)
    .reduce((obj, item) => Object.assign(obj, {
      [`https://${lang}.wikipedia.org/wiki/${encodeURI(item.article)}`]: item.views,
    }), {}));

// matches wikipedia pages and wikidata entities
const matchPagesToEntities = (pages) => {
  const query = `PREFIX : <http://schema.org/>

  SELECT ?page ?wikidata
  WHERE {
      VALUES ?page {
          ${Object.keys(pages).map(el => `<${el}>`).join("\n")}
      }
      ?page :about ?wikidata .
  }`;

  return request("https://query.wikidata.org/sparql", { query, format: "json" })
    .then(data => data.results.bindings
      .filter(entity => Object.keys(pages).includes(entity.page.value))
      .map(entity => [entity.wikidata.value, pages[entity.page.value]]));
};

// generates a query for relations between items
const generateGraphQuery = (lang, items) => {
  const entities = items
    .map(entity => `(<${entity[0]}> ${entity[1]})`)
    .join("\n");
  const query = `PREFIX bd: <http://www.bigdata.com/rdf#>
  PREFIX wikibase: <http://wikiba.se/ontology#>

  #defaultView:Graph
  SELECT ?a ?aLabel ?aViews ?b ?bLabel ?bViews
  WHERE {
      VALUES (?a ?aViews) {
          ${entities}
      }
      VALUES (?b ?bViews) {
          ${entities}
      }
      ?a ?p ?b .
      FILTER (!sameTerm(?a, ?b))
      SERVICE wikibase:label {
          bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${lang}" .
      }
  }`;
  return `https://query.wikidata.org/embed.html#${encodeURIComponent(query)}`;
};

const lang = window.location.href.split(/[?&]lang=(\w+)&?/g)[1] || "cs";
const date = window.location.href.split(/[?&]date=([\w-]+)&?/g)[1] || "2019-06";
const number = 50;

const getIframeURL = async () => {
  const pages = await fetchTopPages(lang, date, number);
  const entities = await matchPagesToEntities(pages);
  return generateGraphQuery(lang, entities);
};

// frontend
const displayGraph = async () => {
  const iframe = document.createElement("iframe");
  iframe.src = await getIframeURL();
  const graph = document.querySelector("#graph");
  graph.innerHTML = "";
  graph.append(iframe);
};

displayGraph();
