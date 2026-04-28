// SKOS / RDF parser. Uses `rdf-parse` (chooses the right serialisation
// based on file extension or explicit content type) and `n3.Store` as the
// in-memory triple store so we can group quads by subject without writing
// our own indexer.
//
// We only care about the canonical SKOS shape:
//
//   <Concept>  rdf:type            skos:Concept
//   <Concept>  skos:prefLabel      "label"@lang
//   <Concept>  skos:altLabel       "synonym"@lang
//   <Concept>  skos:broader        <ParentConcept>
//
// One VocabularyTerm row is emitted per (Concept, language) pair so the
// synonymProjector cache can key on `(label, language)`. A Concept without
// a prefLabel is skipped with a warning so the admin can fix the source.
//
// Returns: { terms, languages, warnings } — same shape as csvParser.

const { Readable } = require('stream');
const { Store, DataFactory } = require('n3');

const SKOS = {
  prefLabel: 'http://www.w3.org/2004/02/skos/core#prefLabel',
  altLabel:  'http://www.w3.org/2004/02/skos/core#altLabel',
  broader:   'http://www.w3.org/2004/02/skos/core#broader',
  Concept:   'http://www.w3.org/2004/02/skos/core#Concept',
};
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

async function parseSkos(buffer, originalFilename) {
  const { rdfParser } = await loadRdfParser();
  const store = new Store();

  const inputStream = Readable.from(buffer);
  await new Promise((resolve, reject) => {
    rdfParser
      .parse(inputStream, {
        path: originalFilename || 'vocabulary.rdf',
        baseIRI: 'http://example.org/vocabulary/',
      })
      .on('data', (quad) => store.addQuad(quad))
      .on('error', (err) => reject(makeError(`SKOS parse error: ${err.message}`)))
      .on('end', resolve);
  });

  const conceptIris = collectConceptIris(store);
  if (conceptIris.size === 0) {
    throw makeError('No skos:Concept resources found in the file.');
  }

  const terms = [];
  const languages = new Set();
  const warnings = [];

  for (const iri of conceptIris) {
    const subject = DataFactory.namedNode(iri);

    // Group prefLabel + altLabel by language tag. A Concept can carry
    // multiple prefLabels, one per `xml:lang` — each becomes its own term
    // row sharing the same termId.
    const prefByLang = collectByLang(store.getQuads(subject, DataFactory.namedNode(SKOS.prefLabel), null, null));
    const altByLang  = collectByLang(store.getQuads(subject, DataFactory.namedNode(SKOS.altLabel), null, null));
    const broaderQuads = store.getQuads(subject, DataFactory.namedNode(SKOS.broader), null, null);
    const broaderTermId = broaderQuads.length > 0 ? termIdFromIri(broaderQuads[0].object.value) : '';

    if (Object.keys(prefByLang).length === 0) {
      warnings.push(`${iri}: no skos:prefLabel — concept skipped.`);
      continue;
    }

    const termId = termIdFromIri(iri);
    const allLangs = new Set([
      ...Object.keys(prefByLang),
      ...Object.keys(altByLang),
    ]);
    for (const lang of allLangs) {
      const pref = (prefByLang[lang] || [])[0];
      if (!pref) continue;
      const altLabels = altByLang[lang] || [];
      const language = lang || '*';
      languages.add(language);
      terms.push({
        termId,
        language,
        prefLabel: pref,
        altLabels,
        broader: broaderTermId,
      });
    }
  }

  return { terms, languages: Array.from(languages), warnings };
}

function collectConceptIris(store) {
  const iris = new Set();
  const conceptQuads = store.getQuads(null, DataFactory.namedNode(RDF_TYPE), DataFactory.namedNode(SKOS.Concept), null);
  for (const q of conceptQuads) {
    if (q.subject.termType === 'NamedNode') iris.add(q.subject.value);
  }
  // Many SKOS files don't bother typing concepts because `prefLabel` only
  // makes sense on Concepts. Fall back to "subjects with a prefLabel".
  const prefQuads = store.getQuads(null, DataFactory.namedNode(SKOS.prefLabel), null, null);
  for (const q of prefQuads) {
    if (q.subject.termType === 'NamedNode') iris.add(q.subject.value);
  }
  return iris;
}

function collectByLang(quads) {
  const byLang = {};
  for (const q of quads) {
    if (q.object.termType !== 'Literal') continue;
    const lang = (q.object.language || '').toLowerCase();
    const key = lang || '*';
    if (!byLang[key]) byLang[key] = [];
    byLang[key].push(q.object.value);
  }
  return byLang;
}

// Stable id from a Concept IRI: prefer the fragment (`#term`), else the
// last path segment. Lower-cased so different casings of the same IRI
// (rare in practice but possible across files) collapse to one termId.
function termIdFromIri(iri) {
  if (!iri) return '';
  const hashIdx = iri.lastIndexOf('#');
  if (hashIdx >= 0 && hashIdx < iri.length - 1) {
    return decodeURIComponent(iri.slice(hashIdx + 1));
  }
  const slashIdx = iri.lastIndexOf('/');
  if (slashIdx >= 0 && slashIdx < iri.length - 1) {
    return decodeURIComponent(iri.slice(slashIdx + 1));
  }
  return iri;
}

// rdf-parse exposes its API as an ESM-flavoured CJS module — `require()`
// works in current versions but the safer cross-version pattern is to
// `await` an `import()` so we are insulated from any future flip.
async function loadRdfParser() {
  // eslint-disable-next-line global-require
  const mod = require('rdf-parse');
  return mod;
}

function makeError(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = 'skos_parse_failed';
  return err;
}

module.exports = { parseSkos };
