'use strict';

const MetadataKey = require('../../models/MetadataKey');
const Topic = require('../../models/Topic');
const Document = require('../../models/Document');
const {
  VALUES_SAMPLE_CAP,
  reprojectTopicsForDocument,
} = require('./registryService');
const { extractPaligoDocbookFromXml } = require('./paligoMetadataExtractor');

const MAX_PAGES = 500;

const REQUIRED_PALIGO_METADATA_KEYS = [
  'audience',
  'author_personname',
  'authorgroup_author_personname',
  'category',
  'copyright',
  'Created_by',
  'creationDate',
  'data_origin_id',
  'data_time_modified',
  'ft:alertTimestamp',
  'ft:attachmentsSize',
  'ft:baseId',
  'ft:clusterId',
  'ft:container',
  'ft:contentSize',
  'ft:document_type',
  'ft:editorialType',
  'ft:filename',
  'ft:isArticle',
  'ft:isAttachment',
  'ft:isBook',
  'ft:isHtmlPackage',
  'ft:isPublication',
  'ft:isSynchronousAttachment',
  'ft:isUnstructured',
  'ft:khubVersion',
  'ft:lastEdition',
  'ft:lastPublication',
  'ft:lastTechChange',
  'ft:lastTechChangeTimestamp',
  'ft:locale',
  'ft:mimeType',
  'ft:openMode',
  'ft:originId',
  'ft:prettyUrl',
  'ft:publication_title',
  'ft:publicationId',
  'ft:publishStatus',
  'ft:publishUploadId',
  'ft:searchableFromInt',
  'ft:sourceCategory',
  'ft:sourceId',
  'ft:sourceName',
  'ft:sourceType',
  'ft:structure',
  'ft:title',
  'ft:tocPosition',
  'ft:topicTitle',
  'ft:wordCount',
  'generator',
  'Key',
  'lastmodifiedby',
  'Modified',
  'Module',
  'Name',
  'paligo:resourceTitle',
  'paligo:resourceTitleLabel',
  'publicationDate',
  'Release_Notes',
  'role',
  'subtitle',
  'Taxonomy',
  'title',
  'ud:id',
  'xinfo:branched_topic_id',
  'xinfo:branched_topic_uuid',
  'xinfo:contribution_editable',
  'xinfo:document_id',
  'xinfo:linktype',
  'xinfo:origin',
  'xinfo:origin_id',
  'xinfo:pagebreak',
  'xinfo:taxonomy',
  'xinfo:version_major',
  'xinfo:version_minor',
];

// These keys carry values a user might reasonably type in global search.
// We intentionally skip low-signal constants like ft:sourceId=paligo,
// ft:mimeType=text/html, booleans, and structural counters unless they help
// identify a specific topic/document.
const DEFAULT_SEARCHABLE_PALIGO_KEYS = new Set([
  'audience',
  'author_personname',
  'authorgroup_author_personname',
  'category',
  'copyright',
  'Created_by',
  'creationDate',
  'data_origin_id',
  'data_time_modified',
  'ft:baseId',
  'ft:clusterId',
  'ft:container',
  'ft:document_type',
  'ft:editorialType',
  'ft:filename',
  'ft:lastEdition',
  'ft:lastPublication',
  'ft:lastTechChange',
  'ft:lastTechChangeTimestamp',
  'ft:locale',
  'ft:originId',
  'ft:prettyUrl',
  'ft:publication_title',
  'ft:publicationId',
  'ft:publishStatus',
  'ft:publishUploadId',
  'ft:sourceCategory',
  'ft:title',
  'ft:topicTitle',
  'generator',
  'Key',
  'lastmodifiedby',
  'Modified',
  'Module',
  'Name',
  'paligo:resourceTitle',
  'paligo:resourceTitleLabel',
  'publicationDate',
  'Release_Notes',
  'role',
  'subtitle',
  'Taxonomy',
  'title',
  'ud:id',
  'xinfo:branched_topic_id',
  'xinfo:branched_topic_uuid',
  'xinfo:document_id',
  'xinfo:linktype',
  'xinfo:origin',
  'xinfo:origin_id',
  'xinfo:taxonomy',
  'xinfo:version_major',
  'xinfo:version_minor',
].map((key) => key.toLowerCase()));

