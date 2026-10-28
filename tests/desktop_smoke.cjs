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
  let application;
  async function launch() {
    const args = [`--user-data-dir=${profile}`];
    if (process.platform === 'linux') args.push('--no-sandbox');
    if (!executable) args.push(root);
    application = await _electron.launch({executablePath: executable || require('electron'), args, timeout: 60000});
    const page = await application.firstWindow();
    await page.waitForFunction(() => document.querySelector('#thermal-cp-active')?.textContent.includes('0,900000'));
    return page;
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
  try {
    let page = await launch();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    assert.equal(await page.evaluate(() => typeof require), 'undefined');
    assert.equal(await page.evaluate(() => typeof process), 'undefined');
    assert.equal(await page.locator('#metrics-elements').innerText(), '24.576');
    const security = await application.evaluate(({BrowserWindow}) => {
      const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return {sandbox: preferences.sandbox, nodeIntegration: preferences.nodeIntegration,
        contextIsolation: preferences.contextIsolation, webSecurity: preferences.webSecurity};
    });
    assert.deepEqual(security, {sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true});
    const sample = await page.evaluate(() => URL.createObjectURL(new Blob(['local'])));
    console.log('Runtime Blob origin:', sample.split('/').slice(0, 3).join('/'));
    assert.equal(require('../desktop/policy.cjs').isAllowedDownload(sample, 'TEST.MCT'), true);
    const raw = await download(page, 'export-json', 'initial.json');
    assert.equal(JSON.parse(raw).schema, 'civil-heat-studio/v1');
    await page.locator('[data-workspace="termal"]').first().click();
    await page.locator('[data-key="thermal.cpMode"]').selectOption('mixture');
    await page.locator('[data-key="thermal.kMode"]').selectOption('geometric');
    await page.waitForFunction(() => document.querySelector('#thermal-cp-active').textContent === '1,026671');
    const mct = await download(page, 'export-mct', 'model.MCT');
    assert.match(mct, /\*HYD-STAGE/);
    assert.match(mct, /1\.026670678/);
    assert.match(mct, /7\.039324596/);
    assert.match(mct, /H0_OLD_INIT/);
    assert.match(mct, /H3_END_CURING/);
    const saved = await download(page, 'export-json', 'calculated.json');
    assert.equal(JSON.parse(saved).config.thermal.cpMode, 'mixture');
    const report = await download(page, 'download-report', 'report.txt');
    assert.ok(report.includes('1.02667') || report.includes('1,02667'));
    await download(page, 'export-json', 'cancelled.json', true);
    await page.locator('#import-file').setInputFiles(path.join(root, 'examples', 'THERMAL_EC2_REFERENCE.json'));
    await page.waitForFunction(() => document.querySelector('[data-key="thermal.cpMode"]').value === 'ec2_dry');
    await page.locator('[data-key="thermal.cpMode"]').selectOption('manual');
    await page.locator('[data-key="material.cp"]').fill('1.17');
    await page.locator('[data-key="material.cp"]').dispatchEvent('change');
    await page.waitForFunction(() => document.querySelector('#thermal-cp-active').textContent === '1,170000');
    await application.close(); application = null;
    application = await _electron.launch({executablePath: executable || require('electron'),
      args: [`--user-data-dir=${profile}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...(executable ? [] : [root])], timeout: 60000});
    page = await application.firstWindow();
    await page.waitForFunction(() => document.querySelector('[data-key="material.cp"]')?.value === '1.17');
    assert.equal(await page.locator('[data-key="thermal.cpMode"]').inputValue(), 'manual');
    assert.deepEqual(errors, []);
    console.log('PASS: offline desktop, protected renderer, MCT/JSON/TXT exports, Save As options, cancellation, JSON import and restart persistence.');
  } finally {
    if (application) await application.close();
    await fs.rm(temporary, {recursive: true, force: true});
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
