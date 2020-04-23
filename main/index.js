// imports
const { app, globalShortcut, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
autoUpdater.autoInstallOnAppQuit = true;
const Bluebird = require('bluebird');

const { registerShortcuts } = require('./shortcuts');
const { createConfigWindow, createMainWindow, createConvertOutputWindow } = require('./renderers');
const { registerIpcHandlers } = require('./ipc-listeners');
//const { getSettings } = require('./json-storage');

// Sets up storage path
const storage = Bluebird.promisifyAll(require('electron-json-storage'));
storage.setDataPath(app.getPath('userData'));

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

let currentData, mainWindow;

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
        label: 'Convert backup webm',
        submenu: [
          {
            label: 'With default settings',
            click: function() {
              let filePath = dialog.showOpenDialogSync({
                buttonLabel: 'Convert video!',
                filters: [
                  { name: 'Movies', extensions: ['webm'] },
                ]
              })[0];
              console.log(filePath);
              configWin = createConvertOutputWindow();
              configWin.webContents.on('did-finish-load', async function () {
                configWin.webContents.send('convert-backup', {
                  path: filePath,
                  settings: defaultSettings
                });
              });
            }
            
          },
          {
            label: 'With saved settings',
            click: function() {
              let filePath = dialog.showOpenDialogSync({
                buttonLabel: 'Convert video!',
                filters: [
                  { name: 'Movies', extensions: ['webm'] },
                ]
              })[0];
              configWin = createConvertOutputWindow();
              configWin.webContents.on('did-finish-load', async function () {
                configWin.webContents.send('convert-backup', {
                  path: filePath,
                  settings: currentData
                });
              });
            }
          }
        ]
      },

      { type: 'separator' },
      {
        label: 'Preferences',
        click: function () { createConfigWindow() }
      },
      { role: 'quit' },
    ],
  }];
  // If app is in development, option for dev tools will appear on menu
  if (!app.isPackaged) {
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
    // Shortcuts
    registerShortcuts(currentData, mainWindow);

    // IPC LISTENERS
    registerIpcHandlers(currentData, mainWindow);
  });
  // Initializes main window
  mainWindow = createMainWindow();
  mainWindow.on('closed', function () {
    app.quit();
  });
  mainWindow.webContents.on('did-finish-load', async function () {
    autoUpdater.autoDownload = false;
    console.log(autoUpdater);
		autoUpdater.checkForUpdatesAndNotify();
		console.log(app.getVersion());
	});
});

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

// Auto updater

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

autoUpdater.on('update-downloaded', async function (event, releaseNotes, releaseName) {
  mainWindow.setProgressBar(-1);
  let choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Restart now', 'Install later'],
    title: 'Restart',
    message: releaseNotes,
    detail: 'A new version has been downloaded. Restart the application to apply the updates. Closing the app will update.',
  });
  if (choice.response == 0) {
    autoUpdater.quitAndInstall();
  }
  mainWindow.webContents.send('update-message', `Download completed!`);
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-message', `Downloading (${parseInt(progressObj.percent)}%)`);
  mainWindow.setProgressBar(2);
})

autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-message', err);
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.