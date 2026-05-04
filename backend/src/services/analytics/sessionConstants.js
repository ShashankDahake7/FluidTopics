'use strict';

/** Gap after which a new analytics “session” starts when `sessionId` is absent (browser / API). */
const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

function actorKeyForEvent(ev) {
  if (ev.userId) return `uid:${String(ev.userId)}`;
  return `ip:${ev.ip || 'none'}`;
}

/**
 * Assign a stable session key per analytics event for Traffic charts.
 * Mirrors `sessionListService`: explicit `sessionId` is split on inactivity; missing id uses actor + gap.
 *
 * @param {Array<{ _id: import('mongoose').Types.ObjectId, sessionId?: string, userId?: unknown, ip?: string, timestamp: Date }>} events
 * @returns {Map<string, string>} map from event `_id` string to resolved session key
 */
function resolveSessionKeys(events) {
  const out = new Map();

  const withSid = events.filter((e) => e.sessionId && String(e.sessionId).trim());
  withSid.sort((a, b) => {
    const sa = String(a.sessionId);
    const sb = String(b.sessionId);
    if (sa !== sb) return sa < sb ? -1 : 1;
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
  const segBySid = new Map();
  for (const ev of withSid) {
    const sid = String(ev.sessionId).trim();
    const t = new Date(ev.timestamp).getTime();
    const prev = segBySid.get(sid);
    let ord;
    if (!prev || t - prev.lastTs > SESSION_INACTIVITY_MS) {
      ord = (prev ? prev.ord : 0) + 1;
    } else {
      ord = prev.ord;
    }
    segBySid.set(sid, { lastTs: t, ord });
    out.set(String(ev._id), `${sid}::seg::${ord}`);
  }

  const withoutSid = events.filter((e) => !e.sessionId || !String(e.sessionId).trim());
  const sorted = [...withoutSid].sort((a, b) => {
    const da = actorKeyForEvent(a);
    const db = actorKeyForEvent(b);
    if (da !== db) return da < db ? -1 : 1;
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
  const state = new Map();
  for (const ev of sorted) {
    const idStr = String(ev._id);
    const ak = actorKeyForEvent(ev);
    const t = new Date(ev.timestamp).getTime();
    const st = state.get(ak);
    let ord;
    if (!st || t - st.lastTs > SESSION_INACTIVITY_MS) {
      ord = (st ? st.ord : 0) + 1;
      state.set(ak, { lastTs: t, ord });
    } else {
      ord = st.ord;
      state.set(ak, { lastTs: t, ord });
    }
    out.set(idStr, `${ak}::synth::${ord}`);
  }
  return out;
}

module.exports = {
  SESSION_INACTIVITY_MS,
  actorKeyForEvent,
  resolveSessionKeys,
};
