const Groq = require('groq-sdk');
const config = require('../../config/env');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// We'll use Llama 3.3 70B for text tasks
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Generate a concise 2-3 sentence summary of the provided text.
 */
const generateSummary = async (content) => {
  if (!content || !process.env.GROQ_API_KEY) return '';

  try {
    const text = content.substring(0, 4000); // Send only the first part to fit context window
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a technical documentation assistant. Summarize the provided text in 2-3 sentences. Do not include introductory phrases like "Here is a summary". Just provide the summary.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Groq generateSummary error:', error.message);
    return '';
  }
};

/**
 * Extract 3-5 semantic tags from the provided text.
 * Returns an array of lowercase strings.
 */
const generateTags = async (content) => {
  if (!content || !process.env.GROQ_API_KEY) return [];

  try {
    const text = content.substring(0, 4000);
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an auto-tagging system. Extract 3 to 5 highly relevant semantic tags from the provided text. Return ONLY a comma-separated list of tags in lowercase. No other text.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      model: MODEL,
      temperature: 0.1,
      max_tokens: 50,
    });

    const tagsStr = response.choices[0]?.message?.content?.trim() || '';
    return tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  } catch (error) {
    console.error('Groq generateTags error:', error.message);
    return [];
  }
};

/**
 * RAG: Answer a user's question based on provided context documents.
 */
const generateAnswer = async (query, contexts) => {
  if (!query || !contexts || contexts.length === 0 || !process.env.GROQ_API_KEY) {
    return 'I need more context to answer this question.';
  }

  try {
    // Combine contexts into a readable format
    const contextStr = contexts.map((c, i) => `[Source ${i + 1}: ${c.title}]\n${c.content}`).join('\n\n---\n\n');

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a helpful expert assistant for a documentation platform. Answer the user's question using ONLY the provided context. 
If the answer is not contained in the context, politely state that you cannot answer based on the provided documentation. 
Provide a clear, concise, and structured answer. If applicable, cite the sources used (e.g., "According to [Source 1]").`,
        },
        {
          role: 'user',
          content: `Context:\n${contextStr}\n\nQuestion: ${query}`,
        },
      ],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || 'Failed to generate an answer.';
  } catch (error) {
    console.error('Groq generateAnswer error:', error.message);
    return 'Sorry, I encountered an error while trying to answer your question.';
  }
};

module.exports = {
  generateSummary,
  generateTags,
  generateAnswer,
};
