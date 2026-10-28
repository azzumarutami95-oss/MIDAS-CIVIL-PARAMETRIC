'use strict';
const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('hydrationDesktop', Object.freeze({
  openProject: () => ipcRenderer.invoke('hydration:open-project'),
  saveProject: (text, saveAs = false) => ipcRenderer.invoke('hydration:save-project', text, saveAs),
  setDirty: value => { if (typeof value === 'boolean') ipcRenderer.send('hydration:dirty', value); }
}));
