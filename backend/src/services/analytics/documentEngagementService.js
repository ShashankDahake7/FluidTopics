'use strict';

/**
 * Document engagement — per-document interaction breakdown within retention window.
 * Maps UI filter keys to DB sources (best effort where telemetry is incomplete).
 */

const Analytics = require('../../models/Analytics');
const Document = require('../../models/Document');
const UnstructuredDocument = require('../../models/UnstructuredDocument');
const Topic = require('../../models/Topic');
const Bookmark = require('../../models/Bookmark');
const Rating = require('../../models/Rating');
const Feedback = require('../../models/Feedback');

const INTERACTION_KEYS = [
  'doc-views',
  'link-shares',
  'bookmark-creations',
  'doc-downloads',
  'doc-prints',
  'feedback',
  'doc-ratings',
  'topic-ratings',
  'searches-in-doc',
];

function toIdMap(aggResult) {
  const m = {};
  for (const row of aggResult) {
    if (row._id) m[String(row._id)] = row.count;
  }
  return m;
}

function metaEntries(meta) {
  const metaObj = {};
  if (meta?.customFields) {
    const cf = meta.customFields;
    if (cf instanceof Map) {
      for (const [k, v] of cf.entries()) metaObj[k] = v;
    } else if (typeof cf === 'object' && cf) {
      Object.assign(metaObj, cf);
    }
  }
  if (meta?.tags?.length) metaObj.tags = meta.tags.join(', ');
  if (meta?.product) metaObj.product = meta.product;
  return Object.entries(metaObj).map(([key, v]) => ({
    key,
    label: key,
    values: [String(v ?? '')],
  }));
}

