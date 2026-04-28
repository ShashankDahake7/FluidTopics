const mongoose = require('mongoose');

// Singleton holding the General-tab knobs of the Authentication admin page.
//
//   - requireAuth                 : Mandatory authentication for the portal.
//   - openSsoInCurrentWindow      : When true the SSO login/logout page opens
//                                   in the current window (default: open in
//                                   a new window per the BRD).
//   - hideCredentialsFormIfSso    : When true, /login hides email/password
//                                   when at least one SSO realm exists. Users
//                                   can still hit /login?direct=true.
//   - logoutRedirectUrl           : URL to redirect users to after logout.
//   - hideNativeLogout            : Hides the native logout button (classic
//                                   header only).
//   - idleTimeoutEnabled          : When false the idle-timeout never fires.
//   - idleTimeoutMinutes          : Minutes of inactivity that trigger
//                                   logout. Min 30 per the BRD; default 30.
//   - rememberMeDays              : Maximum lifetime of a "Remember me"
//                                   session (default 30 — the BRD constant).
//   - mfaGraceDays                : Grace period before MFA is enforced.
//
// Updates are written by ADMIN or PORTAL_ADMIN tier and audit-logged.
const authSettingsSchema = new mongoose.Schema(
  {
    _id:                         { type: String, default: 'auth-settings' },
    requireAuth:                 { type: Boolean, default: false },
    openSsoInCurrentWindow:      { type: Boolean, default: false },
    hideCredentialsFormIfSso:    { type: Boolean, default: false },
    logoutRedirectUrl:           { type: String, default: '' },
    hideNativeLogout:            { type: Boolean, default: false },
    idleTimeoutEnabled:          { type: Boolean, default: true },
    idleTimeoutMinutes:          { type: Number, default: 30, min: 30 },
    rememberMeDays:              { type: Number, default: 30 },
    mfaGraceDays:                { type: Number, default: 7 },
  },
  { timestamps: true, _id: false }
);

authSettingsSchema.statics.getSingleton = async function () {
  const existing = await this.findById('auth-settings');
  if (existing) return existing;
  return this.create({ _id: 'auth-settings' });
};

module.exports = mongoose.models.AuthSettings
  || mongoose.model('AuthSettings', authSettingsSchema);
