'use strict';
// Build importable examples through the same validated engine as the app.
const fs = require('node:fs');
const path = require('node:path');
const E = require('../web/engine.js');
const output = path.join(__dirname, '..', 'dist');
fs.mkdirSync(output, {recursive: true});
const config = E.defaults();
const model = E.build(config);
fs.writeFileSync(path.join(output, 'PILAR_TIME_DEPENDENT_EXAMPLE.MCT'), model.text);
fs.writeFileSync(path.join(output, 'PARAMETER_TIME_DEPENDENT_EXAMPLE.json'), JSON.stringify({
  schema: 'civil-heat-studio/v1',
  config,
  reference: {note: 'Contoh input yang dapat diedit; bukan jobmix terukur atau hasil analisis. Default CEB-FIP 1990 dihubungkan ke FC_NEW; FC_OLD tetap material matang konstan.'}
}, null, 2) + '\n');
console.log('Built MCT and JSON examples with time-dependent definitions and material links.');
const rectangular = E.defaults();
rectangular.geometry.shape = 'rectangular';
const sizes = E.geometryInfo(rectangular);
rectangular.timeDependent.notionalSize = sizes.notionalSize;
rectangular.timeDependent.volumeSurface = sizes.volumeSurface;
fs.writeFileSync(path.join(output, 'PILAR_RECTANGULAR_EXAMPLE.MCT'), E.build(rectangular).text);
fs.writeFileSync(path.join(output, 'PARAMETER_RECTANGULAR_EXAMPLE.json'), JSON.stringify({
  schema: 'civil-heat-studio/v1', config: rectangular,
  reference: {note: 'Contoh rectangular B=6m, L=4m; asumsi parameter belum dikalibrasi. Ukuran C&S dihitung dari paparan sisi saja; muka ujung diabaikan.'}
}, null, 2) + '\n');
console.log('Built rectangular MCT and JSON examples.');
