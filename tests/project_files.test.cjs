'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const E = require('../web/engine.js');
const {MAX_BYTES, jsonPath, validateText, readProject, writeProject} = require('../desktop/project-files.cjs');
const document = config => JSON.stringify({schema: 'civil-heat-studio/v1', config});

test('project parsing validates real engine values and preserves legacy parameter format', () => {
  assert.equal(validateText(document(E.defaults())).config.geometry.diameter, 7.5);
  const legacy = E.defaults(); delete legacy.thermal; delete legacy.thermalComponents;
  assert.equal(validateText('\ufeff' + document(legacy)).config.thermal.cpMode, 'manual');
  assert.throws(() => validateText('{ broken'), /JSON/);
  assert.throws(() => validateText(' '.repeat(MAX_BYTES + 1)), /2 MiB/);
  const invalid = E.defaults(); invalid.geometry.diameter = -1;
  assert.throws(() => validateText(document(invalid)));
  assert.throws(() => validateText('{}'));
  assert.throws(() => jsonPath('model.MCT'), /\.json/);
  assert.equal(jsonPath('model'), 'model.json');
});

test('Save and Save As write editable JSON and preserve the previous file when selecting another path', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hydration-project-'));
  try {
    const first = path.join(directory, 'original.json'), second = path.join(directory, 'salinan.json');
    const config = E.defaults();
    await writeProject(first, document(config));
    config.material.cp = 1.1;
    await writeProject(first, document(config));
    assert.equal((await readProject(first)).config.material.cp, 1.1);
    config.material.cp = 1.2;
    const result = await writeProject(second, document(config));
    assert.equal(result.name, 'salinan.json');
    assert.equal((await readProject(first)).config.material.cp, 1.1);
    assert.equal((await readProject(second)).config.material.cp, 1.2);
    assert.deepEqual((await fs.readdir(directory)).sort(), ['original.json', 'salinan.json']);
  } finally { await fs.rm(directory, {recursive: true, force: true}); }
});

test('failed atomic replacement leaves original content intact and removes temporary data', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hydration-write-fail-'));
  try {
    const target = path.join(directory, 'project.json'), original = document(E.defaults());
    await fs.writeFile(target, original);
    const modified = E.defaults(); modified.material.cp = 1.25;
    await assert.rejects(writeProject(target, document(modified), {...fs,
      rename: async () => { throw Object.assign(Error('disk replacement denied'), {code: 'EACCES'}); }
    }), /replacement denied/);
    assert.equal(await fs.readFile(target, 'utf8'), original);
    assert.deepEqual(await fs.readdir(directory), ['project.json']);
    await assert.rejects(writeProject(target, document(modified), {...fs,
      open: async (...args) => {
        const handle = await fs.open(...args);
        return {
          writeFile: async () => { await handle.writeFile('{partial'); throw Error('disk full during write'); },
          sync: () => handle.sync(), close: () => handle.close()
        };
      }
    }), /disk full/);
    assert.equal(await fs.readFile(target, 'utf8'), original);
    assert.deepEqual(await fs.readdir(directory), ['project.json']);
    await assert.rejects(writeProject(target, '{invalid'));
    assert.equal(await fs.readFile(target, 'utf8'), original);
  } finally { await fs.rm(directory, {recursive: true, force: true}); }
});

test('oversized or invalid opened documents are rejected before being returned', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hydration-read-fail-'));
  try {
    const target = path.join(directory, 'project.json');
    await fs.writeFile(target, ' '.repeat(MAX_BYTES + 1));
    await assert.rejects(readProject(target), /2 MiB/);
    await fs.writeFile(target, JSON.stringify({schema: 'unknown/v2', config: E.defaults()}));
    await assert.rejects(readProject(target), /Versi/);
  } finally { await fs.rm(directory, {recursive: true, force: true}); }
});
