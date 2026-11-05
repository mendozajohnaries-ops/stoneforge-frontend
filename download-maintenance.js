/* Manual download pause. The backend independently enforces release readiness. */
(function (root) {
  'use strict';
  const policy = Object.freeze({
    enabled: false,
    label: 'Under Maintenance',
    message: 'StoneForge downloads are temporarily unavailable. Please try again later.'
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = policy;
  else root.StoneForgeDownloadMaintenance = policy;
})(typeof window !== 'undefined' ? window : globalThis);
