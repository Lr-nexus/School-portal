import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/api';

const SW_URL = '/service-worker.js';

/* Convert the base64 VAPID key the server gives us */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);

    // Check whether we already have a subscription
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) throw new Error('Push not supported in this browser');
    setBusy(true);
    setError('');

    try {
      // 1. Ask permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        throw new Error('Permission denied');
      }

      // 2. Get the VAPID public key from the server
      const { publicKey } = await api('/push/vapid-public-key');
      if (!publicKey) throw new Error('Server has no VAPID key configured');

      // 3. Get or create the push subscription
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      // 4. Send it to the server
      await api('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(sub.toJSON()),
      });

      setSubscribed(true);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api('/push/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    return api('/push/test', { method: 'POST' });
  }, []);

  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  };
}