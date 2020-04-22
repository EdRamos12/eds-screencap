// imports
const { app, ipcMain, globalShortcut, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const Bluebird = require('bluebird');

const { registerShortcuts } = require('./shortcuts');
const { createConfigWindow, createMainWindow, createConvertOutputWindow } = require('./renderers');
//const { getSettings } = require('./json-storage');

// Sets up storage path
const storage = Bluebird.promisifyAll(require('electron-json-storage'));
storage.setDataPath(process.cwd());

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
app.allowRendererProcessReuse = true;

let defaultSettings = {
  theme: 'light',
  outputFormat: 'mp4',
  outputCodec: 'libx264',
  streamCodec: 'h264',
  defaultPath: '',
  recordShort: '',
  stopShort: '',
  pauseShort: '',
  resumeShort: ''
}

let currentData;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async function () {
  // Menu template for project
  const template = [{
    label: 'File',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },

      { type: 'separator' },

      {
        label: 'Preferences',
        click: function () { createConfigWindow() }
      },
      { role: 'quit' },
    ],
  }];
  // If app is in development, option for dev tools will appear on menu
  if (process.env.NODE_ENV !== 'production') {
    template.push({
      label: 'Developer Tools',
      submenu: [{
        role: 'toggleDevTools'
      }]
    });
  }
  // Builds up menu from the template
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Make/get preferences
  storage.getAsync('config', function (error, data) {
    if (error) throw error;
    // If there is no json or person has an empty json, it creates a new one
    if (JSON.stringify(data) == '{}') {
      storage.set('config', defaultSettings, function (error) {
        if (error) throw error;
      });
      currentData = defaultSettings;
    } else {
      currentData = data;
    }
    registerShortcuts(currentData, mainWindow);
  });

  // Creates window
  mainWindow = createMainWindow();
  mainWindow.on('closed', function () {
    app.quit();
  });

  // IPC LISTENERS
  // Main window calls when recording is finished
  ipcMain.on('convert-stuff', (e, arg) => {
    converterStatus = arg;
    createConvertOutputWindow();
  });

  // Converter calls when DOM content is loaded, which returns the path for the video
  ipcMain.on('converter-loaded', (e) => {
    e.returnValue = converterStatus;
  });

  // Config thingy
  // Whenever any ipc requests data, returns current data
  ipcMain.on('data-request', (e) => {
    e.returnValue = currentData;
  });

  // Config window calls when user wants to save preferences, and sets new config on the object
  ipcMain.on('write-data', (e, data) => {
    storage.set('config', data, (err) => {
      if (err) throw err;
    });
    currentData = data;
    if (currentData != data) {
      globalShortcut.unregisterAll();
      registerShortcuts(data, mainWindow);
    }
    // Sends data to main window for update
    mainWindow.webContents.send('new-data-written', data);
  });
  ipcMain.on('taskbar-percent', (e, data) => {
    mainWindow.setProgressBar(data);
  });
  ipcMain.on('converter-done', (e) => {
    mainWindow.setProgressBar(-1);
  });
  mainWindow.webContents.on('did-finish-load', async function () {
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdatesAndNotify();
    console.log(app.getVersion());
  });
});

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

// Auto updater

autoUpdater.on('checking-for-update', () => {
  mainWindow.webContents.send('update-message', 'checking updates smh');
})

autoUpdater.on('update-available', async function () {
  mainWindow.webContents.send('update-message', 'Update available!');
  let choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Yes', 'No'],
    title: 'Download update',
    message: 'New update available! Do you want to download it?'
  });
  if (choice.response == 0) {
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on('update-downloaded', async function () {
  mainWindow.setProgressBar(-1);
  let choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Yes', 'No'],
    title: 'Restart',
    message: 'Update downloaded. Restart now?'
  });
  if (choice.response == 0) {
    autoUpdater.quitAndInstall();
  }
  mainWindow.webContents.send('update-message', 'downloaded lol');
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-message', `downloading, ${progressObj}%`);
  mainWindow.setProgressBar(2);
})

autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-message', err);
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.