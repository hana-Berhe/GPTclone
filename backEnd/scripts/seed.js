// Fills the database with demo users and conversations, e.g. for screenshots.
// Usage (in the backEnd folder): npm run db:seed
// Optional: SEED_PASSWORD=YourPassword npm run db:seed
import "dotenv/config";
import { db } from "../schema/db.config.js";
import { seedDemoData } from "../schema/seed.js";

const password = process.env.SEED_PASSWORD || "Demo1234!";
if (password.length < 8) {
  console.error("SEED_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

console.log(`Seeding demo data into "${process.env.DB_NAME}" on ${process.env.DB_HOST}...`);

try {
  const summary = await seedDemoData({ password });

  console.log("\n✓ Done. Log in with any of these accounts:\n");
  for (const user of summary) {
    console.log(`  ${user.name.padEnd(14)} ${user.email.padEnd(20)} ${user.chats} chats, ${user.messages} messages`);
  }
  console.log(`\n  Password for all demo accounts: ${password}`);
  console.log("\nRun it again any time to reset the demo chats. Other users are never changed.");
} catch (error) {
  console.error(`\n✗ Seeding failed: ${error.message}`);
  console.error("  Run `npm run db:check` to test the database connection.");
  process.exitCode = 1;
} finally {
  await db.end?.().catch(() => {});
}
