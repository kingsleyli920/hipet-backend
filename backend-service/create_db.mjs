import { Client } from "pg";

const host = "hipet-db-sandbox.c9wk4im2cddc.us-west-1.rds.amazonaws.com";
const user = "hipet";
const password = "8iY0EYb8gDzTLs5kIpbG";   // ← 换成你的新密码
const port = 5432;

// 先连到默认库 postgres
const client = new Client({
  host, user, password, port, database: "postgres",
  ssl: { rejectUnauthorized: false } // 等价于 sslmode=require
});

async function main() {
  await client.connect();
  // 如果库已存在不报错
  await client.query('CREATE DATABASE "hipet" WITH OWNER "hipet"');
  console.log("✅ Database 'hipet' created or already exists.");
  await client.end();
}
main().catch(async (e) => { console.error(e); try { await client.end(); } catch {} process.exit(1); });
