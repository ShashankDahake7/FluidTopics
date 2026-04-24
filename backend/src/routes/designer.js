const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const DesignerPage = require('../models/DesignerPage');

const router = express.Router();

const adminOrEditor = [auth, requireRole('admin', 'editor')];

// GET /api/designer/pages — list all pages
router.get('/pages', ...adminOrEditor, async (req, res, next) => {
  try {
    const pages = await DesignerPage.find()
      .sort({ updatedAt: -1 })
      .select('name type status locale createdAt updatedAt')
      .lean();

    res.json({ pages });
  } catch (error) {
    next(error);
  }
});

// POST /api/designer/pages — create a new page
router.post('/pages', ...adminOrEditor, async (req, res, next) => {
  try {
    const { name, type, locale } = req.body;

    const page = await DesignerPage.create({
      name,
      type,
      locale,
      createdBy: req.user._id,
    });

    res.status(201).json({ page });
  } catch (error) {
    next(error);
  }
});

// POST /api/designer/pages/import — import a page from JSON body
// Declared before /:id to avoid route conflict
router.post('/pages/import', ...adminOrEditor, async (req, res, next) => {
  try {
    const { name, type, tree, theme, locale, localizedLabels, footer, metadataCondition } = req.body;

    const page = await DesignerPage.create({
      name: `${name || 'Untitled'} (Imported)`,
      type,
      tree,
      theme,
      locale,
      localizedLabels,
      footer,
      metadataCondition,
      status: 'draft',
      createdBy: req.user._id,
    });

    res.status(201).json({ page });
  } catch (error) {
    next(error);
  }
});

// GET /api/designer/pages/:id — get one page
router.get('/pages/:id', ...adminOrEditor, async (req, res, next) => {
  try {
    const page = await DesignerPage.findById(req.params.id).lean();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/designer/pages/:id — update a page
router.patch('/pages/:id', ...adminOrEditor, async (req, res, next) => {
  try {
    const allowed = ['name', 'tree', 'theme', 'status', 'locale', 'localizedLabels', 'footer', 'metadataCondition'];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const page = await DesignerPage.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).lean();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/designer/pages/:id — delete a page
router.delete('/pages/:id', ...adminOrEditor, async (req, res, next) => {
  try {
    const page = await DesignerPage.findByIdAndDelete(req.params.id).lean();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ message: 'Page deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/designer/pages/:id/duplicate — clone a page
router.post('/pages/:id/duplicate', ...adminOrEditor, async (req, res, next) => {
  try {
    const original = await DesignerPage.findById(req.params.id).lean();

    if (!original) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const { _id, createdAt, updatedAt, __v, ...rest } = original;

    const duplicate = await DesignerPage.create({
      ...rest,
      name: `${original.name} (Copy)`,
      status: 'draft',
      createdBy: req.user._id,
    });

    res.status(201).json({ page: duplicate });
  } catch (error) {
    next(error);
  }
});

// GET /api/designer/pages/:id/export — download page as JSON
router.get('/pages/:id/export', ...adminOrEditor, async (req, res, next) => {
  try {
    const page = await DesignerPage.findById(req.params.id).lean();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const filename = `${page.name.replace(/[^a-z0-9_\-]/gi, '_')}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(page, null, 2));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
