// Helper for generating in-app links to a document or a topic.
//
// Use this everywhere instead of hardcoding `/dashboard/docs/<id>`. When
// the document carries a populated `prettyUrl`, the helper returns an
// `/r/...` URL so the address bar shows the meaningful slug; otherwise
// it falls back to the legacy id-based URL so unconfigured deployments
// keep working.
//
//   hrefForDoc(doc)           → '/r/foo/bar' or '/dashboard/docs/<id>'
//   hrefForDoc(doc, topicId)  → same, with `?topic=<id>` so the reader
//                                pre-selects that topic. We deliberately
//                                use a query param rather than appending
//                                to the path because the path slug is
//                                already a doc-level identifier and we
//                                don't want to imply the topic has its
//                                own pretty URL when it might not.

function hasId(doc) {
  return doc && (doc._id || doc.id);
}

function getId(doc) {
  return String(doc?._id || doc?.id || '');
}

export function hrefForDoc(doc, topicId = null) {
  if (!hasId(doc)) return '#';
  const tail = topicId ? `?topic=${encodeURIComponent(String(topicId))}` : '';
  if (doc.prettyUrl && typeof doc.prettyUrl === 'string' && doc.prettyUrl.trim()) {
    // Server already prepended a leading slash; double-slash protection
    // anyway in case the data ever drifts.
    const path = doc.prettyUrl.startsWith('/') ? doc.prettyUrl : '/' + doc.prettyUrl;
    return `/r${path}${tail}`;
  }
  return `/dashboard/docs/${getId(doc)}${tail}`;
}

// When a topic has its own pretty URL, link straight to it. The reader
// component still renders the same way; the only difference is what the
// address bar displays.
//
// If `parentDoc` is supplied (with `_id` and optional `prettyUrl`) the
// helper composes a doc-level pretty URL with `?topic=<id>` so even
// topic-less hits land on the right place. When neither pretty URL is
// available — e.g. search hits where we only got the topic + doc ids —
// we fall back to the legacy `/dashboard/docs/<docId>?topic=<topicId>`
// shape so navigation never breaks.
export function hrefForTopic(topic, parentDoc = null) {
  if (topic?.prettyUrl) {
    const path = topic.prettyUrl.startsWith('/') ? topic.prettyUrl : '/' + topic.prettyUrl;
    return `/r${path}`;
  }
  if (parentDoc) return hrefForDoc(parentDoc, topic?._id || topic?.id || topic?.topicId);

  const docId = topic?.documentId || topic?.docId;
  const tid = topic?._id || topic?.id || topic?.topicId;
  if (docId && tid) return `/dashboard/docs/${docId}?topic=${encodeURIComponent(tid)}`;
  if (docId) return `/dashboard/docs/${docId}`;
  return '#';
}

const helpers = { hrefForDoc, hrefForTopic };
export default helpers;
