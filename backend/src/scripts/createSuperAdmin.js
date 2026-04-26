/**
 * One-off: create or promote a super-admin account.
 *
 * Defaults are taken from CLI args / env vars so this script can be reused
 * later without editing source. Run with:
 *
 *   node src/scripts/createSuperAdmin.js [email] [password] [name]
 *
 * Examples:
 *   node src/scripts/createSuperAdmin.js
 *   node src/scripts/createSuperAdmin.js admin@example.com 'StrongPass!1' 'Site Owner'
 */
require('../config/env');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function main() {
  const email    = (process.argv[2] || process.env.SUPERADMIN_EMAIL    || 'superadmin@fluidtopics.local').toLowerCase();
  const password =  process.argv[3] || process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
  const name     =  process.argv[4] || process.env.SUPERADMIN_NAME     || 'Super Admin';

  await connectDB();

  let user = await User.findOne({ email }).select('+password');

  if (user) {
    user.role = 'superadmin';
    user.isActive = true;
    user.emailVerified = true;
    user.lockedUntil = null;
    user.failedLogins = 0;
    if (process.argv[3] || process.env.SUPERADMIN_PASSWORD) {
      user.password = password; // re-hashed via pre-save hook
    }
    await user.save();
    console.log(`✅ Promoted existing user to superadmin: ${email}`);
  } else {
    user = await User.create({
      name,
      email,
      password,
      role: 'superadmin',
      isActive: true,
      emailVerified: true,
    });
    console.log(`✅ Created new superadmin: ${email}`);
  }

  console.log('────────────────────────────────────────');
  console.log(' Super-admin credentials');
  console.log('────────────────────────────────────────');
  console.log(` Email:    ${email}`);
  console.log(` Password: ${password}`);
  console.log(` Name:     ${user.name}`);
  console.log(` Role:     ${user.role}`);
  console.log('────────────────────────────────────────');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Failed to create superadmin:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
