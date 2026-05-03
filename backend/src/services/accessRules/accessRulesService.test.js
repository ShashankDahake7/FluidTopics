const test = require('node:test');
const assert = require('node:assert/strict');

const {
  userCanBypass,
  canUserAccessDocument,
  canUserAccessTopic,
} = require('./accessRulesService');

const cfg = {
  mode: 'enhanced',
  defaultRule: 'public',
  topicLevelEnabled: true,
};

const document = {
  _id: 'doc1',
  title: 'Guide',
  metadata: {
    tags: ['public'],
    product: 'Core',
    customFields: { audience: 'customer' },
  },
};

const topic = {
  _id: 'topic1',
  title: 'Premium setup',
  documentId: 'doc1',
  metadata: {
    tags: ['premium'],
    custom: { plan: ['Premium'] },
  },
  hierarchy: { parent: null },
};

test('privileged roles bypass access rules', () => {
  assert.equal(userCanBypass({ role: 'admin' }), true);
  assert.equal(userCanBypass({ role: 'viewer', adminRoles: ['KHUB_ADMIN'] }), true);
  assert.equal(userCanBypass({ role: 'viewer', adminRoles: ['CONTENT_PUBLISHER'] }), true);
  assert.equal(userCanBypass({ role: 'user', roles: ['CONTENT_PUBLISHER'], isApiKey: true }), true);
  assert.equal(userCanBypass({ role: 'viewer', adminRoles: ['USERS_ADMIN'] }), false);
});

test('document rules grant access to matching user groups', async () => {
  const ctx = {
    cfg: { ...cfg, defaultRule: 'none' },
    user: { groups: ['vip'] },
    activeRules: [{
      requirements: [{ key: 'audience', op: 'any', values: ['customer'] }],
      requirementsMode: 'all',
      authMode: 'groups',
      groups: ['vip'],
      targetTopics: false,
    }],
  };

  assert.equal(await canUserAccessDocument(ctx.user, document, { ctx }), true);
  assert.equal(await canUserAccessDocument({ groups: ['basic'] }, document, {
    ctx: { ...ctx, user: { groups: ['basic'] } },
  }), false);
});

test('auto-bind grants access when metadata value matches a group name', async () => {
  const ctx = {
    cfg: { ...cfg, defaultRule: 'none' },
    user: { groups: [], groupNames: new Set(['customer']) },
    activeRules: [{
      requirements: [{ key: 'audience', op: 'any', values: ['customer'] }],
      requirementsMode: 'all',
      authMode: 'auto',
      autoBindKey: 'audience',
      targetTopics: false,
    }],
  };

  assert.equal(await canUserAccessDocument(ctx.user, document, { ctx }), true);
});

test('topic-level rules override inherited document access', async () => {
  const ctx = {
    cfg,
    user: { groups: ['basic'] },
    activeRules: [{
      requirements: [{ key: 'plan', op: 'any', values: ['Premium'] }],
      requirementsMode: 'all',
      authMode: 'groups',
      groups: ['vip'],
      targetTopics: true,
    }],
  };

  assert.equal(await canUserAccessTopic(ctx.user, topic, document, { ctx }), false);
  assert.equal(await canUserAccessTopic({ groups: ['vip'] }, topic, document, {
    ctx: { ...ctx, user: { groups: ['vip'] } },
  }), true);
});

test('children inherit parent topic access decisions', async () => {
  const parent = {
    ...topic,
    _id: 'parent',
    hierarchy: { parent: null },
  };
  const child = {
    ...topic,
    _id: 'child',
    metadata: { custom: {} },
    hierarchy: { parent: 'parent' },
  };
  const topicById = new Map([
    ['parent', parent],
    ['child', child],
  ]);
  const ctx = {
    cfg,
    user: { groups: ['basic'] },
    activeRules: [{
      requirements: [{ key: 'plan', op: 'any', values: ['Premium'] }],
      requirementsMode: 'all',
      authMode: 'groups',
      groups: ['vip'],
      targetTopics: true,
    }],
  };

  assert.equal(await canUserAccessTopic(ctx.user, child, document, { ctx, topicById }), false);
});
