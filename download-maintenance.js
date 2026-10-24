/* Keep downloads paused until the fixed builds have been tested and released. */
(function (root) {
  'use strict';
  const policy = Object.freeze({
    enabled: true,
    label: 'Under Maintenance',
    message: 'StoneForge downloads are temporarily paused while we prepare and test the unified build.'
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = policy;
  else root.StoneForgeDownloadMaintenance = policy;
})(typeof window !== 'undefined' ? window : globalThis);
