// imports
const { app, ipcMain, globalShortcut, BrowserWindow, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const Bluebird = require('bluebird');
const path = require('path');

// Sets up storage path
const storage = Bluebird.promisifyAll(require('electron-json-storage'));
storage.setDataPath(process.cwd());

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
app.allowRendererProcessReuse = true;

// Sets up global vars
// Windows
let mainWindow;
let configWindow;
let converterWindow;

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

let newUpdate = false;

let converterStatus; // String that will be passed to the converter
let currentData; // Object which contains users preferences

let record;
let stopR;
let pause;
let resume;

// Main window
const createMainWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: __dirname + '/icon/grr.ico',
    webPreferences: {
      nodeIntegration: true,
    }
  });
  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'recorder/index.html'));
  mainWindow.on('closed', function () {
    app.quit();
  });
  //mainWindow.webContents.openDevTools();
};

// Preferences window
function createConfigWindow() {
  // Create the browser window.
  configWindow = new BrowserWindow({
    width: 400,
    height: 650,
    parent: mainWindow,
    icon: __dirname + '/icon/grr.ico',
    webPreferences: {
      nodeIntegration: true,
    }
  });
  // Load the cfg.html of the window.
  configWindow.loadFile(path.join(__dirname, 'config/cfg.html'));
  // On close, window will be set to null
  configWindow.on('close', function () { configWindow = null });
  // Removes menu from window
  configWindow.setMenuBarVisibility(false);
}

// Convert video window
function convertOutputWindow() {
  converterWindow = new BrowserWindow({
    width: 700,
    height: 200,
    parent: mainWindow,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
    }
  });
  // Load the convert.html of the window.
  converterWindow.loadFile(path.join(__dirname, 'videoConverter/convert.html'));
  // On close, window will be set to null
  converterWindow.on('close', function () { converterWindow = null });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
  // Menu template for project
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },

        { type: 'separator' },

        {
          label: 'Preferences',
          click: function () {
            createConfigWindow();
          }
        },
        {
          role: 'quit'
        },
      ],
    }
  ];
  // Minor bug fix for macOS on menu
  if (process.platform == 'darwin') {
    template.unshift({});
  }
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
    // Shortcuts
    record = currentData.recordShort;
    stopR = currentData.stopShort;
    pause = currentData.pauseShort;
    resume = currentData.resumeShort;

    // Register shortcut listeners

    // Start and Stop recording
    if (record == stopR && record !== '' && stopR !== '') {
      globalShortcut.register(record, () => {
        mainWindow.webContents.send('start-stop-shortcut');
        console.log('record fired');
      });
    } else {
      if (record !== '') globalShortcut.register(record, () => {
        mainWindow.webContents.send('start-recording');
      });
      if (stopR !== '') globalShortcut.register(stopR, () => {
        mainWindow.webContents.send('stop-recording');
      });
    }
    // Pause and Resume recording
    if (pause == resume && pause !== '' && resume !== '') {
      globalShortcut.register(pause, () => {
        mainWindow.webContents.send('pause-resume-shortcut');
      });
    } else {
      if (pause !== '') {
        globalShortcut.register(pause, () => {
          mainWindow.webContents.send('pause-recording');
        });
      }
      if (resume !== '') {
        globalShortcut.register(resume, () => {
          mainWindow.webContents.send('resume-recording');
        });
      }
    }
  });

  // Creates window
  createMainWindow();

  // IPC LISTENERS
  // Main window calls when recording is finished
  ipcMain.on('convert-stuff', (e, arg) => {
    converterStatus = arg;
    convertOutputWindow();
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
    storage.set('config', data, (error) => {
      if (error) throw error;
      currentData = data;
      // If shortcuts has been changed, registers shortcuts again
      if (record !== data.recordShort || stopR !== data.stopShort || resume !== data.resumeShort || pause !== data.pauseShort) {
        globalShortcut.unregisterAll();

        record = data.recordShort;
        stopR = data.stopShort;

        pause = data.pauseShort;
        resume = data.resumeShort;

        // Shortcuts

        // If record and stop shortcuts are same, sends only one web content
        // Start and Stop record
        if (record == stopR && record !== '' && stopR !== '') {
          globalShortcut.register(record, () => {
            mainWindow.webContents.send('start-stop-shortcut');
            console.log('record fired');
          });
        } else {
          if (record !== '') {
            globalShortcut.register(record, () => {
              mainWindow.webContents.send('start-recording');
            });
          }
          if (stopR !== '') {
            globalShortcut.register(stopR, () => {
              mainWindow.webContents.send('stop-recording');
            });
          }
        }

        // Pause and Resume
        if (pause == resume && pause !== '' && resume !== '') {
          globalShortcut.register(pause, () => {
            mainWindow.webContents.send('pause-resume-shortcut');
          });
        } else {
          if (pause !== '') {
            globalShortcut.register(pause, () => {
              mainWindow.webContents.send('pause-recording');
            });
          }
          if (resume !== '') {
            globalShortcut.register(resume, () => {
              mainWindow.webContents.send('resume-recording');
            });
          }
        }
      }
    });
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

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

// Auto updater

autoUpdater.on('checking-for-update', () => {
  mainWindow.webContents.send('update-message', 'checking updates smh');
})

autoUpdater.on('update-available', async function() {
  mainWindow.webContents.send('update-message', 'Update available!');
  let choice = await dialog.showMessageBox(mainWindow,
    {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Download update',
      message: 'New update available! Do you want to download it?'
    });
  if (choice.response == 0) {
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on('update-downloaded', async function() {
  mainWindow.setProgressBar(-1);
  newUpdate = true;
  let choice = await dialog.showMessageBox(mainWindow,
    {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Restart',
      message: 'Update downloaded. Restart now?'
    });
  if (choice.response == 0) {
    autoUpdater.quitAndInstall();
  } else {
    autoUpdater.autoInstallOnAppQuit = true;
  }
  mainWindow.webContents.send('update-message', 'downloaded lol');
});

autoUpdater.on('download-progress', () => {
  mainWindow.webContents.send('update-message', 'downling');
  mainWindow.setProgressBar(2);
})

autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-message', err);
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.