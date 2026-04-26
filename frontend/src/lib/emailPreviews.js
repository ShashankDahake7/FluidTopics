/**
 * Email-template preview HTML builders.
 *
 * Each builder returns a complete, self-contained HTML document that can be
 * fed straight into an `<iframe srcDoc="…">`. Shared between the email
 * notification settings page and the feedback notification page so both
 * surfaces show the exact same preview content.
 */

import { DARWINBOX_FOOTER_LINK_ROW } from '@/lib/darwinboxSocial';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const MAIL_PREVIEW_STYLES = `
  body{margin:0;padding:20px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#1e293b;line-height:1.55;background:#fff;}
  a{color:#1d4ed8;text-decoration:none;}
  .meta{display:grid;grid-template-columns:88px 1fr;gap:6px 14px;font-size:13px;margin-bottom:20px;}
  .meta dt{margin:0;color:#64748b;font-weight:600;}
  .meta dd{margin:0;color:#0f172a;word-break:break-all;}
  .frame{border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}
  .banner{background:#1d4ed8;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .inner{padding:20px 22px 24px;}
  .inner p{margin:0 0 12px;}
  hr{border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;}
  .muted{font-size:12px;color:#64748b;}
  .social{font-size:12px;margin-top:12px;}
  .sep{color:#94a3b8;margin:0 6px;}
`;

export function logoBannerBlock(logoAbs) {
  return logoAbs
    ? `<img src="${escapeHtml(logoAbs)}" alt="" style="max-height:36px;object-fit:contain"/>`
    : `<span style="font-weight:700;font-size:1.1rem">darwinbox</span>`;
}

export function mailFooter() {
  const row = DARWINBOX_FOOTER_LINK_ROW.map(
    (item, i) =>
      `${i > 0 ? '<span class="sep">|</span>' : ''}<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`
  ).join('');
  return `<hr/>
    <p class="muted">Copyright ©2026, Darwinbox Digital Solutions Pvt. Ltd. All Rights Reserved</p>
    <p class="social">${row}</p>`;
}

// ── Account / password / MFA ─────────────────────────────────────────────────

