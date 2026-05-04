'use strict';

/**
 * Session list — aggregate Analytics by session.
 * - Non-empty `sessionId`: events share a browser/API id, but a new row still starts after
 *   SESSION_INACTIVITY_MS with no events (same rule as typical web analytics “session timeout”).
 * - Empty `sessionId`: synthetic sessions by actor (user or IP) and the same inactivity gap.
 * Metrics match Traffic → Events semantics for views; searches split global vs in-document.
 */

const Analytics = require('../../models/Analytics');
const { SESSION_INACTIVITY_MS } = require('./sessionConstants');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SORT_MAP = {
  date: 'sessionStart',
  duration: 'durationMs',
  userId: 'userId',
  uniqueQueries: 'uniqueQueries',
  uniqueQueriesNoResults: 'uniqueQueriesNoResults',
  docSearches: 'docSearches',
  docSearchesNoResults: 'docSearchesNoResults',
  documentViews: 'documentViews',
  topicViews: 'topicViews',
};

const GROUP_BLOCK = {
  sessionStart: { $first: '$timestamp' },
  sessionEnd: { $last: '$timestamp' },
  userId: { $first: '$userId' },
  queriesGlobal: {
    $addToSet: {
      $cond: [
        {
          $and: [
            { $eq: ['$eventType', 'search'] },
            { $ne: ['$data.inDocument', true] },
            { $ne: [{ $ifNull: ['$data.query', ''] }, ''] },
          ],
        },
        '$data.query',
        '$$REMOVE',
      ],
    },
  },
  queriesNoRes: {
    $addToSet: {
      $cond: [
        {
          $and: [
            { $eq: ['$eventType', 'search'] },
            { $ne: ['$data.inDocument', true] },
            { $eq: [{ $ifNull: ['$data.resultCount', -1] }, 0] },
            { $ne: [{ $ifNull: ['$data.query', ''] }, ''] },
          ],
        },
        '$data.query',
        '$$REMOVE',
      ],
    },
  },
  docSearches: {
    $sum: {
      $cond: [
        {
          $and: [{ $eq: ['$eventType', 'search'] }, { $eq: ['$data.inDocument', true] }],
        },
        1,
        0,
      ],
    },
  },
  docSearchesNoResults: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ['$eventType', 'search'] },
            { $eq: ['$data.inDocument', true] },
            { $eq: [{ $ifNull: ['$data.resultCount', -1] }, 0] },
          ],
        },
        1,
        0,
      ],
    },
  },
  documentViews: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ['$eventType', 'view'] },
            {
              $or: [
                {
                  $and: [
                    { $ne: [{ $ifNull: ['$data.documentId', null] }, null] },
                    { $eq: [{ $ifNull: ['$data.topicId', null] }, null] },
                  ],
                },
                { $ne: [{ $ifNull: ['$data.unstructuredId', null] }, null] },
              ],
            },
          ],
        },
        1,
        0,
      ],
    },
  },
  topicViews: {
    $sum: {
      $cond: [
        {
          $and: [{ $eq: ['$eventType', 'view'] }, { $ne: [{ $ifNull: ['$data.topicId', null] }, null] }],
        },
        1,
        0,
      ],
    },
  },
};

const PROJECT_AFTER_GROUP = {
  $project: {
    sessionKey: { $toString: '$_id' },
    sessionStart: 1,
    sessionEnd: 1,
    userId: 1,
    durationMs: { $subtract: ['$sessionEnd', '$sessionStart'] },
    uniqueQueries: { $size: { $ifNull: ['$queriesGlobal', []] } },
    uniqueQueriesNoResults: { $size: { $ifNull: ['$queriesNoRes', []] } },
    docSearches: 1,
    docSearchesNoResults: 1,
    documentViews: 1,
    topicViews: 1,
  },
};

