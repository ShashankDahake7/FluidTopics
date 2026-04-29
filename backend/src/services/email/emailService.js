const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const dns = require('dns').promises;
const EmailSettings = require('../../models/EmailSettings');
const config = require('../../config/env');

// ---------------------------------------------------------------------------
// emailService — single source of truth for sending notification emails
// (account activation, password reset, alerts, MFA reset…). Honours the
// admin-configured "Email sending method":
//
//   internal  →  Nodemailer JSON transport (no real network I/O). The default
//                Fluid Topics mail server is an external infra concern; in
//                the absence of one we don't pretend to deliver. The "From"
//                address is forced to no-reply@fluidtopics.net per the BRD.
//
//   spfdkim   →  SMTP transport against the same internal mail server, with
//                a DKIM signing block applied so the recipient's MTA can
//                verify the message via the configured selector.
//
//   smtp      →  External SMTP relay (Sendgrid, Mailgun, etc.). Transport
//                strategy SMTP/SMTPS/SMTP_TLS picks the right combination of
//                `secure` + `requireTLS` flags as Nodemailer expects.
//
//   sendgrid  →  SendGrid Web API v3 via the @sendgrid/mail SDK. Avoids
//                SMTP entirely; uses an API key for auth. The key can come
//                from the admin UI (EmailSettings.sendgridApiKey) or from
//                the SENDGRID_API_KEY env var (admin UI takes precedence).
//
// All operations log a sanitised summary to console (never the password /
// private key) so that "Send a test email" failures can be diagnosed from
// the backend output.
// ---------------------------------------------------------------------------

const INTERNAL_FROM = 'no-reply@fluidtopics.net';
const INTERNAL_HOST = process.env.FT_INTERNAL_SMTP_HOST || 'smtp.fluidtopics.net';
const INTERNAL_PORT = Number(process.env.FT_INTERNAL_SMTP_PORT) || 587;

function isLikelyEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function looksLikePemPrivateKey(s) {
  if (typeof s !== 'string') return false;
  return /-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]+-----END ([A-Z ]*PRIVATE KEY)-----/.test(s);
}

// ---------------------------------------------------------------------------
// Resolve the SendGrid API key. Admin-stored value takes precedence over the
// environment variable so that multi-tenant setups can override per portal.
// ---------------------------------------------------------------------------
function resolveSendgridApiKey(cfg) {
  return cfg.sendgridApiKey || config.sendgrid.apiKey || '';
}

function resolveSendgridFrom(cfg) {
  return cfg.sendgridFromAddress || config.sendgrid.defaultFrom || INTERNAL_FROM;
}

// ---------------------------------------------------------------------------
// Build a Nodemailer transport for the current configuration. Throws an Error
// (with a user-friendly message) when the configuration is incomplete; the
// route layer surfaces those messages to the admin UI.
//
// For the `sendgrid` method this returns `null` — the caller (sendMail)
// bypasses Nodemailer entirely and uses the SendGrid SDK.
// ---------------------------------------------------------------------------
async function buildTransporter(cfgOverride = null) {
  const cfg = cfgOverride || (await EmailSettings.getSingleton());

  if (cfg.sendingMethod === 'sendgrid') {
    const apiKey = resolveSendgridApiKey(cfg);
    if (!apiKey) throw new Error('SendGrid API key is required. Set it in the admin UI or via SENDGRID_API_KEY env var.');
    const fromAddress = resolveSendgridFrom(cfg);
    if (!isLikelyEmail(fromAddress)) throw new Error('A valid SendGrid From address is required.');
    // No Nodemailer transport needed — sendMail() will use the SDK directly.
    return { transport: null, fromAddress, sendgrid: true };
  }

  if (cfg.sendingMethod === 'smtp') {
    if (!cfg.smtpHost) throw new Error('SMTP host is required.');
    if (!cfg.smtpPort) throw new Error('SMTP port is required.');
    if (!cfg.smtpUser) throw new Error('SMTP username is required.');
    if (!cfg.smtpPassword) throw new Error('SMTP password is required.');
    if (!isLikelyEmail(cfg.smtpFromAddress)) throw new Error('A valid From address is required.');

    const port = Number(cfg.smtpPort);
    let secure = false;
    let requireTLS = false;
    if (cfg.smtpTransport === 'SMTPS') secure = true;
    if (cfg.smtpTransport === 'SMTP_TLS') requireTLS = true;

    const transport = nodemailer.createTransport({
      host: cfg.smtpHost,
      port,
      secure,
      requireTLS,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPassword },
    });
    return { transport, fromAddress: cfg.smtpFromAddress };
  }

  if (cfg.sendingMethod === 'spfdkim') {
    if (!isLikelyEmail(cfg.dkimFromAddress)) throw new Error('A valid From address is required.');
    if (!looksLikePemPrivateKey(cfg.dkimPrivateKey)) throw new Error('DKIM private key must be a PEM-encoded RSA key.');
    if (!cfg.dkimSelector) throw new Error('DKIM selector is required.');
    const domain = cfg.dkimFromAddress.split('@')[1];

    const transport = nodemailer.createTransport({
      host: INTERNAL_HOST,
      port: INTERNAL_PORT,
      secure: false,
      requireTLS: true,
      // Nodemailer applies this to every outgoing message.
      dkim: {
        domainName: domain,
        keySelector: cfg.dkimSelector,
        privateKey: cfg.dkimPrivateKey,
      },
    });
    return { transport, fromAddress: cfg.dkimFromAddress };
  }

  // sendingMethod === 'internal' → JSON transport. Records the message body
  // in `info.message` (a JSON string) without performing any network I/O.
  const transport = nodemailer.createTransport({ jsonTransport: true });
  return { transport, fromAddress: INTERNAL_FROM };
}

