import "server-only";

import webpush from "web-push";

let configured = false;

export const getWebPush = () => {
  if (!configured) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      throw new Error("VAPID environment variables are not configured.");
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return webpush;
};

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

export const sendPushNotification = async (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
) => {
  const push = getWebPush();
  await push.sendNotification(subscription, JSON.stringify(payload));
};
