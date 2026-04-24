const { Client } = require('@elastic/elasticsearch');
const config = require('./env');

let client = null;

const getElasticClient = () => {
  if (!client) {
    client = new Client({
      node: config.elasticsearch.url,
      requestTimeout: 30000,
    });
  }
  return client;
};

const initElasticsearch = async () => {
  const esClient = getElasticClient();
  const indexName = config.elasticsearch.index;

  try {
    // Check connection
    const health = await esClient.cluster.health();
    console.log(`✅ Elasticsearch connected: ${health.cluster_name} (${health.status})`);

    // Create index if not exists
    const indexExists = await esClient.indices.exists({ index: indexName });
    if (!indexExists) {
      await esClient.indices.create({
        index: indexName,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              content_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'stop', 'snowball'],
              },
            },
          },
        },
        mappings: {
          properties: {
            title: {
              type: 'text',
              analyzer: 'content_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            content: {
              type: 'text',
              analyzer: 'content_analyzer',
            },
            slug: { type: 'keyword' },
            documentId: { type: 'keyword' },
            topicId: { type: 'keyword' },
            tags: { type: 'keyword' },
            product: { type: 'keyword' },
            version: { type: 'keyword' },
            language: { type: 'keyword' },
            author: { type: 'keyword' },
            hierarchyLevel: { type: 'integer' },
            viewCount: { type: 'integer' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            suggest: {
              type: 'completion',
              analyzer: 'simple',
            },
          },
        },
      });
      console.log(`✅ Elasticsearch index "${indexName}" created`);
    } else {
      console.log(`ℹ️  Elasticsearch index "${indexName}" already exists`);
    }
  } catch (error) {
    console.error(`❌ Elasticsearch error: ${error.message}`);
    console.warn('⚠️  Continuing without Elasticsearch. Search features will be limited.');
  }
};

module.exports = { getElasticClient, initElasticsearch };