async function sendMail({ to, subject, html, text, attachments = [], headers = {} }, cfgOverride = null) {
  if (!isLikelyEmail(to)) throw new Error('Recipient email address is invalid.');
  const cfg = cfgOverride || (await EmailSettings.getSingleton());
  const built = await buildTransporter(cfg);

  const replyTo = isLikelyEmail(cfg.replyToAddress) ? cfg.replyToAddress : undefined;

  // ── SendGrid path ──────────────────────────────────────────────────────
  if (built.sendgrid) {
    const apiKey = resolveSendgridApiKey(cfg);
    sgMail.setApiKey(apiKey);

    const msg = {
      to,
      from: built.fromAddress,
      subject: subject || '(no subject)',
      html: html || undefined,
      text: text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''),
      ...(replyTo && { replyTo }),
      ...(attachments.length > 0 && { attachments }),
    };

    const [response] = await sgMail.send(msg);
    console.log(`[emailService] SendGrid → ${to} (status ${response.statusCode})`);

    return {
      messageId:   response.headers?.['x-message-id'] || '',
      accepted:    [to],
      rejected:    [],
      response:    `${response.statusCode}`,
      via:         'sendgrid',
      fromAddress: built.fromAddress,
    };
  }

  // ── Nodemailer path (internal / spfdkim / smtp) ────────────────────────
  const { transport, fromAddress } = built;

  const info = await transport.sendMail({
    from:    fromAddress,
    to,
    replyTo,
    subject: subject || '(no subject)',
    text:    text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''),
    html:    html || undefined,
    headers,
  });

  return {
    messageId:   info.messageId || '',
    accepted:    info.accepted || [],
    rejected:    info.rejected || [],
    response:    info.response || '',
    via:         cfg.sendingMethod,
    fromAddress,
  };
}

// Verifies the SMTP/DKIM transport actually negotiates a connection. Useful
// before "Save" succeeds, since the BRD says invalid SMTP / DKIM should not
// be persistable. Returns { ok, error }.
async function verifyTransport(cfgOverride = null) {
  try {
    const built = await buildTransporter(cfgOverride);
    // SendGrid has no "verify" handshake — if the API key is present we
    // consider the configuration nominally valid.
    if (built.sendgrid) return { ok: true, error: '' };
    const { transport } = built;
    if (typeof transport.verify === 'function') {
      await transport.verify();
    }
    return { ok: true, error: '' };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// SPF + DKIM DNS check.
//
// The BRD specifies two DNS pre-conditions for the "Configure SPF and DKIM"
// path:
//   1. The SPF TXT record on the From address's domain MUST include
//      `mx:antidot.net` (their internal mail server).
//   2. A DKIM TXT record at `<selector>._domainkey.<domain>` MUST exist and
//      MUST contain a `v=DKIM1` declaration.
//
// We do NOT compare the public key on the DKIM record against the private
// key held in EmailSettings — Nodemailer signs with whatever private key we
// give it, and the recipient's MTA performs the actual verification.
// ---------------------------------------------------------------------------
async function checkSpfAndDkim({ fromAddress, dkimSelector }) {
  const out = { spf: { ok: false, record: '', error: '' }, dkim: { ok: false, record: '', error: '' } };
  if (!isLikelyEmail(fromAddress)) {
    out.spf.error = 'A valid From address is required.';
    out.dkim.error = 'A valid From address is required.';
    return out;
  }
  const domain = fromAddress.split('@')[1];

  try {
    const txts = (await dns.resolveTxt(domain)).map((parts) => parts.join(''));
    const spf = txts.find((t) => /v=spf1/i.test(t));
    if (!spf) {
      out.spf.error = `No SPF record found at ${domain}.`;
    } else {
      out.spf.record = spf;
      if (/mx:antidot\.net/i.test(spf)) {
        out.spf.ok = true;
      } else {
        out.spf.error = 'SPF record does not include mx:antidot.net.';
      }
    }
  } catch (e) {
    out.spf.error = e.code === 'ENOTFOUND' ? `Domain ${domain} not found.` : e.message;
  }

  if (!dkimSelector) {
    out.dkim.error = 'DKIM selector is required.';
    return out;
  }
  try {
    const dkimHost = `${dkimSelector}._domainkey.${domain}`;
    const txts = (await dns.resolveTxt(dkimHost)).map((parts) => parts.join(''));
    const dkim = txts.find((t) => /v=DKIM1/i.test(t));
    if (!dkim) {
      out.dkim.error = `No DKIM record (v=DKIM1) found at ${dkimHost}.`;
    } else {
      out.dkim.record = dkim;
      out.dkim.ok = true;
    }
  } catch (e) {
    out.dkim.error = e.code === 'ENOTFOUND'
      ? `DKIM record not found at ${dkimSelector}._domainkey.${domain}.`
      : e.message;
  }
  return out;
}

module.exports = {
  sendMail,
  buildTransporter,
  verifyTransport,
  checkSpfAndDkim,
  isLikelyEmail,
  looksLikePemPrivateKey,
  INTERNAL_FROM,
};
