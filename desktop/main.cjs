'use strict';
const {app, BrowserWindow, Menu, dialog, shell, session} = require('electron');
const path = require('node:path');
const {isTrustedDocument, isAllowedExternal, isAllowedDownload} = require('./policy.cjs');

const entry = path.join(__dirname, '..', 'web', 'index.html');
const title = 'Civil Hydration NX';
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
let mainWindow;

// Keep a stable profile for updates; parameter JSON remains the portable backup.
app.setName(title);
app.setAppUserModelId('io.github.azzumarutami95oss.civilhydrationnx');

function click(id) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(id)}).click()`).catch(() => {});
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title, width: 1480, height: 960, minWidth: 1024, minHeight: 720,
    backgroundColor: '#e9eff5', show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
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
  mainWindow.on('closed', () => { mainWindow = null; });
  wc.on('did-fail-load', (_event, code, message, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) dialog.showErrorBox(title, `Tidak dapat membuka aplikasi (${code}): ${message}`);
  });
  mainWindow.loadFile(entry);
}

app.whenReady().then(() => {
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
      {label: 'Simpan parameter JSON…', accelerator: 'Ctrl+S', click: () => click('export-json')},
      {label: 'Ekspor model .MCT…', accelerator: 'Ctrl+Shift+S', click: () => click('export-mct')},
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