function getPaligoConfig() {
  const instance = String(process.env.PALIGO_INSTANCE || '').trim();
  const explicitBase = String(process.env.PALIGO_BASE_URL || '').trim().replace(/\/+$/, '');
  const username = String(process.env.PALIGO_USERNAME || '').trim();
  const token = String(process.env.PALIGO_TOKEN || process.env.PALIGO_API_KEY || '').trim();

  const baseUrl = explicitBase
    ? (explicitBase.endsWith('/api/v2') ? explicitBase : `${explicitBase}/api/v2`)
    : (instance ? `https://${instance}.paligoapp.com/api/v2` : '');

  if (!baseUrl || !username || !token) {
    throw new Error('Paligo credentials are missing. Set PALIGO_BASE_URL or PALIGO_INSTANCE, plus PALIGO_USERNAME and PALIGO_TOKEN.');
  }

  return {
    baseUrl,
    authHeader: `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`,
  };
}

async function paligoGet(pathSuffix) {
  const { baseUrl, authHeader } = getPaligoConfig();
  const url = `${baseUrl}${pathSuffix}`;
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const detail = body?.error || body?.message || text.slice(0, 200) || res.statusText;
    throw new Error(`Paligo GET ${pathSuffix} failed (${res.status}): ${detail}`);
  }
  return body;
}

function listFromBody(body, key) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.[key])) return body[key];
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.children)) return body.children;
  return [];
}

