'use strict';
const {pathToFileURL} = require('node:url');

function isTrustedDocument(value, entryPath) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href === pathToFileURL(entryPath).href;
  } catch { return false; }
}

function isAllowedExternal(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' &&
      !url.username && !url.password && !url.port;
  } catch { return false; }
}

function isAllowedDownload(value, filename) {
  return typeof value === 'string' && value.startsWith('blob:file:///') &&
    typeof filename === 'string' && filename.length <= 200 &&
    !/[\\/\x00-\x1f:]/.test(filename) && !filename.startsWith('.') &&
    /\.(mct|json|txt)$/i.test(filename);
}

module.exports = {isTrustedDocument, isAllowedExternal, isAllowedDownload};