export function buildUserActivationSrcDoc({ fromAddr, sampleTo, sampleName, activationUrl, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>Account Activation</dd>
  <dt>To</dt><dd>${escapeHtml(sampleTo)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(fromAddr)}</dd>
</dl>
<div class="frame">
  <div class="banner">${logoBlock}<span style="font-weight:700;font-size:1.05rem">Account Activation</span></div>
  <div class="inner">
    <p>Hello ${escapeHtml(sampleName)},</p>
    <p>Thanks for joining Darwinbox Help Portal. Enter the age of limitless technical content delivery.</p>
    <p>You have successfully created the following account name: <strong>${escapeHtml(sampleTo)}</strong></p>
    <p>Please activate your account by simply clicking on the link below or pasting it into the url field of your favorite browser</p>
    <p style="margin-top:16px"><a href="#">${escapeHtml(activationUrl)}</a></p>
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

export function buildChangePasswordSrcDoc({ fromAddr, sampleTo, sampleName, changePasswordUrl, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>Change password</dd>
  <dt>To</dt><dd>${escapeHtml(sampleTo)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(fromAddr)}</dd>
</dl>
<div class="frame">
  <div class="banner">${logoBlock}<span style="font-weight:700;font-size:1.05rem">Change password</span></div>
  <div class="inner">
    <p>Hello ${escapeHtml(sampleName)},</p>
    <p>You have requested to change the password for your Darwinbox Help Portal account (<strong>${escapeHtml(sampleTo)}</strong>).</p>
    <p>To set a new password, click the link below or paste it into your browser.</p>
    <p>If you didn't request this email then you can just ignore it -- your details have not been disclosed to anyone.</p>
    <p>If you have any questions about the system, feel free to contact us anytime at <a href="mailto:${escapeHtml(fromAddr)}">${escapeHtml(fromAddr)}</a>.</p>
    <p style="margin-top:16px"><a href="#">${escapeHtml(changePasswordUrl)}</a></p>
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

export function buildUpdatePasswordSrcDoc({ fromAddr, sampleTo, sampleName, portalSignInUrl, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>Update password</dd>
  <dt>To</dt><dd>${escapeHtml(sampleTo)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(fromAddr)}</dd>
</dl>
<div class="frame">
  <div class="banner">${logoBlock}<span style="font-weight:700;font-size:1.05rem">Update password</span></div>
  <div class="inner">
    <p>Hello ${escapeHtml(sampleName)},</p>
    <p>The password for your Darwinbox Help Portal account (<strong>${escapeHtml(sampleTo)}</strong>) has been updated successfully.</p>
    <p>You can sign in with your new password at any time. If you did not change your password, please reset it immediately and contact your administrator.</p>
    <p style="margin-top:16px"><a href="#">${escapeHtml(portalSignInUrl)}</a></p>
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

export function buildAlertSrcDoc({ fromAddr, sampleTo, sampleName, savedSearchName, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  const lorem =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam id rhoncus mauris. Vestibulum ut enim odio. Aliquam nisl ligula, commodo a ullamcorper a, dapibus sit amet nunc. Aliquam eget nunc tortor. Aenean luctus egestas purus, eu tempor neque mollis quis. Phasellus eget ultricies mauris. Vestibulum nec sagittis tortor. Nunc nibh urna, condimentum in ligula id, aliquam semper lorem. Duis tristique justo eu quam consectetur, in scelerisque dui feugiat. Fusce facilisis dolor arcu, a dictum ex tincidunt ut. Sed sodales pellentesque porttitor. Nam bibendum interdum est vel suscipit.';
  const breadcrumb = (extras = []) => {
    const base = '<a href="#">Book Foo</a> &gt; <a href="#">Parent 1</a> &gt; <a href="#">Parent 2</a>';
    if (!extras.length) return base;
    const tags = extras
      .map((t) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:3px;padding:1px 6px;margin-left:6px;font-size:12px;color:#475569">${escapeHtml(t)}</span>`)
      .join('');
    return `${base}${tags}`;
  };
  const resultBlock = (letter, crumbHtml) => `
    <section style="padding:18px 0;border-bottom:1px solid #e5e7eb;">
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1d4ed8;">Result <span style="color:#1d4ed8;">${escapeHtml(letter)}</span></h3>
      <p style="margin:0 0 10px;color:#1e293b;line-height:1.55;">${lorem}</p>
      <div style="font-size:13px;font-weight:600;">${crumbHtml}</div>
    </section>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}
.banner{background:#1d4ed8;color:#fff;padding:14px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;}
.banner img{max-height:24px;object-fit:contain;}
.banner .title{font-weight:700;font-size:1.05rem;}
.recap{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:18px;}
.recap .lead{margin:0;color:#475569;font-size:13px;}
.recap .count{margin:0;color:#1d4ed8;font-size:13px;font-weight:600;}
</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>"${escapeHtml(savedSearchName)}" search summary</dd>
  <dt>To</dt><dd>${escapeHtml(sampleTo)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(fromAddr)}</dd>
</dl>
<div class="frame">
  <div class="banner">
    ${logoBlock}
    <span class="title">"${escapeHtml(savedSearchName)}" search summary</span>
  </div>
  <div class="inner">
    <p style="margin:4px 0 14px;font-weight:700;font-size:15px;">Hello ${escapeHtml(sampleName)}</p>
    <div class="recap">
      <p class="lead">Here is a recap of the documents you're following:</p>
      <p class="count">Showing 5 first results out of 42</p>
    </div>
    ${resultBlock('A', breadcrumb(['3.1', 'Debian']) + '<br/>' + breadcrumb(['3.2', 'RHEL']))}
    ${resultBlock('A', breadcrumb())}
    ${resultBlock('B', breadcrumb())}
    ${resultBlock('C', breadcrumb())}
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

export function buildResetMfaSrcDoc({ fromAddr, sampleTo, mfaResetUrl, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}
.banner{background:#1d4ed8;color:#fff;padding:14px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;}
.banner img{max-height:24px;object-fit:contain;}
.banner .title{font-weight:700;font-size:1.05rem;}
</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>Confirm multi-factor authentication reset</dd>
  <dt>To</dt><dd>${escapeHtml(sampleTo)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(fromAddr)}</dd>
</dl>
<div class="frame">
  <div class="banner">
    ${logoBlock}
    <span class="title">Confirm multi-factor authentication reset</span>
  </div>
  <div class="inner">
    <p>You are receiving this email because an administrator has initiated a multi-factor authentication (MFA) reset for this account: <strong>${escapeHtml(sampleTo)}</strong></p>
    <p>To confirm this MFA reset, click on the following link:</p>
    <p style="margin-top:16px"><a href="${escapeHtml(mfaResetUrl)}" style="text-decoration:underline;">${escapeHtml(mfaResetUrl)}</a></p>
    <p><strong>This link is only valid for the next 24 hours.</strong></p>
    <p>If you did not request a MFA reset, please contact an administrator.</p>
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

// ── Feedback emails ──────────────────────────────────────────────────────────

const FEEDBACK_LOREM_1 =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam id rhoncus mauris. Vestibulum ut enim odio. Aliquam nisl ligula, commodo a ullamcorper a, consequat sit amet nunc. Aliquam eget nunc tortor. Aenean luctus egestas purus, eu tempor neque mollis quis. Phasellus eget ultricies mauris. Vestibulum nec sagittis tortor. Nunc nibh urna, condimentum in ligula id, aliquam semper lorem. Duis tristique justo eu quam consectetur, in scelerisque dui feugiat. Fusce facilisis dolor arcu, a dictum ex tincidunt ut. Sed sodales pellentesque porttitor. Nam bibendum interdum est vel suscipit.';

const FEEDBACK_LOREM_2 =
  'Sed at mauris quis odio tristique faucibus. Suspendisse potenti. In hac habitasse platea dictumst. Integer finibus, urna sit amet lacinia luctus, urna dolor pellentesque augue, eget ullamcorper ante purus in velit. Pellentesque eget ligula ac lorem vulputate interdum. Nam at urna arcu. Ut cursus erat at mi luctus dictum ut nec tellus. Duis a commodo arcu. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Curabitur magna ligula, hendrerit ac molestie quis, consequat ac nisl. Vestibulum dolor dui, elementum vitae tellus quis, molestie malesuada mi. Nulla sapien metus, placerat id arcu sed, efficitur pulvinar augue. Proin tristique massa sit amet sodales efficitur. Etiam mauris lectus, placerat id urna condimentum, ornare scelerisque odio. Integer porta ante dignissim molestie congue. In hac habitasse platea dictumst.';

const DEFAULT_FEEDBACK_META_TAGS = [
  'ft:lastPublication',
  'publicationDate',
  'author_personname',
  'title',
  'ft:publication_title',
];

function feedbackMetaTagsHtml(tags) {
  return (tags && tags.length ? tags : DEFAULT_FEEDBACK_META_TAGS)
    .map((t) => `<a href="#" style="color:#2563eb;text-decoration:underline;font-style:italic;font-size:12px;">${escapeHtml(t)}</a>`)
    .join('<span style="color:#94a3b8;font-size:12px;"> , </span>');
}

function topicReferenceLine(bookTitle, parents, topicTitle, metaTags) {
  const head = `<a href="#" style="color:#0f172a;text-decoration:underline;font-weight:700;">${escapeHtml(bookTitle)}</a>`;
  const trail = parents
    .concat([topicTitle])
    .map((p) => `<a href="#" style="color:#2563eb;text-decoration:underline;">${escapeHtml(p)}</a>`)
    .join(' <span style="color:#475569;">&gt;</span> ');
  return `<div style="font-size:13px;line-height:1.6;">${head} <span style="color:#475569;">&gt;</span> ${trail} &nbsp;${feedbackMetaTagsHtml(metaTags)}</div>`;
}

function documentReferenceLine(filename, metaTags) {
  const file = `<a href="#" style="color:#0f172a;text-decoration:underline;font-weight:700;">${escapeHtml(filename)}</a>`;
  return `<div style="font-size:13px;line-height:1.6;">${file} &nbsp;${feedbackMetaTagsHtml(metaTags)}</div>`;
}

function feedbackBannerStyles() {
  return `
.banner{background:#1d4ed8;color:#fff;padding:14px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;}
.banner img{max-height:24px;object-fit:contain;}
.banner .title{font-weight:700;font-size:1.05rem;line-height:1.4;}
.subject-h{margin:14px 0 4px;color:#1d4ed8;font-size:18px;font-weight:600;}
.lorem{margin:14px 0 0;color:#1e293b;line-height:1.55;}
.reported{margin:0 0 6px;font-weight:700;color:#0f172a;}
`;
}

export function buildTopicFeedbackAdminSrcDoc({ fromAddr, adminTo, userEmail, userName, bookTitle, parents, topicTitle, metaTags, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  const subject = `Feedback about "${topicTitle}" in "${bookTitle}"`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}${feedbackBannerStyles()}</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>${escapeHtml(subject)}</dd>
  <dt>To</dt><dd>${escapeHtml(adminTo)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(userEmail)}</dd>
</dl>
<div class="frame">
  <div class="banner">
    ${logoBlock}
    <span class="title">${escapeHtml(subject)}</span>
  </div>
  <div class="inner">
    <h2 class="subject-h">${escapeHtml(topicTitle)}</h2>
    ${topicReferenceLine(bookTitle, parents, topicTitle, metaTags)}
    <p class="lorem">${FEEDBACK_LOREM_1}</p>
    <p class="lorem">${FEEDBACK_LOREM_2}</p>
    <hr/>
    <p class="reported">Reported by:</p>
    <p style="margin:0;">${escapeHtml(userName)} &lt;<a href="mailto:${escapeHtml(userEmail)}">${escapeHtml(userEmail)}</a>&gt;</p>
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

export function buildTopicFeedbackUserSrcDoc({ fromAddr, userEmail, userName, bookTitle, parents, topicTitle, metaTags, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  const subject = `Feedback about "${topicTitle}" in "${bookTitle}"`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}${feedbackBannerStyles()}</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>${escapeHtml(subject)}</dd>
  <dt>To</dt><dd>${escapeHtml(userEmail)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(fromAddr)}</dd>
</dl>
<div class="frame">
  <div class="banner">
    ${logoBlock}
    <span class="title">${escapeHtml(subject)}</span>
  </div>
  <div class="inner">
    <p style="margin:4px 0 12px;font-weight:700;color:#0f172a;">Hello ${escapeHtml(userName)}</p>
    <p style="margin:0 0 4px;color:#1e293b;">Thank you for your interest and feedback.</p>
    <p style="margin:0;color:#1e293b;">Here is a recap of your feedback.</p>
    <hr/>
    <h2 class="subject-h" style="margin-top:0;">${escapeHtml(topicTitle)}</h2>
    ${topicReferenceLine(bookTitle, parents, topicTitle, metaTags)}
    <p class="lorem">${FEEDBACK_LOREM_1}</p>
    <p class="lorem">${FEEDBACK_LOREM_2}</p>
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

export function buildDocumentFeedbackAdminSrcDoc({ fromAddr, adminTo, userEmail, userName, docTitle, docFilename, metaTags, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  const subject = `Feedback about "${docTitle}" with filename "${docFilename}"`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}${feedbackBannerStyles()}</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>${escapeHtml(subject)}</dd>
  <dt>To</dt><dd>${escapeHtml(adminTo)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(userEmail)}</dd>
</dl>
<div class="frame">
  <div class="banner">
    ${logoBlock}
    <span class="title">${escapeHtml(subject)}</span>
  </div>
  <div class="inner">
    <h2 class="subject-h">${escapeHtml(docTitle)}</h2>
    ${documentReferenceLine(docFilename, metaTags)}
    <p class="lorem">${FEEDBACK_LOREM_1}</p>
    <p class="lorem">${FEEDBACK_LOREM_2}</p>
    <hr/>
    <p class="reported">Reported by:</p>
    <p style="margin:0;">${escapeHtml(userName)} &lt;<a href="mailto:${escapeHtml(userEmail)}">${escapeHtml(userEmail)}</a>&gt;</p>
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

export function buildDocumentFeedbackUserSrcDoc({ fromAddr, userEmail, userName, docTitle, docFilename, metaTags, logoAbs }) {
  const logoBlock = logoBannerBlock(logoAbs);
  const subject = `Feedback about "${docTitle}" with filename "${docFilename}"`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${MAIL_PREVIEW_STYLES}${feedbackBannerStyles()}</style></head><body>
<dl class="meta">
  <dt>From</dt><dd>${escapeHtml(fromAddr)}</dd>
  <dt>Subject</dt><dd>${escapeHtml(subject)}</dd>
  <dt>To</dt><dd>${escapeHtml(userEmail)}</dd>
  <dt>Reply-To</dt><dd>${escapeHtml(fromAddr)}</dd>
</dl>
<div class="frame">
  <div class="banner">
    ${logoBlock}
    <span class="title">${escapeHtml(subject)}</span>
  </div>
  <div class="inner">
    <p style="margin:4px 0 12px;font-weight:700;color:#0f172a;">Hello ${escapeHtml(userName)}</p>
    <p style="margin:0 0 4px;color:#1e293b;">Thank you for your interest and feedback.</p>
    <p style="margin:0;color:#1e293b;">Here is a recap of your feedback.</p>
    <hr/>
    <h2 class="subject-h" style="margin-top:0;">${escapeHtml(docTitle)}</h2>
    ${documentReferenceLine(docFilename, metaTags)}
    <p class="lorem">${FEEDBACK_LOREM_1}</p>
    <p class="lorem">${FEEDBACK_LOREM_2}</p>
    ${mailFooter()}
  </div>
</div>
</body></html>`;
}

export function buildPlaceholderSrcDoc(title) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{margin:0;padding:24px;font-family:system-ui,sans-serif;font-size:15px;color:#64748b;line-height:1.5;}
  </style></head><body>Preview for “${escapeHtml(title)}” is not wired yet.</body></html>`;
}

/**
 * Single dispatcher used by every screen that wants to render a preview by
 * template name. `ctx` should provide whatever sample values the chosen
 * template needs; missing fields fall back to sensible defaults.
 */
export function buildEmailPreviewSrcDoc(template, ctx = {}) {
  const fromAddr = ctx.fromAddr || 'docs@darwinbox.com';
  const sampleTo = ctx.sampleTo || 'john.doe@fluidtopics.com';
  const sampleName = ctx.sampleName || 'John Doe';
  const logoAbs = ctx.logoAbs || '';

  switch (template) {
    case 'User activation':
      return buildUserActivationSrcDoc({
        fromAddr, sampleTo, sampleName, logoAbs,
        activationUrl: ctx.activationUrl || 'https://help.darwinbox.com/activate-account/uuid',
      });
    case 'Change password':
      return buildChangePasswordSrcDoc({
        fromAddr, sampleTo, sampleName, logoAbs,
        changePasswordUrl: ctx.changePasswordUrl || 'https://help.darwinbox.com/change-password/uuid',
      });
    case 'Update password':
      return buildUpdatePasswordSrcDoc({
        fromAddr, sampleTo, sampleName, logoAbs,
        portalSignInUrl: ctx.portalSignInUrl || 'https://help.darwinbox.com/signin',
      });
    case 'Alert':
      return buildAlertSrcDoc({
        fromAddr, sampleTo, sampleName, logoAbs,
        savedSearchName: ctx.savedSearchName || 'My Saved Search',
      });
    case 'Reset MFA confirmation':
      return buildResetMfaSrcDoc({
        fromAddr, sampleTo, logoAbs,
        mfaResetUrl: ctx.mfaResetUrl || 'https://portal.fluidtopics.com/otp/reset/uuid',
      });
    case 'Topic feedback (sent to admin)':
      return buildTopicFeedbackAdminSrcDoc({
        fromAddr, logoAbs,
        adminTo:    ctx.adminTo    || 'docs@darwinbox.com, shivani.k@darwinbox.in',
        userEmail:  ctx.userEmail  || sampleTo,
        userName:   ctx.userName   || sampleName,
        bookTitle:  ctx.bookTitle  || 'AFS Integration Guide',
        parents:    ctx.parents    || ['Before You Begin'],
        topicTitle: ctx.topicTitle || 'Audience',
        metaTags:   ctx.metaTags,
      });
    case 'Topic feedback confirmation (sent to user)':
      return buildTopicFeedbackUserSrcDoc({
        fromAddr, logoAbs,
        userEmail:  ctx.userEmail  || sampleTo,
        userName:   ctx.userName   || sampleName,
        bookTitle:  ctx.bookTitle  || 'AFS Integration Guide',
        parents:    ctx.parents    || ['Before You Begin'],
        topicTitle: ctx.topicTitle || 'Audience',
        metaTags:   ctx.metaTags,
      });
    case 'Document feedback (sent to admin)':
      return buildDocumentFeedbackAdminSrcDoc({
        fromAddr, logoAbs,
        adminTo:     ctx.adminTo     || 'docs@darwinbox.com, shivani.k@darwinbox.in',
        userEmail:   ctx.userEmail   || sampleTo,
        userName:    ctx.userName    || sampleName,
        docTitle:    ctx.docTitle    || 'FluidTopics Zoom KHub Internals 2015c',
        docFilename: ctx.docFilename || 'FluidTopics-Zoom-KHub-Internals-2015c.pdf',
        metaTags:    ctx.metaTags,
      });
    case 'Document feedback confirmation (sent to user)':
      return buildDocumentFeedbackUserSrcDoc({
        fromAddr, logoAbs,
        userEmail:   ctx.userEmail   || sampleTo,
        userName:    ctx.userName    || sampleName,
        docTitle:    ctx.docTitle    || 'FluidTopics Zoom KHub Internals 2015c',
        docFilename: ctx.docFilename || 'FluidTopics-Zoom-KHub-Internals-2015c.pdf',
        metaTags:    ctx.metaTags,
      });
    default:
      return buildPlaceholderSrcDoc(template);
  }
}

/**
 * Builds the absolute URL to use in iframe-rendered banners for the configured
 * logo. Browser only — returns an empty string in SSR.
 */
export function resolveLogoAbs(logoUrl) {
  if (typeof window === 'undefined') return '';
  if (!logoUrl) return '';
  if (logoUrl.startsWith('http')) return logoUrl;
  const origin = window.location.origin;
  return `${origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
}
