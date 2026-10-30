'use strict';
// Windows: node tests/desktop_smoke.cjs dist/win-unpacked/CivilHydrationNX.exe
// Linux CI uses Xvfb; --no-sandbox is a test-runner argument, never an app default.
const {_electron} = require('playwright');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const {setTimeout: delay} = require('node:timers/promises');

(async () => {
  const root = path.resolve(__dirname, '..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'civil-desktop-test-'));
  const executable = process.argv[2] && path.resolve(process.argv[2]);
  const profile = path.join(temporary, 'profile');
  const projectA = path.join(temporary, 'Pilar asli.json');
  const projectB = path.join(temporary, 'Pilar salinan.json');
  const projectC = path.join(temporary, 'Pilar dibuka.json');
  const invalidProject = path.join(temporary, 'invalid.json');
  let application;
  const errors = [];

  async function launch() {
    const args = [`--user-data-dir=${profile}`];
    if (process.platform === 'linux') args.push('--no-sandbox');
    if (!executable) args.push(root);
    application = await _electron.launch({executablePath: executable || require('electron'), args, timeout: 60000});
    const page = await application.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => !!window.hydrationDesktop && !!window.CivilHydrationProject);
    await installDialogStubs();
    return page;
  }

  async function installDialogStubs() {
    await application.evaluate(({dialog}) => {
      globalThis.desktopDialogs = {save: [], open: [], message: [], calls: [], unexpected: []};
      dialog.showSaveDialog = async (...args) => {
        const options = args.at(-1), state = globalThis.desktopDialogs;
        state.calls.push({kind: 'save', options});
        const next = state.save.shift();
        return next ? {canceled: false, filePath: next} : {canceled: true};
      };
      dialog.showOpenDialog = async (...args) => {
        const options = args.at(-1), state = globalThis.desktopDialogs;
        state.calls.push({kind: 'open', options});
        const next = state.open.shift();
        return next ? {canceled: false, filePaths: [next]} : {canceled: true, filePaths: []};
      };
      dialog.showMessageBox = async (...args) => {
        const options = args.at(-1), state = globalThis.desktopDialogs;
        state.calls.push({kind: 'message', options});
        const choice = state.message.shift() || 'cancel';
        const buttons = options.buttons || [];
        let response = buttons.findIndex(label => {
          if (choice === 'cancel') return /batal|cancel/i.test(label);
          if (choice === 'discard') return /jangan|abaikan|discard|tidak/i.test(label);
          return /simpan|save/i.test(label) && !/jangan|abaikan|discard|tidak/i.test(label);
        });
        if (response < 0) response = options.cancelId ?? 0;
        return {response, checkboxChecked: false};
      };
      dialog.showErrorBox = (title, content) => {
        globalThis.desktopDialogs.unexpected.push({title, content});
      };
    });
  }

  async function queue(kind, answer) {
    await application.evaluate((_electron, {kind, answer}) => {
      globalThis.desktopDialogs[kind].push(answer);
    }, {kind, answer});
  }

  async function calls(kind) {
    return application.evaluate((_electron, kind) => globalThis.desktopDialogs.calls.filter(call => call.kind === kind), kind);
  }

  async function waitSaved(page, name) {
    await page.waitForFunction(name => document.querySelector('#project-file-name').textContent === name &&
      document.querySelector('#project-dirty').hidden && document.querySelector('#save-status').textContent === 'Tersimpan ke file', name);
  }

  async function setCp(page, value) {
    await page.locator('[data-workspace="termal"]').first().click();
    await page.locator('[data-key="thermal.cpMode"]').selectOption('manual');
    await page.locator('[data-key="material.cp"]').fill(String(value));
    await page.locator('[data-key="material.cp"]').dispatchEvent('change');
    await page.waitForFunction(value => +document.querySelector('[data-key="material.cp"]').value === value &&
      !document.querySelector('#project-dirty').hidden, value);
  }

  async function save(page) {
    return page.evaluate(() => window.CivilHydrationProject.save());
  }

  async function open(page, file) {
    await queue('open', file);
    await page.locator('#import-json').click();
  }

  async function invokeMenu(accelerator) {
    await application.evaluate(({Menu}, accelerator) => {
      const find = menu => {
        for (const item of menu.items) {
          if (item.accelerator === accelerator) return item;
          if (item.submenu) { const found = find(item.submenu); if (found) return found; }
        }
      };
      const item = find(Menu.getApplicationMenu());
      if (!item) throw new Error('Missing menu accelerator: ' + accelerator);
      item.click();
    }, accelerator);
  }

  async function download(page, button, filename, cancel = false) {
    const destination = path.join(temporary, filename);
    await application.evaluate(({session}, {destination, cancel}) => {
      globalThis.desktopDownload = null;
      session.defaultSession.once('will-download', (_event, item) => {
        const options = item.getSaveDialogOptions();
        globalThis.desktopDownload = {filename: item.getFilename(), url: item.getURL(), options, state: 'pending'};
        item.once('done', (_event, state) => { globalThis.desktopDownload.state = state; });
        if (cancel) item.cancel();
        else item.setSavePath(destination);
      });
    }, {destination, cancel});
    await page.locator('#' + button).click();
    for (let i = 0; i < 120; i++) {
      const result = await application.evaluate(() => globalThis.desktopDownload);
      if (result && result.state !== 'pending') {
        assert.equal(result.state, cancel ? 'cancelled' : 'completed', JSON.stringify(result));
        assert.ok(result.options.title.startsWith('Simpan '));
        assert.ok(result.options.filters.length >= 1);
        return cancel ? result : await fs.readFile(destination, 'utf8');
      }
      await delay(100);
    }
    throw new Error('Export did not complete: ' + button);
  }

  async function closeWindow() {
    const closed = application.waitForEvent('close');
    await application.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].close());
    await closed;
    application = null;
  }

  try {
    let page = await launch();
    await page.waitForFunction(() => document.querySelector('#thermal-cp-active').textContent === '0,900000');
    assert.equal(await page.evaluate(() => typeof require), 'undefined');
    assert.equal(await page.evaluate(() => typeof process), 'undefined');
    assert.equal(await page.locator('#metrics-elements').innerText(), '24.576');
    assert.equal(await page.locator('[data-key="timeDependent.enabled"]').inputValue(), 'yes');
    assert.equal(await page.locator('#convection-guide-table tr').count(), 6);
    assert.equal(await page.locator('#convection-help-air').getAttribute('data-status'), 'reference');
    assert.equal(await page.locator('#convection-help-form').getAttribute('data-status'), 'custom');
    const security = await application.evaluate(({BrowserWindow}) => {
      const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return {sandbox: preferences.sandbox, nodeIntegration: preferences.nodeIntegration,
        contextIsolation: preferences.contextIsolation, webSecurity: preferences.webSecurity};
    });
    assert.deepEqual(security, {sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true});
    const sample = await page.evaluate(() => URL.createObjectURL(new Blob(['local'])));
    assert.equal(require('../desktop/policy.cjs').isAllowedDownload(sample, 'TEST.MCT'), true);

    // A project receives its path on its first Save, then overwrites that path.
    assert.equal(await page.locator('#project-file-name').innerText(), 'Tanpa nama.json');
    await queue('save', projectA);
    await page.locator('#export-json').click();
    await waitSaved(page, path.basename(projectA));
    assert.equal(JSON.parse(await fs.readFile(projectA, 'utf8')).schema, 'civil-heat-studio/v1');
    assert.equal(JSON.parse(await fs.readFile(projectA, 'utf8')).config.timeDependent.creepModel, 'CEB1990');
    assert.equal((await calls('save')).length, 1);
    await setCp(page, 1.11);
    await page.waitForFunction(() => document.title.includes('*'));
    assert.equal(await save(page), true);
    await waitSaved(page, path.basename(projectA));
    assert.equal(JSON.parse(await fs.readFile(projectA, 'utf8')).config.material.cp, 1.11);
    assert.equal((await calls('save')).length, 1, 'Save must not ask for another path');
    const originalA = await fs.readFile(projectA, 'utf8');

    // Save As changes the active path while preserving the original file byte-for-byte.
    await setCp(page, 1.12);
    await queue('save', projectB);
    await invokeMenu('Ctrl+Shift+S');
    await waitSaved(page, path.basename(projectB));
    assert.equal(await fs.readFile(projectA, 'utf8'), originalA);
    assert.equal(JSON.parse(await fs.readFile(projectB, 'utf8')).config.material.cp, 1.12);
    const beforeCancelledSaveAs = await fs.readFile(projectB, 'utf8');
    await setCp(page, 1.13);
    await queue('save', null);
    await page.locator('#save-as').click();
    await page.waitForFunction(() => document.querySelector('#export-status').textContent.includes('dibatalkan'));
    assert.equal(await page.locator('#project-file-name').innerText(), path.basename(projectB));
    assert.equal(await fs.readFile(projectB, 'utf8'), beforeCancelledSaveAs);
    const saveDialogCount = (await calls('save')).length;
    await invokeMenu('Ctrl+S');
    await waitSaved(page, path.basename(projectB));
    assert.equal((await calls('save')).length, saveDialogCount);
    assert.equal(JSON.parse(await fs.readFile(projectB, 'utf8')).config.material.cp, 1.13);
    assert.equal(await fs.readFile(projectA, 'utf8'), originalA);

    // A failed Save As preserves both the active filename and its saved contents.
    const beforeFailedSaveAs = await fs.readFile(projectB, 'utf8');
    await setCp(page, 1.135);
    await queue('save', path.join(temporary, 'missing-parent', 'Cannot save.json'));
    await page.locator('#save-as').click();
    await page.waitForFunction(() => document.querySelector('#export-status').textContent.includes('Proyek belum disimpan'));
    assert.equal(await page.locator('#project-file-name').innerText(), path.basename(projectB));
    assert.equal(await fs.readFile(projectB, 'utf8'), beforeFailedSaveAs);
    const failedSaveDialogCount = (await calls('save')).length;
    assert.equal(await save(page), true);
    await waitSaved(page, path.basename(projectB));
    assert.equal((await calls('save')).length, failedSaveDialogCount);
    assert.equal(JSON.parse(await fs.readFile(projectB, 'utf8')).config.material.cp, 1.135);
    assert.equal(await fs.readFile(projectA, 'utf8'), originalA);

    // Existing JSONs open via the native picker, retain their filename, and save edits in place.
    const example = JSON.parse(await fs.readFile(path.join(root, 'examples', 'THERMAL_EC2_REFERENCE.json'), 'utf8'));
    await fs.writeFile(projectC, JSON.stringify(example, null, 2));
    await open(page, projectC);
    await waitSaved(page, path.basename(projectC));
    assert.equal(await page.locator('[data-key="thermal.cpMode"]').inputValue(), 'ec2_dry');
    await setCp(page, 1.14);
    assert.equal(await save(page), true);
    assert.equal(JSON.parse(await fs.readFile(projectC, 'utf8')).config.material.cp, 1.14);
    const preservedC = await fs.readFile(projectC, 'utf8');
    await fs.writeFile(invalidProject, '{ this is not JSON');
    await open(page, invalidProject);
    await page.waitForFunction(() => document.querySelector('#export-status').textContent.includes('JSON tidak dimuat'));
    assert.equal(await page.locator('#project-file-name').innerText(), path.basename(projectC));
    assert.equal(await fs.readFile(projectC, 'utf8'), preservedC);
    assert.equal(await page.locator('[data-key="material.cp"]').inputValue(), '1.14');

    // Closing a dirty project can be cancelled without losing work.
    await setCp(page, 1.15);
    await queue('message', 'cancel');
    const closeMessages = (await calls('message')).length;
    await application.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].close());
    for (let i = 0; i < 50 && (await calls('message')).length === closeMessages; i++) await delay(100);
    assert.equal((await calls('message')).length, closeMessages + 1);
    assert.equal(page.isClosed(), false);
    assert.equal(await page.locator('[data-key="material.cp"]').inputValue(), '1.15');
    assert.equal(await fs.readFile(projectC, 'utf8'), preservedC);

    // Dirty Open can also be cancelled before replacing the working project.
    await queue('message', 'cancel');
    await open(page, projectB);
    await delay(300);
    assert.equal(await page.locator('#project-file-name').innerText(), path.basename(projectC));
    assert.equal(await page.locator('[data-key="material.cp"]').inputValue(), '1.15');
    // Remove an unconsumed picker answer if the guard ran before the picker.
    await application.evaluate(() => {globalThis.desktopDialogs.open.length = 0;});
    // Save from the dirty-Open prompt must finish before replacing the active project.
    await queue('message', 'save');
    await open(page, projectB);
    await waitSaved(page, path.basename(projectB));
    assert.equal(JSON.parse(await fs.readFile(projectC, 'utf8')).config.material.cp, 1.15);
    assert.equal(await page.locator('[data-key="material.cp"]').inputValue(), '1.135');

    // All calculations and MCT/TXT exports continue to use the edited project.
    await page.locator('[data-key="thermal.cpMode"]').selectOption('mixture');
    await page.locator('[data-key="thermal.kMode"]').selectOption('geometric');
    await page.waitForFunction(() => document.querySelector('#thermal-cp-active').textContent === '1,026671');
    const mct = await download(page, 'export-mct', 'model.MCT');
    assert.match(mct, /\*HYD-STAGE/);
    assert.match(mct, /1\.026670678/);
    assert.match(mct, /7\.039324596/);
    assert.match(mct, /H0_OLD_INIT/);
    assert.match(mct, /H3_END_CURING/);
    assert.match(mct, /\*TDM-TYPE/);
    assert.match(mct, /NAME=TD_FC, CODE, CEB-FIP\(1990\), 38000000, 2/);
    assert.match(mct, /2, TD_CS, TD_FC/);
    const report = await download(page, 'download-report', 'report.txt');
    assert.ok(report.includes('1.02667') || report.includes('1,02667'));
    assert.ok(report.includes('TIME DEPENDENT MATERIAL LINK:'));
    await download(page, 'download-report', 'cancelled-report.txt', true);

    // Native project persistence and exports include custom TD data, not only the form values.
    await page.locator('.nx-ribbon-tabs [data-workspace="material-waktu"]').click();
    await page.locator('[data-key="timeDependent.creepModel"]').selectOption('USER');
    await page.locator('[data-key="timeDependent.strengthModel"]').selectOption('USER');
    await page.locator('[data-key="timeDependent.creepModulusSource"]').selectOption('user');
    await page.locator('[data-key="timeDependent.creepReferenceModulus"]').fill('35000');
    const customStrength = '0, 0, 0, 0\n1, 9, 0.7, 12500\n30, 35, 2.6, 32000\n90, 39, 2.9, 35000';
    await page.locator('[data-key="timeDependent.customStrength"]').fill(customStrength);
    await page.locator('[data-key="timeDependent.strengthScale"]').fill('1.25');
    await page.waitForFunction(() => !document.querySelector('#export-mct').disabled);
    const customMct = await download(page, 'export-mct', 'custom-model.MCT');
    assert.match(customMct, /FUNC=TD_CREEP_1, CREEP, 1, CC, 35000000000/);
    assert.match(customMct, /NAME=TD_FC, USER, 1.25/);
    assert.match(customMct, /1, 9000000, 700000, 12500000000/);
    const customReport = await download(page, 'download-report', 'custom-report.txt');
    assert.ok(customReport.includes('Modulus acuan creep USER=35000 MPa'));
    assert.ok(customReport.includes(customStrength));

    // Save on close persists the last edits. Discard leaves the saved file intact.
    await setCp(page, 1.17);
    await queue('message', 'save');
    await closeWindow();
    assert.equal(JSON.parse(await fs.readFile(projectB, 'utf8')).config.material.cp, 1.17);
    assert.equal(JSON.parse(await fs.readFile(projectB, 'utf8')).config.timeDependent.customStrength, customStrength);
    page = await launch();
    await page.waitForFunction(() => document.querySelector('[data-key="material.cp"]').value === '1.17');
    assert.equal(await page.locator('[data-key="timeDependent.customStrength"]').inputValue(), customStrength);
    await queue('message', 'discard');
    await open(page, projectB);
    await waitSaved(page, path.basename(projectB));
    await setCp(page, 1.18);
    await queue('message', 'discard');
    await closeWindow();
    assert.equal(JSON.parse(await fs.readFile(projectB, 'utf8')).config.material.cp, 1.17);
    assert.deepEqual(errors, []);
    console.log('PASS: protected offline desktop; native Save/Save As, overwrite/copy/cancellation, existing JSON editing, invalid-open preservation, unsaved close/Open guards, save/discard on close, restart persistence, code/custom TD materials and MCT/TXT exports.');
  } finally {
    if (application) {
      await application.evaluate(({BrowserWindow}) => {
        for (const window of BrowserWindow.getAllWindows()) window.destroy();
      }).catch(() => {});
      await application.close().catch(() => {});
    }
    await fs.rm(temporary, {recursive: true, force: true});
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
