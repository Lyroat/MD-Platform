const { Client } = require("pg");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

const connectionString = process.env.USER_POSTGRESQL_URL;
console.log("DB URL:", connectionString ? "set" : "not set");

if (!connectionString) {
  console.log("Missing USER_POSTGRESQL_URL");
  process.exit(1);
}

const sqlFile = process.argv[2] || "supabase/migrations/20260623100000_user_roles.sql";
const sql = fs.readFileSync(sqlFile, "utf8");

(async () => {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log("Connected to database");
    await client.query(sql);
    console.log("Migration executed successfully");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
})();