async function listPaginated(pathname, query = {}, key) {
  const out = [];
  let page = Number(query.page) || 1;
  for (let guard = 0; guard < MAX_PAGES; guard += 1) {
    const pageQuery = { ...query, page };
    const qs = new URLSearchParams(Object.entries(pageQuery).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
    const body = await paligoGet(`${pathname}${qs ? `?${qs}` : ''}`);
    const items = listFromBody(body, key);
    out.push(...items);

    const totalPages = body?.pagination?.total_pages || body?.total_pages;
    const nextPage = body?.pagination?.next_page || body?.next_page;
    if (totalPages && page >= Number(totalPages)) break;
    if (!totalPages && !nextPage && items.length < 10) break;
    page += 1;
  }
  return out;
}

function ensureKey(aggregate, rawKey) {
  const displayName = String(rawKey || '').trim();
  if (!displayName) return null;
  const lower = displayName.toLowerCase();
  if (!aggregate.has(lower)) aggregate.set(lower, { displayName, values: new Set() });
  return aggregate.get(lower);
}

function ensureRequiredMetadataKeys(aggregate) {
  REQUIRED_PALIGO_METADATA_KEYS.forEach((key) => ensureKey(aggregate, key));
}

function addValue(aggregate, rawKey, rawValue, { allowReserved = false } = {}) {
  if (!rawKey || rawValue == null) return;
  const displayName = String(rawKey).trim();
  if (!displayName || (!allowReserved && MetadataKey.isReserved(displayName))) return;

  let value = rawValue;
  if (rawValue instanceof Date) value = rawValue.toISOString();
  if (typeof rawValue === 'object') value = JSON.stringify(rawValue);
  value = String(value).trim();
  if (!value) return;

  ensureKey(aggregate, displayName)?.values.add(value);
}

function addDateValue(aggregate, key, unixSeconds) {
  if (unixSeconds == null || unixSeconds === '') return;
  const n = Number(unixSeconds);
  if (!Number.isFinite(n)) return addValue(aggregate, key, unixSeconds);
  addValue(aggregate, key, new Date(n * 1000).toISOString());
}

function toIsoDate(unixSeconds) {
  if (unixSeconds == null || unixSeconds === '') return '';
  const n = Number(unixSeconds);
  if (!Number.isFinite(n)) return String(unixSeconds);
  return new Date(n * 1000).toISOString();
}

function collectDocumentMetadata(aggregate, doc, taxonomyById = new Map()) {
  if (!doc || typeof doc !== 'object') return;

  const name = doc.name || doc.title;
  const docId = doc.uuid || doc.id;
  const type = doc.type || doc.subtype || doc.item_type;
  const typeLower = String(type || '').toLowerCase();
  const modified = toIsoDate(doc.modified_at);

  addValue(aggregate, 'xinfo:document_id', doc.id);
  addValue(aggregate, 'ft:originId', docId);
  addValue(aggregate, 'data_origin_id', docId);
  addValue(aggregate, 'ud:id', docId);
  addValue(aggregate, 'Name', name);
  addValue(aggregate, 'title', name, { allowReserved: true });
  addValue(aggregate, 'ft:title', name);
  addValue(aggregate, 'ft:topicTitle', name);
  addValue(aggregate, 'paligo:resourceTitle', name);
  addValue(aggregate, 'ft:document_type', type);
  addValue(aggregate, 'ft:editorialType', type);
  addValue(aggregate, 'ft:filename', name);
  addValue(aggregate, 'ft:baseId', docId);
  addValue(aggregate, 'ft:clusterId', doc.parent_resource || docId);
  addValue(aggregate, 'ft:container', doc.parent_resource);
  addValue(aggregate, 'ft:isArticle', typeLower.includes('component') || typeLower.includes('topic') ? 'true' : 'false');
  addValue(aggregate, 'ft:isAttachment', 'false');
  addValue(aggregate, 'ft:isBook', typeLower.includes('book') ? 'true' : 'false');
  addValue(aggregate, 'ft:isHtmlPackage', 'false');
  addValue(aggregate, 'ft:isPublication', typeLower.includes('publication') ? 'true' : 'false');
  addValue(aggregate, 'ft:isSynchronousAttachment', 'false');
  addValue(aggregate, 'ft:isUnstructured', 'false');
  addValue(aggregate, 'ft:khubVersion', '1');
  addValue(aggregate, 'ft:lastEdition', modified);
  addValue(aggregate, 'ft:lastPublication', modified);
  addValue(aggregate, 'ft:lastTechChange', modified);
  addValue(aggregate, 'ft:mimeType', 'application/xml');
  addValue(aggregate, 'ft:openMode', 'internal');
  addValue(aggregate, 'ft:prettyUrl', name ? String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') : '');
  addValue(aggregate, 'ft:publishUploadId', doc.id);
  addValue(aggregate, 'ft:searchableFromInt', '0');
  addValue(aggregate, 'ft:sourceCategory', 'Paligo');
  addValue(aggregate, 'ft:sourceType', 'paligo');
  addValue(aggregate, 'ft:sourceName', 'Paligo');
  addValue(aggregate, 'ft:sourceId', 'paligo');
  addValue(aggregate, 'ft:structure', 'xml');
  addValue(aggregate, 'ft:publishStatus', doc.release_status || doc.status);
  addValue(aggregate, 'Created_by', doc.creator);
  addValue(aggregate, 'lastmodifiedby', doc.modified_by || doc.last_modified_by);
  addDateValue(aggregate, 'creationDate', doc.created_at);
  addDateValue(aggregate, 'Modified', doc.modified_at);
  addDateValue(aggregate, 'ft:lastTechChangeTimestamp', doc.modified_at);
  addValue(aggregate, 'parent_resource', doc.parent_resource);
  addValue(aggregate, 'xinfo:origin', docId);
  addValue(aggregate, 'xinfo:origin_id', docId);
  addValue(aggregate, 'xinfo:contribution_editable', 'false');
  addValue(aggregate, 'xinfo:pagebreak', 'false');

  if (Array.isArray(doc.languages)) {
    doc.languages.forEach((lang) => addValue(aggregate, 'ft:locale', lang));
  }

  if (typeof doc.content === 'string' && doc.content.trim()) {
    const xmlBag = extractPaligoDocbookFromXml(doc.content);
    Object.entries(xmlBag).forEach(([key, values]) => {
      (Array.isArray(values) ? values : [values]).forEach((value) => addValue(aggregate, key, value, { allowReserved: key === 'title' }));
    });
    addValue(aggregate, 'ft:contentSize', Buffer.byteLength(doc.content, 'utf8'));
    addValue(aggregate, 'ft:wordCount', doc.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length);
  }

  if (Array.isArray(doc.taxonomies)) {
    doc.taxonomies.forEach((tax) => {
      const title = tax?.title || tax?.name;
      if (!title) return;
      addValue(aggregate, 'Taxonomy', title);
      addValue(aggregate, 'xinfo:taxonomy', title);
      addValue(aggregate, 'category', title);

      const detail = taxonomyById.get(String(tax.id)) || tax;
      const parentId = detail?.parent || detail?.parent_id;
      const parent = parentId ? taxonomyById.get(String(parentId)) : null;
      const parentTitle = parent?.title || parent?.name;
      if (parentTitle) addValue(aggregate, parentTitle.replace(/\s+/g, '_'), title);
    });
  }

  if (Array.isArray(doc.custom_attributes)) {
    doc.custom_attributes.forEach((attr) => {
      const key = attr?.name || attr?.key || attr?.title;
      const val = attr?.value || attr?.values || attr?.content;
      if (Array.isArray(val)) val.forEach((v) => addValue(aggregate, key, v));
      else addValue(aggregate, key, val);
    });
  }
}

function aggregateToCustomObject(aggregate) {
  const out = {};
  for (const { displayName, values } of aggregate.values()) {
    const arr = Array.from(values || []).map((v) => String(v).trim()).filter(Boolean);
    if (arr.length) out[displayName] = arr;
  }
  return out;
}

function addCustomToAccumulator(acc, id, custom) {
  if (!id || !custom || Object.keys(custom).length === 0) return;
  const key = String(id);
  if (!acc.has(key)) acc.set(key, {});
  const slot = acc.get(key);
  for (const [rawKey, values] of Object.entries(custom)) {
    if (!rawKey) continue;
    if (!slot[rawKey]) slot[rawKey] = [];
    for (const value of Array.isArray(values) ? values : [values]) {
      const sv = value == null ? '' : String(value).trim();
      if (sv && !slot[rawKey].includes(sv)) slot[rawKey].push(sv);
    }
  }
}

function mergeCustomObjects(existing, incoming) {
  const out = {};
  const add = (rawKey, values) => {
    if (!rawKey) return;
    const key = String(rawKey);
    if (!out[key]) out[key] = [];
    for (const value of Array.isArray(values) ? values : [values]) {
      const sv = value == null ? '' : String(value).trim();
      if (sv && !out[key].includes(sv)) out[key].push(sv);
    }
  };

  if (existing instanceof Map) {
    for (const [key, values] of existing.entries()) add(key, values);
  } else if (existing && typeof existing === 'object') {
    for (const [key, values] of Object.entries(existing)) add(key, values);
  }
  for (const [key, values] of Object.entries(incoming || {})) add(key, values);
  return out;
}

function scalarCustomFields(custom) {
  const out = {};
  for (const [key, values] of Object.entries(custom || {})) {
    const first = Array.isArray(values) ? values.find((v) => v != null && String(v).trim()) : values;
    if (first != null && String(first).trim()) out[key] = String(first).trim();
  }
  return out;
}

function collectTaxonomyMetadata(aggregate, taxonomy) {
  if (!taxonomy || typeof taxonomy !== 'object') return;
  const title = taxonomy.title || taxonomy.name;
  addValue(aggregate, 'Taxonomy', title);
  addValue(aggregate, 'xinfo:taxonomy', title);
  addValue(aggregate, 'taxonomy:id', taxonomy.id);
  addValue(aggregate, 'taxonomy:parent', taxonomy.parent || taxonomy.parent_id);
  addValue(aggregate, 'category', title);
  if (title === 'audience') addValue(aggregate, 'audience', title);
  if (title === 'Module') addValue(aggregate, 'Module', title);
  if (/release\s*notes/i.test(String(title || ''))) addValue(aggregate, 'Release_Notes', title);
}

function collectVariableSetMetadata(aggregate, variableSet) {
  if (!variableSet || typeof variableSet !== 'object') return;
  const setName = variableSet.name || variableSet.title || variableSet.label || variableSet.id;
  addValue(aggregate, 'variableset', setName);
  addValue(aggregate, 'variableset:id', variableSet.id);

  const variables = variableSet.variables || variableSet.values || variableSet.items || [];
  if (Array.isArray(variables)) {
    variables.forEach((v) => {
      const key = v?.name || v?.key || v?.title;
      const val = v?.value || v?.content || v?.text;
      addValue(aggregate, key || 'variable', val || key);
    });
  }
}

async function collectTaxonomies(aggregate) {
  const taxonomies = await listPaginated('/taxonomies', {}, 'taxonomies');
  const byId = new Map();
  for (const tax of taxonomies) {
    if (tax?.id != null) byId.set(String(tax.id), tax);
    collectTaxonomyMetadata(aggregate, tax);
  }

  // Show endpoint sometimes contains parent/children information omitted from list.
  for (const tax of taxonomies.slice(0, 1000)) {
    if (tax?.id == null) continue;
    try {
      const detail = await paligoGet(`/taxonomies/${encodeURIComponent(tax.id)}`);
      const item = detail?.taxonomy || detail;
      if (item?.id != null) byId.set(String(item.id), item);
      collectTaxonomyMetadata(aggregate, item);
    } catch (_) {
      // Some Paligo tenants restrict show calls; list data is still useful.
    }
  }

  return byId;
}

async function collectDocuments(aggregate, taxonomyById, { folderIds = [], includeRootDocuments = true, includeDocumentDetails = true } = {}) {
  const documents = [];
  const detailedDocs = [];
  const seenDocs = new Set();
  const seenFolders = new Set();

  const addDocs = (items) => {
    for (const doc of items || []) {
      const key = doc?.uuid || doc?.id || doc?.resource_id;
      if (!key || seenDocs.has(String(key))) continue;
      seenDocs.add(String(key));
      documents.push(doc);
    }
  };

  if (includeRootDocuments) {
    addDocs(await listPaginated('/documents', {}, 'documents'));
  }

  const queue = Array.isArray(folderIds) ? folderIds.map(String).filter(Boolean) : [];
  while (queue.length) {
    const folderId = queue.shift();
    if (seenFolders.has(folderId)) continue;
    seenFolders.add(folderId);

    try {
      addDocs(await listPaginated('/documents', { parent: folderId }, 'documents'));
    } catch (_) {
      // Continue with /folders/:id fallback.
    }

    try {
      const folder = await paligoGet(`/folders/${encodeURIComponent(folderId)}`);
      const children = listFromBody(folder, 'children');
      children.forEach((child) => {
        const type = String(child?.type || child?.item_type || child?.resource_type || '').toLowerCase();
        if (type.includes('folder') && child?.id != null) queue.push(String(child.id));
        if (type.includes('document') || type.includes('topic') || type.includes('publication')) addDocs([child]);
      });
    } catch (_) {
      // Folder traversal is best effort; /documents?parent above covers most cases.
    }
  }

  let detailed = 0;
  for (const doc of documents) {
    let source = doc;
    if (includeDocumentDetails) {
      const id = doc.uuid || doc.id;
      if (id) {
        try {
          source = await paligoGet(`/documents/${encodeURIComponent(id)}`);
          detailed += 1;
        } catch (_) {
          source = doc;
        }
      }
    }
    collectDocumentMetadata(aggregate, source, taxonomyById);
    detailedDocs.push(source);
  }

  return { listed: documents.length, detailed, items: detailedDocs };
}

async function collectVariableSets(aggregate) {
  try {
    const variableSets = await listPaginated('/variablesets', {}, 'variablesets');
    variableSets.forEach((v) => collectVariableSetMetadata(aggregate, v));
    return variableSets.length;
  } catch (_) {
    return 0;
  }
}

async function projectPaligoDocumentsToCorpus(paligoDocs, taxonomyById) {
  const topicCustomById = new Map();
  const documentCustomById = new Map();
  const affectedDocumentIds = new Set();

  for (const paligoDoc of Array.isArray(paligoDocs) ? paligoDocs : []) {
    if (!paligoDoc || typeof paligoDoc !== 'object') continue;

    const perDoc = new Map();
    collectDocumentMetadata(perDoc, paligoDoc, taxonomyById);
    const custom = aggregateToCustomObject(perDoc);
    if (Object.keys(custom).length === 0) continue;

    const docId = paligoDoc.uuid || paligoDoc.id;
    const docType = String(paligoDoc.type || paligoDoc.subtype || paligoDoc.item_type || '').toLowerCase();
    const topicMatches = [];

    if (docId) {
      const rows = await Topic.find({
        $or: [
          { originId: String(docId) },
          { stableId: `paligo:${docId}` },
        ],
      }).select('_id documentId').lean();
      topicMatches.push(...rows);
    }

    for (const topic of topicMatches) {
      addCustomToAccumulator(topicCustomById, topic._id, custom);
      if (topic.documentId) affectedDocumentIds.add(String(topic.documentId));
    }

    if (docType.includes('publication')) {
      const documentQuery = {
        isPaligoFormat: true,
        $or: [
          ...(docId ? [{ 'publication.publicationId': new RegExp(escapeRegExp(String(docId)), 'i') }] : []),
          ...(paligoDoc.name ? [{ title: paligoDoc.name }] : []),
          ...(paligoDoc.title ? [{ title: paligoDoc.title }] : []),
        ],
      };
      if (documentQuery.$or.length) {
        const docs = await Document.find(documentQuery).select('_id metadata.customFields').lean();
        for (const doc of docs) {
          addCustomToAccumulator(documentCustomById, doc._id, custom);
          affectedDocumentIds.add(String(doc._id));
          const topics = await Topic.find({ documentId: doc._id }).select('_id documentId').lean();
          for (const topic of topics) addCustomToAccumulator(topicCustomById, topic._id, custom);
        }
      }
    }
  }

  let topicsUpdated = 0;
  for (const [topicId, custom] of topicCustomById.entries()) {
    const topic = await Topic.findById(topicId).select('metadata.custom metadata.customRaw documentId');
    if (!topic) continue;
    topic.metadata = topic.metadata || {};
    topic.metadata.custom = mergeCustomObjects(topic.metadata.custom, custom);
    topic.metadata.customRaw = mergeCustomObjects(topic.metadata.customRaw || topic.metadata.custom, custom);
    await topic.save();
    if (topic.documentId) affectedDocumentIds.add(String(topic.documentId));
    topicsUpdated += 1;
  }

  let documentsUpdated = 0;
  for (const [documentId, custom] of documentCustomById.entries()) {
    const doc = await Document.findById(documentId).select('metadata.customFields');
    if (!doc) continue;
    const existing = doc.metadata?.customFields instanceof Map
      ? Object.fromEntries(doc.metadata.customFields)
      : (doc.metadata?.customFields || {});
    doc.metadata = doc.metadata || {};
    doc.metadata.customFields = { ...existing, ...scalarCustomFields(custom) };
    await doc.save();
    affectedDocumentIds.add(String(doc._id));
    documentsUpdated += 1;
  }

  let reprojectedTopics = 0;
  let reprojectErrors = 0;
  for (const documentId of affectedDocumentIds) {
    const result = await reprojectTopicsForDocument(documentId);
    reprojectedTopics += result.processed || 0;
    reprojectErrors += result.errorCount || 0;
  }

  return {
    topicsMatched: topicCustomById.size,
    topicsUpdated,
    documentsUpdated,
    documentsReprojected: affectedDocumentIds.size,
    reprojectedTopics,
    reprojectErrors,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function upsertAggregate(aggregate, { indexForSearch = true } = {}) {
  if (!aggregate.size) return { keys: 0, values: 0 };

  const now = new Date();
  let values = 0;
  const ops = [];
  for (const [lower, { displayName, values: valueSet }] of aggregate.entries()) {
    const sample = Array.from(valueSet).slice(0, VALUES_SAMPLE_CAP);
    const shouldIndex = indexForSearch && valueSet.size > 0 && DEFAULT_SEARCHABLE_PALIGO_KEYS.has(lower);
    values += valueSet.size;
    ops.push({
      updateOne: {
        filter: { name: lower },
        update: {
          $setOnInsert: {
            name: lower,
            displayName,
            isDate: false,
            manual: false,
            createdAt: now,
          },
          $set: { lastSeenAt: now, ...(shouldIndex ? { isIndexed: true } : {}) },
          $addToSet: { valuesSample: { $each: sample } },
          $max: { valuesCount: valueSet.size },
        },
        upsert: true,
      },
    });
  }

  await MetadataKey.bulkWrite(ops, { ordered: false });
  await MetadataKey.updateMany(
    { name: { $in: Array.from(aggregate.keys()) } },
    [{ $set: { valuesSample: { $slice: ['$valuesSample', VALUES_SAMPLE_CAP] } } }]
  );
  return { keys: aggregate.size, values };
}

async function syncPaligoMetadataRegistry(options = {}) {
  const aggregate = new Map();
  ensureRequiredMetadataKeys(aggregate);
  const taxonomyById = await collectTaxonomies(aggregate);
  const documents = await collectDocuments(aggregate, taxonomyById, options);
  const variableSets = await collectVariableSets(aggregate);
  const upserted = await upsertAggregate(aggregate, {
    indexForSearch: options.indexForSearch !== false,
  });
  const projection = options.projectToCorpus === false
    ? null
    : await projectPaligoDocumentsToCorpus(documents.items, taxonomyById);

  return {
    ...upserted,
    documents: {
      listed: documents.listed,
      detailed: documents.detailed,
    },
    taxonomies: taxonomyById.size,
    variableSets,
    projection,
  };
}

module.exports = {
  syncPaligoMetadataRegistry,
  collectDocumentMetadata,
};