function lastEditionMs(doc) {
  const cf = doc.metadata?.customFields;
  let raw = null;
  if (cf instanceof Map) raw = cf.get('ft:lastEdition');
  else if (cf && typeof cf === 'object') raw = cf['ft:lastEdition'];
  if (raw) {
    const t = new Date(raw).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return new Date(doc.updatedAt || doc.createdAt).getTime();
}

async function getDocumentEngagement({ retentionDays = 730 } = {}) {
  const ms = retentionDays * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - ms);
  const until = new Date();
  const topicColl = Topic.collection.name;

  const [
    viewsByDocId,
    viewsByTopicOnly,
    bookmarksByDoc,
    feedbackByDoc,
    topicRatingsByDoc,
    docRatingsStructured,
    docRatingsUnstructured,
    downloadsByDoc,
    sharesByDoc,
    sharesByUnstructured,
    printsByDoc,
    printsByUnstructured,
    inDocSearchesByDoc,
  ] = await Promise.all([
    Analytics.aggregate([
      {
        $match: {
          eventType: 'view',
          timestamp: { $gte: since },
          'data.documentId': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$data.documentId', count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          eventType: 'view',
          timestamp: { $gte: since },
          'data.topicId': { $exists: true, $ne: null },
          $or: [{ 'data.documentId': null }, { 'data.documentId': { $exists: false } }],
        },
      },
      {
        $lookup: {
          from: topicColl,
          localField: 'data.topicId',
          foreignField: '_id',
          as: 'topic',
        },
      },
      { $unwind: '$topic' },
      { $match: { 'topic.documentId': { $exists: true, $ne: null } } },
      { $group: { _id: '$topic.documentId', count: { $sum: 1 } } },
    ]),
    Bookmark.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $lookup: {
          from: topicColl,
          localField: 'topicId',
          foreignField: '_id',
          as: 'topic',
        },
      },
      { $unwind: '$topic' },
      { $match: { 'topic.documentId': { $exists: true, $ne: null } } },
      { $group: { _id: '$topic.documentId', count: { $sum: 1 } } },
    ]),
    Feedback.aggregate([
      { $match: { topicId: { $ne: null }, createdAt: { $gte: since } } },
      {
        $lookup: {
          from: topicColl,
          localField: 'topicId',
          foreignField: '_id',
          as: 'topic',
        },
      },
      { $unwind: '$topic' },
      { $match: { 'topic.documentId': { $exists: true, $ne: null } } },
      { $group: { _id: '$topic.documentId', count: { $sum: 1 } } },
    ]),
    Rating.aggregate([
      { $match: { topicId: { $ne: null }, createdAt: { $gte: since } } },
      {
        $lookup: {
          from: topicColl,
          localField: 'topicId',
          foreignField: '_id',
          as: 'topic',
        },
      },
      { $unwind: '$topic' },
      { $match: { 'topic.documentId': { $exists: true, $ne: null } } },
      { $group: { _id: '$topic.documentId', count: { $sum: 1 } } },
    ]),
    Rating.aggregate([
      {
        $match: {
          documentId: { $ne: null },
          createdAt: { $gte: since },
          $and: [
            { $or: [{ topicId: null }, { topicId: { $exists: false } }] },
            { $or: [{ unstructuredId: null }, { unstructuredId: { $exists: false } }] },
          ],
        },
      },
      { $group: { _id: '$documentId', count: { $sum: 1 } } },
    ]),
    Rating.aggregate([
      {
        $match: {
          unstructuredId: { $ne: null },
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: '$unstructuredId', count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          eventType: 'download',
          timestamp: { $gte: since },
          'data.documentId': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$data.documentId', count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          eventType: 'share',
          timestamp: { $gte: since },
          'data.documentId': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$data.documentId', count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          eventType: 'share',
          timestamp: { $gte: since },
          'data.unstructuredId': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$data.unstructuredId', count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          eventType: 'print',
          timestamp: { $gte: since },
          'data.documentId': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$data.documentId', count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          eventType: 'print',
          timestamp: { $gte: since },
          'data.unstructuredId': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$data.unstructuredId', count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          eventType: 'search',
          timestamp: { $gte: since },
          'data.inDocument': true,
          'data.documentId': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$data.documentId', count: { $sum: 1 } } },
    ]),
  ]);

  const v1 = toIdMap(viewsByDocId);
  const v2 = toIdMap(viewsByTopicOnly);
  const bm = toIdMap(bookmarksByDoc);
  const fb = toIdMap(feedbackByDoc);
  const tr = toIdMap(topicRatingsByDoc);
  const drS = toIdMap(docRatingsStructured);
  const drU = toIdMap(docRatingsUnstructured);
  const dl = toIdMap(downloadsByDoc);
  const shS = toIdMap(sharesByDoc);
  const shU = toIdMap(sharesByUnstructured);
  const prS = toIdMap(printsByDoc);
  const prU = toIdMap(printsByUnstructured);
  const sd = toIdMap(inDocSearchesByDoc);

  const docs = await Document.find({ status: 'completed' })
    .select('title viewCount metadata updatedAt createdAt prettyUrl originalFilename')
    .lean();
  const unstruct = await UnstructuredDocument.find({})
    .select('title viewCount metadata updatedAt createdAt filename')
    .lean();

  const results = [];

  for (const d of docs) {
    const id = String(d._id);
    const analyticsViews = (v1[id] || 0) + (v2[id] || 0);
    const breakdown = {
      'doc-views': analyticsViews > 0 ? analyticsViews : d.viewCount || 0,
      'link-shares': shS[id] || 0,
      'bookmark-creations': bm[id] || 0,
      'doc-downloads': dl[id] || 0,
      'doc-prints': prS[id] || 0,
      feedback: fb[id] || 0,
      'doc-ratings': drS[id] || 0,
      'topic-ratings': tr[id] || 0,
      'searches-in-doc': sd[id] || 0,
    };

    results.push({
      id,
      title: d.title || d.originalFilename || 'Untitled',
      kind: 'STRUCTURED_DOCUMENT',
      lastUpdateMs: lastEditionMs(d),
      link: `/dashboard/docs/${id}`,
      prettyUrl: d.prettyUrl || '',
      metadata: metaEntries(d.metadata || {}),
      breakdown,
    });
  }

  for (const u of unstruct) {
    const id = String(u._id);
    const breakdown = {
      'doc-views': u.viewCount || 0,
      'link-shares': shU[id] || 0,
      'bookmark-creations': 0,
      'doc-downloads': 0,
      'doc-prints': prU[id] || 0,
      feedback: 0,
      'doc-ratings': drU[id] || 0,
      'topic-ratings': 0,
      'searches-in-doc': 0,
    };
    results.push({
      id,
      title: u.title || u.filename || 'Untitled',
      kind: 'UNSTRUCTURED_DOCUMENT',
      lastUpdateMs: new Date(u.updatedAt || u.createdAt).getTime(),
      link: `/dashboard/file/${id}`,
      prettyUrl: '',
      metadata: metaEntries(u.metadata || {}),
      breakdown,
    });
  }

  results.sort((a, b) => b.lastUpdateMs - a.lastUpdateMs);

  return {
    retentionDays,
    since: since.toISOString(),
    until: until.toISOString(),
    interactionKeys: INTERACTION_KEYS,
    documents: results,
  };
}

module.exports = { getDocumentEngagement, INTERACTION_KEYS };
