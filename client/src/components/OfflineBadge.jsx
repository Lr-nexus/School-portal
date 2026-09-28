import { useEffect, useState } from 'react';
import { FiWifi, FiWifiOff } from 'react-icons/fi';

export default function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const goOnline = () => { setOnline(true); setShowToast(true); };
    const goOffline = () => { setOnline(false); setShowToast(true); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 4000);
    return () => clearTimeout(t);
  }, [showToast]);

  if (online && !showToast) return null;

  return (
    <div className={`offline-badge ${online ? 'offline-badge--online' : ''}`}>
      {online ? <FiWifi size={12} /> : <FiWifiOff size={12} />}
      <span>{online ? 'Back online' : 'Offline — showing cached data'}</span>
    </div>
  );
}