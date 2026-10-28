'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomBytes} = require('node:crypto');
const engine = require('../web/engine.js');
const MAX_BYTES = 2 * 1024 * 1024;

function jsonPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw Error('Lokasi file JSON tidak valid.');
  const extension = path.extname(value);
  if (!extension) return value + '.json';
  if (extension.toLowerCase() !== '.json') throw Error('File proyek harus memakai ekstensi .json.');
  return value;
}

function validateText(value) {
  if (typeof value !== 'string') throw Error('Isi proyek harus berupa JSON teks.');
  if (Buffer.byteLength(value, 'utf8') > MAX_BYTES) throw Error('Ukuran file proyek melebihi batas 2 MiB.');
  const text = value.replace(/^\uFEFF/, '');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw Error('File bukan JSON yang valid.'); }
  const config = engine.cleanConfig(parsed);
  const validation = engine.validate(config);
  if (validation.errors.length) throw Error(validation.errors.slice(0, 5).map(x => x.message).join('\n'));
  return {text, config};
}

async function readProject(filename, operations = fs) {
  const filePath = jsonPath(filename);
  const metadata = await operations.stat(filePath);
  if (!metadata.isFile()) throw Error('Pilih file proyek JSON.');
  if (metadata.size > MAX_BYTES) throw Error('Ukuran file proyek melebihi batas 2 MiB.');
  const result = validateText(await operations.readFile(filePath, 'utf8'));
  return {...result, filePath, name: path.basename(filePath)};
}

async function writeProject(filename, value, operations = fs) {
  const filePath = jsonPath(filename);
  const {text, config} = validateText(value);
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`);
  let handle;
  try {
    handle = await operations.open(temporary, 'wx', 0o600);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close(); handle = null;
    // Rename replaces the destination only after the entire new document is durable.
    await operations.rename(temporary, filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await operations.unlink(temporary).catch(() => {});
    throw error;
  }
  return {filePath, name: path.basename(filePath), config};
}

module.exports = {MAX_BYTES, jsonPath, validateText, readProject, writeProject};
