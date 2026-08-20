import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import mysql from "mysql2/promise";

async function main() {
  console.log("\n🔔 PUSH NOTIFICATION TEST\n");

  // 1. Init Firebase Admin
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error("❌ Firebase Admin credentials not configured in .env");
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, "\n"),
        clientEmail,
      }),
    });
  }
  console.log("✅ Firebase Admin initialized");

  // 2. Get registered FCM tokens from DB
  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "crm",
  });

  const [rows] = await pool.execute("SELECT * FROM fcm_tokens");
  const tokens = rows as any[];

  console.log(`📋 Found ${tokens.length} registered FCM token(s)`);

  if (tokens.length === 0) {
    console.log("\n⚠️  No FCM tokens registered. Open the app in a browser first and grant notification permission.");
    await pool.end();
    process.exit(0);
  }

  // 3. Send test notification to all tokens
  const messaging = getMessaging();
  const tokenList = tokens.map((t) => t.token);

  console.log(`\n📤 Sending test notification to ${tokenList.length} device(s)...\n`);

  const message = {
    tokens: tokenList,
    notification: {
      title: "🔔 Test Notification",
      body: "If you see this, push notifications are working!",
    },
    data: {
      type: "test",
      timestamp: new Date().toISOString(),
    },
  };

  const response = await messaging.sendEachForMulticast(message);

  console.log(`📊 Results: ${response.successCount} success, ${response.failureCount} failed\n`);

  response.responses.forEach((resp, idx) => {
    const token = tokens[idx];
    if (resp.success) {
      console.log(`  ✅ ${token.userId} — token ${token.token.slice(0, 20)}...`);
    } else {
      console.log(`  ❌ ${token.userId} — token ${token.token.slice(0, 20)}... — Error: ${resp.error?.message}`);
    }
  });

  // 4. Cleanup invalid tokens
  const failedTokens: string[] = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code === "messaging/invalid-registration-token") {
      failedTokens.push(tokens[idx].token);
    }
  });

  if (failedTokens.length > 0) {
    console.log(`\n🧹 Cleaning up ${failedTokens.length} invalid token(s)...`);
    for (const tok of failedTokens) {
      await pool.execute("DELETE FROM fcm_tokens WHERE token=?", [tok]);
    }
    console.log("✅ Invalid tokens removed");
  }

  await pool.end();
  console.log("\n✅ Done!\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
