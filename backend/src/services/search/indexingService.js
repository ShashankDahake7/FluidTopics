const { getElasticClient } = require('../../config/elasticsearch');
const config = require('../../config/env');

const INDEX = config.elasticsearch.index;

/**
 * Index topics into Elasticsearch
 * @param {Array} topics - Array of Topic mongoose documents
 */
const indexTopics = async (topics) => {
  const client = getElasticClient();

  if (topics.length === 0) return;

  const body = topics.flatMap((topic) => [
    {
      index: {
        _index: INDEX,
        _id: topic._id.toString(),
      },
    },
    {
      title: topic.title,
      content: topic.content?.text || '',
      slug: topic.slug,
      documentId: topic.documentId?.toString() || '',
      topicId: topic._id.toString(),
      tags: topic.metadata?.tags || [],
      product: topic.metadata?.product || '',
      version: topic.metadata?.version || '',
      language: topic.metadata?.language || 'en',
      author: topic.metadata?.author || '',
      hierarchyLevel: topic.hierarchy?.level || 1,
      viewCount: topic.viewCount || 0,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      suggest: {
        input: [
          topic.title,
          ...(topic.metadata?.tags || []),
        ].filter(Boolean),
        weight: topic.hierarchy?.level === 1 ? 10 : 5,
      },
    },
  ]);

  const result = await client.bulk({ body, refresh: true });

  if (result.errors) {
    const errorItems = result.items.filter((item) => item.index?.error);
    console.error(
      'Elasticsearch bulk indexing errors:',
      errorItems.map((i) => i.index.error.reason)
    );
  }

  console.log(`✅ Indexed ${topics.length} topics in Elasticsearch`);
  return result;
};

/**
 * Remove a topic from the index
 */
const removeFromIndex = async (topicId) => {
  const client = getElasticClient();
  try {
    await client.delete({
      index: INDEX,
      id: topicId.toString(),
    });
  } catch (error) {
    if (error.meta?.statusCode !== 404) {
      throw error;
    }
  }
};

/**
 * Remove all topics for a document
 */
const removeDocumentFromIndex = async (documentId) => {
  const client = getElasticClient();
  await client.deleteByQuery({
    index: INDEX,
    body: {
      query: {
        term: { documentId: documentId.toString() },
      },
    },
  });
};

module.exports = { indexTopics, removeFromIndex, removeDocumentFromIndex };
