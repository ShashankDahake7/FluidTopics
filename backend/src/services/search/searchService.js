const { getElasticClient } = require('../../config/elasticsearch');
const config = require('../../config/env');

const INDEX = config.elasticsearch.index;

/**
 * Full-text search with faceted filtering
 * @param {Object} params
 * @param {string} params.query - Search query
 * @param {Object} params.filters - { tags, product, version, language }
 * @param {number} params.page - Page number (1-based)
 * @param {number} params.limit - Results per page
 * @param {string} params.sort - 'relevance' | 'date' | 'views'
 * @param {Object} params.boost - { tags: string[], products: string[] }
 */
const search = async ({ query, filters = {}, page = 1, limit = 20, sort = 'relevance', boost = null }) => {
  const client = getElasticClient();

  const must = [];
  const filter = [];

  // Main query
  if (query && query.trim()) {
    must.push({
      multi_match: {
        query: query.trim(),
        fields: ['title^3', 'content', 'tags^2'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  // Facet filters
  if (filters.tags && filters.tags.length > 0) {
    filter.push({ terms: { tags: filters.tags } });
  }
  if (filters.product) {
    filter.push({ term: { product: filters.product } });
  }
  if (filters.version) {
    filter.push({ term: { version: filters.version } });
  }
  if (filters.language) {
    filter.push({ term: { language: filters.language } });
  }

  // Sort
  const sortConfig = [];
  switch (sort) {
    case 'date':
      sortConfig.push({ updatedAt: 'desc' });
      break;
    case 'views':
      sortConfig.push({ viewCount: 'desc' });
      break;
    default:
      sortConfig.push({ _score: 'desc' });
  }

  // Apply User Profile Boosting
  let finalQuery = { bool: { must, filter } };

  if (boost && sort === 'relevance') {
    const functions = [];
    if (boost.tags && boost.tags.length > 0) {
      functions.push({
        filter: { terms: { tags: boost.tags } },
        weight: 1.5,
      });
    }
    if (boost.products && boost.products.length > 0) {
      functions.push({
        filter: { terms: { product: boost.products } },
        weight: 2.0,
      });
    }

    if (functions.length > 0) {
      finalQuery = {
        function_score: {
          query: finalQuery,
          functions,
          score_mode: 'sum',
          boost_mode: 'multiply',
        },
      };
    }
  }

  const from = (page - 1) * limit;

  const result = await client.search({
    index: INDEX,
    body: {
      query: finalQuery,
      highlight: {
        fields: {
          title: { number_of_fragments: 0 },
          content: {
            fragment_size: 200,
            number_of_fragments: 3,
          },
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      },
      sort: sortConfig,
      from,
      size: limit,
      aggs: {
        tags: {
          terms: { field: 'tags', size: 20 },
        },
        products: {
          terms: { field: 'product', size: 10 },
        },
        versions: {
          terms: { field: 'version', size: 10 },
        },
        languages: {
          terms: { field: 'language', size: 10 },
        },
      },
    },
  });

  const hits = result.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    ...hit._source,
    highlight: hit.highlight || {},
  }));

  const total = result.hits.total?.value || result.hits.total || 0;

  const facets = {
    tags: (result.aggregations?.tags?.buckets || []).map((b) => ({
      value: b.key,
      count: b.doc_count,
    })),
    products: (result.aggregations?.products?.buckets || []).map((b) => ({
      value: b.key,
      count: b.doc_count,
    })),
    versions: (result.aggregations?.versions?.buckets || []).map((b) => ({
      value: b.key,
      count: b.doc_count,
    })),
    languages: (result.aggregations?.languages?.buckets || []).map((b) => ({
      value: b.key,
      count: b.doc_count,
    })),
  };

  return {
    hits,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    facets,
  };
};

/**
 * Auto-complete suggestions
 */
const suggest = async (prefix) => {
  const client = getElasticClient();

  const result = await client.search({
    index: INDEX,
    body: {
      suggest: {
        topic_suggest: {
          prefix: prefix,
          completion: {
            field: 'suggest',
            size: 8,
            fuzzy: { fuzziness: 'AUTO' },
          },
        },
      },
    },
  });

  const suggestions = (result.suggest?.topic_suggest?.[0]?.options || []).map((opt) => ({
    text: opt.text,
    score: opt._score,
    id: opt._id,
  }));

  return suggestions;
};

module.exports = { search, suggest };
