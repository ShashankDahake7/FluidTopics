const express = require('express');
const upload = require('../middleware/upload');
const { auth, requireTierOrAdminRoles } = require('../middleware/auth');
const { CONTENT_PIPELINE: AR_CONTENT } = require('../constants/adminRoles');

const contentEditor = requireTierOrAdminRoles(['admin', 'editor'], AR_CONTENT);
const contentAdmin = requireTierOrAdminRoles(['admin'], AR_CONTENT);
const { ingestFile } = require('../services/ingestion/ingestionService');
const Document = require('../models/Document');
const publicationService = require('../services/publishing/publicationService');

const router = express.Router();

// POST /api/ingest/upload — Upload file for ingestion
router.post('/upload', auth, contentEditor, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const doc = await ingestFile(req.file, req.user._id);

    res.status(201).json({
      message: 'File ingested successfully',
      document: {
        id: doc._id,
        title: doc.title,
        status: doc.status,
        topicCount: doc.topicIds.length,
        metadata: doc.metadata,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ingest/webhook — Webhook-based ingestion
router.post('/webhook', async (req, res, next) => {
  try {
    // TODO: Validate webhook signature
    const { url, format, metadata } = req.body;
    res.json({ message: 'Webhook ingestion endpoint (coming soon)', received: { url, format } });
  } catch (error) {
    next(error);
  }
});

// GET /api/ingest/jobs — List ingestion jobs
router.get('/jobs', auth, contentEditor, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      Document.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title sourceFormat status topicIds fileSize metadata createdAt updatedAt')
        .lean(),
      Document.countDocuments(),
    ]);

    res.json({
      jobs: jobs.map((j) => ({
        ...j,
        topicCount: j.topicIds?.length || 0,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/ingest/status/:id — Get ingestion job status
router.get('/status/:id', auth, async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      id: doc._id,
      title: doc.title,
      status: doc.status,
      sourceFormat: doc.sourceFormat,
      topicCount: doc.topicIds.length,
      metadata: doc.metadata,
      ingestionLog: doc.ingestionLog,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/ingest/:id — Delete a document and its topics
router.delete('/:id', auth, contentAdmin, async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const Topic = require('../models/Topic');
    // Topic deletes propagate to the Atlas Search index automatically.
    // If this document was created via the publishing pipeline, we should
    // use the publicationService to clean up all associated S3 storage,
    // including raw archives and extracted CAS blobs.
    const Publication = require('../models/Publication');
    const linkedPubs = await Publication.find({ documentId: doc._id });
    for (const pub of linkedPubs) {
      await publicationService.deletePublication(pub._id);
    }

    // Secondary cleanup: if there are topics not caught by the publication
    // cascade (e.g. from legacy manual uploads), drop them now.
    await Topic.deleteMany({ documentId: doc._id });

    // Finally, drop the document record.
    await Document.findByIdAndDelete(doc._id);

    res.json({ message: 'Document and all associated topics and storage removed', id: doc._id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
