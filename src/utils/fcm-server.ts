import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as dao from '../db/dao';

let fcmInitialized = false;

export function initFirebaseAdmin() {
  if (fcmInitialized) return;
  if (getApps().length > 0) { fcmInitialized = true; return; }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!projectId || !privateKey || !clientEmail) {
    console.warn('[FCM] Firebase Admin not configured (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL). Push notifications disabled.');
    return;
  }
  try {
    initializeApp({
      credential: cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      }),
    });
    fcmInitialized = true;
    console.log('[FCM] Firebase Admin initialized successfully.');
  } catch (err) {
    console.error('[FCM] Failed to initialize Firebase Admin:', err);
  }
}

export async function sendFCMToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
  if (!fcmInitialized) return;
  try {
    const tokens = await dao.getFCMTokensByUserId(userId);
    if (!tokens.length) return;
    const tokenList = tokens.map(t => t.token);
    const messaging = getMessaging();
    const message = {
      tokens: tokenList,
      notification: { title, body },
      data: data || {},
    };
    const response = await messaging.sendEachForMulticast(message);
    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
        failedTokens.push(tokenList[idx]);
      }
    });
    if (failedTokens.length > 0) {
      for (const tok of failedTokens) {
        await dao.unregisterFCMToken(tok);
      }
      console.log(`[FCM] Removed ${failedTokens.length} invalid tokens for user ${userId}`);
    }
  } catch (err) {
    console.error(`[FCM] Error sending push to user ${userId}:`, err);
  }
}

export async function sendFCMToMultipleUsers(userIds: string[], title: string, body: string, data?: Record<string, string>) {
  if (!fcmInitialized || userIds.length === 0) return;
  await Promise.all(userIds.map(uid => sendFCMToUser(uid, title, body, data).catch(e => console.error('[FCM] send failed:', e))));
}