async function getSessionList(body = {}) {
  const {
    startDate,
    endDate,
    page = 1,
    perPage = 50,
    sortBy = 'date',
    sortDir = 'desc',
    authStatus = 'all',
    interfaceLanguage = 'all',
    userIdContains = '',
  } = body;

  if (!startDate || !endDate) {
    const err = new Error('startDate and endDate are required');
    err.status = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    const err = new Error('Invalid date range');
    err.status = 400;
    throw err;
  }

  const sortField = SORT_MAP[sortBy] || 'sessionStart';
  const dir = sortDir === 'asc' ? 1 : -1;
  const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * Math.min(200, Math.max(1, parseInt(perPage, 10) || 50));
  const limit = Math.min(200, Math.max(1, parseInt(perPage, 10) || 50));

  const match = {
    timestamp: { $gte: start, $lte: end },
  };

  if (interfaceLanguage && interfaceLanguage !== 'all') {
    match.$or = [
      { 'data.filters.language': interfaceLanguage },
      { 'data.filters.lang': interfaceLanguage },
      { 'data.filters.locale': interfaceLanguage },
    ];
  }

  const sidLenExpr = { $strLenCP: { $toString: { $ifNull: ['$sessionId', ''] } } };
  const hasSidExpr = { $gt: [sidLenExpr, 0] };
  const noSidExpr = { $eq: [sidLenExpr, 0] };

  const pipeline = [
    { $match: match },
    {
      $facet: {
        withSessionId: [
          { $match: { $expr: hasSidExpr } },
          { $sort: { sessionId: 1, timestamp: 1 } },
          {
            $setWindowFields: {
              partitionBy: '$sessionId',
              sortBy: { timestamp: 1 },
              output: {
                prevTs: {
                  $shift: {
                    output: '$timestamp',
                    by: 1,
                    default: null,
                  },
                },
              },
            },
          },
          {
            $addFields: {
              isSessionBreak: {
                $or: [
                  { $eq: ['$prevTs', null] },
                  {
                    $gt: [{ $subtract: ['$timestamp', '$prevTs'] }, SESSION_INACTIVITY_MS],
                  },
                ],
              },
            },
          },
          {
            $setWindowFields: {
              partitionBy: '$sessionId',
              sortBy: { timestamp: 1 },
              output: {
                sessionOrd: {
                  $sum: { $cond: ['$isSessionBreak', 1, 0] },
                  window: {
                    documents: ['unbounded', 'current'],
                  },
                },
              },
            },
          },
          {
            $addFields: {
              sessionKey: {
                $concat: ['$sessionId', '::seg::', { $toString: '$sessionOrd' }],
              },
            },
          },
          { $sort: { sessionKey: 1, timestamp: 1 } },
          {
            $group: {
              _id: '$sessionKey',
              ...GROUP_BLOCK,
            },
          },
          PROJECT_AFTER_GROUP,
        ],
        withoutSessionId: [
          { $match: { $expr: noSidExpr } },
          {
            $addFields: {
              actorKey: {
                $cond: [
                  { $ne: ['$userId', null] },
                  { $concat: ['uid:', { $toString: '$userId' }] },
                  { $concat: ['ip:', { $ifNull: ['$ip', 'none'] }] },
                ],
              },
            },
          },
          { $sort: { actorKey: 1, timestamp: 1 } },
          {
            $setWindowFields: {
              partitionBy: '$actorKey',
              sortBy: { timestamp: 1 },
              output: {
                prevTs: {
                  $shift: {
                    output: '$timestamp',
                    by: 1,
                    default: null,
                  },
                },
              },
            },
          },
          {
            $addFields: {
              isSessionBreak: {
                $or: [
                  { $eq: ['$prevTs', null] },
                  {
                    $gt: [{ $subtract: ['$timestamp', '$prevTs'] }, SESSION_INACTIVITY_MS],
                  },
                ],
              },
            },
          },
          {
            $setWindowFields: {
              partitionBy: '$actorKey',
              sortBy: { timestamp: 1 },
              output: {
                sessionOrd: {
                  $sum: { $cond: ['$isSessionBreak', 1, 0] },
                  window: {
                    documents: ['unbounded', 'current'],
                  },
                },
              },
            },
          },
          {
            $addFields: {
              sessionKey: {
                $concat: ['$actorKey', '::synth::', { $toString: '$sessionOrd' }],
              },
            },
          },
          { $sort: { sessionKey: 1, timestamp: 1 } },
          {
            $group: {
              _id: '$sessionKey',
              ...GROUP_BLOCK,
            },
          },
          PROJECT_AFTER_GROUP,
        ],
      },
    },
    {
      $project: {
        merged: { $concatArrays: ['$withSessionId', '$withoutSessionId'] },
      },
    },
    { $unwind: '$merged' },
    { $replaceRoot: { newRoot: '$merged' } },
  ];

  if (authStatus === 'authenticated') {
    pipeline.push({ $match: { userId: { $ne: null } } });
  } else if (authStatus === 'unauthenticated') {
    pipeline.push({ $match: { userId: null } });
  }

  if (userIdContains && String(userIdContains).trim()) {
    const rx = escapeRegex(String(userIdContains).trim());
    pipeline.push({
      $match: {
        $expr: {
          $regexMatch: {
            input: {
              $cond: [{ $eq: ['$userId', null] }, 'Unauthenticated', { $toString: '$userId' }],
            },
            regex: rx,
            options: 'i',
          },
        },
      },
    });
  }

  pipeline.push({
    $facet: {
      rows: [{ $sort: { [sortField]: dir } }, { $skip: skip }, { $limit: limit }],
      totalCount: [{ $count: 'n' }],
    },
  });

  const [agg] = await Analytics.aggregate(pipeline).allowDiskUse(true);

  const rows = (agg?.rows || []).map((r) => ({
    sessionKey: r.sessionKey,
    sessionStart: r.sessionStart instanceof Date ? r.sessionStart.toISOString() : r.sessionStart,
    durationMs: r.durationMs || 0,
    userId: r.userId ? String(r.userId) : null,
    uniqueQueries: r.uniqueQueries ?? 0,
    uniqueQueriesNoResults: r.uniqueQueriesNoResults ?? 0,
    docSearches: r.docSearches ?? 0,
    docSearchesNoResults: r.docSearchesNoResults ?? 0,
    documentViews: r.documentViews ?? 0,
    topicViews: r.topicViews ?? 0,
  }));

  const total = agg?.totalCount?.[0]?.n ?? 0;

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    page: Math.max(1, parseInt(page, 10) || 1),
    perPage: limit,
    total,
    results: rows,
  };
}

module.exports = {
  getSessionList,
};
