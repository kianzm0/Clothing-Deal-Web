const { spawnSync } = require('node:child_process');
// A merge must not replace the live application with code requiring unapplied migrations.
// This is read-only: operators apply migrations to the intended database separately.
if (process.env.VERCEL_ENV === 'production' || process.env.REQUIRE_DATABASE_SCHEMA === 'true') {
  if (!process.env.DATABASE_URL) {
    console.error('Production deployment requires DATABASE_URL and applied migrations.');
    process.exit(1);
  }
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'status'], { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error('Production deployment stopped. Review and apply pending migrations before redeploying.');
    process.exit(1);
  }
}
