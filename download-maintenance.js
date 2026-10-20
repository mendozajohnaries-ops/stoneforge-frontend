/* Keep downloads paused until the fixed builds have been tested and released. */
(function (root) {
  'use strict';
  const policy = Object.freeze({
    enabled: true,
    label: 'Under Maintenance',
    message: 'Demo and Full Game downloads are under maintenance and will unlock next week. We are fixing issues found during testing. Thank you for your patience!'
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = policy;
  else root.StoneForgeDownloadMaintenance = policy;
})(typeof window !== 'undefined' ? window : globalThis);
