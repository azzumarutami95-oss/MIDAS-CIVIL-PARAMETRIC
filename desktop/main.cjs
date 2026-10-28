'use strict';
const {app, BrowserWindow, Menu, dialog, shell, session, ipcMain} = require('electron');
const path = require('node:path');
const {isTrustedDocument, isAllowedExternal, isAllowedDownload} = require('./policy.cjs');
const {readProject, writeProject, validateText, jsonPath} = require('./project-files.cjs');

const entry = path.join(__dirname, '..', 'web', 'index.html');
const title = 'Civil Hydration NX';
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
let mainWindow;
let currentFile = null, dirty = false, saveBusy = false, openBusy = false, closeBusy = false, guardSaving = false, allowClose = false;

// Keep a stable profile for updates; parameter JSON remains the portable backup.
app.setName(title);
app.setAppUserModelId('io.github.azzumarutami95oss.civilhydrationnx');

function click(id) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(id)}).click()`).catch(() => {});
  }
}

function trustedSender(event) {
  return !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame && isTrustedDocument(event.senderFrame.url, entry);
}

function updateTitle() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(`${currentFile ? path.basename(currentFile) : 'Proyek baru'}${dirty ? ' *' : ''} — ${title}`);
}

async function mayReplace() {
  if (!dirty) return true;
  const answer = await dialog.showMessageBox(mainWindow, {
    type: 'question', title: 'Perubahan belum disimpan',
    message: 'Simpan perubahan proyek sebelum melanjutkan?',
    detail: currentFile ? path.basename(currentFile) : 'Proyek belum memiliki file JSON.',
    buttons: ['Simpan', 'Jangan simpan', 'Batal'], defaultId: 0, cancelId: 2, noLink: true
  });
  if (answer.response === 1) return true;
  if (answer.response !== 0 || !isTrustedDocument(mainWindow.webContents.getURL(), entry)) return false;
  try {
    guardSaving = true;
    return await mainWindow.webContents.executeJavaScript('window.CivilHydrationProject?.save()') === true;
  } catch { return false; }
  finally { guardSaving = false; }
}

function registerProjectIPC() {
  ipcMain.on('hydration:dirty', (event, value) => {
    if (trustedSender(event) && typeof value === 'boolean') { dirty = value; updateTitle(); }
  });
  ipcMain.handle('hydration:save-project', async (event, text, saveAs) => {
    if (!trustedSender(event)) return {status: 'error', message: 'Dokumen tidak diizinkan menyimpan proyek.'};
    if (typeof saveAs !== 'boolean') return {status: 'error', message: 'Perintah penyimpanan tidak valid.'};
    if (saveBusy || ((openBusy || closeBusy) && !guardSaving)) return {status: 'error', message: 'Operasi file sebelumnya masih berlangsung.'};
    saveBusy = true;
    try {
      validateText(text);
      let destination = currentFile;
      if (saveAs || !destination) {
        const choice = await dialog.showSaveDialog(mainWindow, {
          title: saveAs ? 'Save As — Simpan proyek sebagai' : 'Save — Simpan proyek',
          defaultPath: destination || path.join(app.getPath('documents'), 'PARAMETER_HEAT_HYDRATION.json'),
          filters: [{name: 'Proyek hidrasi JSON', extensions: ['json']}],
          properties: ['showOverwriteConfirmation', 'createDirectory']
        });
        if (choice.canceled || !choice.filePath) return {status: 'cancelled'};
        destination = jsonPath(choice.filePath);
      }
      const saved = await writeProject(destination, text);
      currentFile = saved.filePath; dirty = false; updateTitle();
      return {status: 'saved', name: saved.name, filePath: saved.filePath};
    } catch (error) {
      return {status: 'error', message: 'Proyek belum tersimpan: ' + error.message};
    } finally { saveBusy = false; }
  });
  ipcMain.handle('hydration:open-project', async event => {
    if (!trustedSender(event)) return {status: 'error', message: 'Dokumen tidak diizinkan membuka proyek.'};
    if (openBusy || saveBusy) return {status: 'error', message: 'Operasi file sebelumnya masih berlangsung.'};
    openBusy = true;
    try {
      // This guard deliberately runs without the save lock: the renderer may
      // need to Save the old document before replacing it with the selected one.
      if (!await mayReplace()) return {status: 'cancelled'};
      const choice = await dialog.showOpenDialog(mainWindow, {
        title: 'Buka proyek hidrasi JSON', defaultPath: currentFile || app.getPath('documents'),
        filters: [{name: 'Proyek hidrasi JSON', extensions: ['json']}], properties: ['openFile']
      });
      if (choice.canceled || !choice.filePaths[0]) return {status: 'cancelled'};
      const opened = await readProject(choice.filePaths[0]);
      currentFile = opened.filePath; dirty = false; updateTitle();
      return {status: 'opened', text: opened.text, name: opened.name, filePath: opened.filePath};
    } catch (error) {
      return {status: 'error', message: 'Proyek belum dibuka: ' + error.message};
    } finally { openBusy = false; }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title, width: 1480, height: 960, minWidth: 1024, minHeight: 720,
    backgroundColor: '#e9eff5', show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false, webviewTag: false
    }
  });
  const wc = mainWindow.webContents;
  wc.on('will-navigate', (event, url) => {
    if (!isTrustedDocument(url, entry)) event.preventDefault();
  });
  wc.on('will-attach-webview', event => event.preventDefault());
  wc.setWindowOpenHandler(({url}) => {
    if (isAllowedExternal(url)) shell.openExternal(url).catch(() => {});
    return {action: 'deny'};
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('page-title-updated', event => { event.preventDefault(); updateTitle(); });
  mainWindow.on('close', event => {
    if (allowClose) return;
    if (!dirty && !saveBusy && !openBusy) return;
    event.preventDefault();
    if (closeBusy || saveBusy || openBusy) return;
    closeBusy = true;
    mayReplace().then(ok => {
      if (ok && mainWindow && !mainWindow.isDestroyed()) { allowClose = true; mainWindow.close(); }
    }).finally(() => { closeBusy = false; });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  wc.on('did-fail-load', (_event, code, message, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) dialog.showErrorBox(title, `Tidak dapat membuka aplikasi (${code}): ${message}`);
  });
  mainWindow.loadFile(entry);
}

app.whenReady().then(() => {
  registerProjectIPC();
  const localSession = session.defaultSession;
  localSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  localSession.setPermissionCheckHandler(() => false);
  // No remote documents, scripts, network APIs or background telemetry are needed.
  localSession.webRequest.onBeforeRequest({urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']},
    (_details, callback) => callback({cancel: true}));
  localSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType === 'mainFrame') {
      callback({responseHeaders: {...details.responseHeaders, 'Content-Security-Policy': [csp]}});
    } else callback({});
  });
  localSession.on('will-download', (event, item, contents) => {
    const filename = item.getFilename();
    if (!mainWindow || contents !== mainWindow.webContents || !isAllowedDownload(item.getURL(), filename)) {
      event.preventDefault(); return;
    }
    const extension = path.extname(filename).slice(1).toLowerCase();
    const names = {mct: 'MIDAS Command Text', json: 'Parameter hidrasi JSON', txt: 'Ringkasan input'};
    item.setSaveDialogOptions({
      title: 'Simpan ' + names[extension],
      defaultPath: path.join(app.getPath('documents'), filename),
      filters: [{name: names[extension], extensions: [extension]}, {name: 'Semua file', extensions: ['*']}]
    });
    item.once('done', (_event, state) => {
      if (state === 'interrupted') dialog.showErrorBox(title, 'File belum tersimpan. Periksa folder tujuan lalu ulangi ekspor.');
    });
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label: 'File', submenu: [
      {label: 'Buka parameter JSON…', accelerator: 'Ctrl+O', click: () => click('import-json')},
      {label: 'Save — Simpan proyek', accelerator: 'Ctrl+S', click: () => click('export-json')},
      {label: 'Save As — Simpan sebagai…', accelerator: 'Ctrl+Shift+S', click: () => click('save-as')},
      {label: 'Ekspor model .MCT…', accelerator: 'Ctrl+Alt+E', click: () => click('export-mct')},
      {label: 'Simpan ringkasan input…', click: () => click('download-report')},
      {type: 'separator'}, {role: 'quit', label: 'Keluar'}
    ]},
    {label: 'Edit', submenu: [{role: 'undo'}, {role: 'redo'}, {type: 'separator'}, {role: 'cut'}, {role: 'copy'}, {role: 'paste'}, {role: 'selectAll'}]},
    {label: 'Tampilan', submenu: [{role: 'resetZoom', label: 'Ukuran normal'}, {role: 'zoomIn', label: 'Perbesar'}, {role: 'zoomOut', label: 'Perkecil'}, {type: 'separator'}, {role: 'togglefullscreen', label: 'Layar penuh'}]},
    {label: 'Bantuan', submenu: [{label: 'Tentang aplikasi', click: () => dialog.showMessageBox(mainWindow, {
      type: 'info', title, message: `${title} ${app.getVersion()}`,
      detail: 'Penyusun input panas hidrasi dan ekspor MCT. Dapat digunakan offline.\n\nAplikasi independen, bukan produk MIDAS. Analisis dilakukan di MIDAS Civil setelah impor dan pemeriksaan model.\n\nSimpan parameter JSON sebagai cadangan pekerjaan.'
    })}]}
  ]));
  createWindow();
});

app.on('window-all-closed', () => app.quit());
