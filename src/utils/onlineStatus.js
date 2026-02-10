// Utility for checking online/offline status

export const isOnline = () => {
  return navigator.onLine;
};

export const addOnlineListener = (callback) => {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
};

export const addOfflineListener = (callback) => {
  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
};



