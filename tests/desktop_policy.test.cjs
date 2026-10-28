'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {
  isTrustedDocument,
  isAllowedExternal,
  isAllowedDownload,
} = require('../desktop/policy.cjs');

const entry = path.join(os.tmpdir(), 'Civil Hydration ruang uji', 'web', 'index.html');
const documentURL = pathToFileURL(entry).href;
const blobURL = 'blob:file:///81e88bf0-2ba6-47a9-8bc3-4e842c403ff2';

test('the application document permits in-page tabs while preserving its exact local path', () => {
  for (const suffix of ['', '#model', '#termal', '#ekspor', '#https://example.test/']) {
    assert.equal(isTrustedDocument(documentURL + suffix, entry), true, suffix);
  }
  assert.equal(isTrustedDocument(pathToFileURL(path.join(path.dirname(entry), 'another.html')).href, entry), false);
  assert.equal(isTrustedDocument(documentURL + '?redirect=another.html', entry), false);
  assert.equal(isTrustedDocument(documentURL + '.other', entry), false);
});

test('remote documents, active schemes, malformed URLs and sibling files cannot replace the app', () => {
  for (const url of [
    'https://github.com/',
    'http://127.0.0.1/index.html',
    'file://attacker.example/share/index.html',
    pathToFileURL(path.join(path.dirname(entry), '..', 'outside.html')).href,
    'javascript:alert(1)',
    'data:text/html,<h1>Remote app</h1>',
    'about:blank',
    blobURL,
    '/relative/index.html',
    '', null, undefined,
  ]) assert.equal(isTrustedDocument(url, entry), false, String(url));
});

test('only explicit HTTPS GitHub references can leave the application', () => {
  for (const url of [
    'https://github.com/',
    'https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC',
    'https://github.com/MIDASIT-Co-Ltd/midas-civil-python/blob/main/example.py#L20',
    'https://github.com:443/owner/repo?tab=readme-ov-file',
    'https://GITHUB.COM/owner/repo',
  ]) assert.equal(isAllowedExternal(url), true, url);
});

test('external links reject credential phishing, lookalike hosts, alternate ports and shell schemes', () => {
  for (const url of [
    'http://github.com/owner/repo',
    'https://github.com:444/owner/repo',
    'https://github.com.attacker.example/owner/repo',
    'https://attacker.github.com/',
    'https://github.com@attacker.example/',
    'https://user:password@github.com/owner/repo',
    'https://user@github.com/',
    'https://github.com./owner/repo',
    'https://github.com%2eattacker.example/',
    'mailto:help@example.test',
    'file:///C:/Windows/System32/cmd.exe',
    'javascript:alert(1)',
    'data:text/html,example',
    'ms-settings:privacy',
    '//github.com/owner/repo',
    '', null, undefined,
  ]) assert.equal(isAllowedExternal(url), false, String(url));
});

test('local Blob exports accept the actual application file types without changing extension case', () => {
  for (const filename of [
    'PILAR_HEAT_HYDRATION.MCT',
    'PARAMETER_HEAT_HYDRATION.json',
    'RINGKASAN_INPUT_HIDRASI.txt',
    'Pilar tahap 2.mct',
    'Parameter revisi.JSON',
  ]) assert.equal(isAllowedDownload(blobURL, filename), true, filename);
});

test('downloads reject remote origins, executable payloads, traversal and Windows alternate streams', () => {
  for (const url of [
    'https://github.com/example/model.MCT',
    'file:///C:/private/model.MCT',
    'blob:https://attacker.example/81e88bf0',
    'blob:http://127.0.0.1/81e88bf0',
    'blob:null/81e88bf0',
    'data:text/plain,model',
    '', null, undefined,
  ]) assert.equal(isAllowedDownload(url, 'PILAR.MCT'), false, String(url));

  for (const filename of [
    'installer.exe',
    'model.MCT.exe',
    'payload.cmd',
    '.MCT',
    '../outside.MCT',
    '..\\outside.MCT',
    'folder/model.MCT',
    'folder\\model.MCT',
    'C:\\model.MCT',
    'model:alternate.MCT',
    'model\n.MCT',
    'model\u0000.MCT',
    'model.MCT.',
    'x'.repeat(201) + '.MCT',
    '', null, undefined,
  ]) assert.equal(isAllowedDownload(blobURL, filename), false, String(filename));
});
