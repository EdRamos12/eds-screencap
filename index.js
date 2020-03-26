const electron = require('electron');
const log = require('electron-log');
const app = electron.app;
const ipc = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;
const Bluebird = require('bluebird');
const storage = Bluebird.promisifyAll(require('electron-json-storage'));
storage.setDataPath(process.cwd());

const path = require('path');
const Menu = electron.Menu;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
app.allowRendererProcessReuse = true;

let mainWindow;
let configWindow;
let converterWindow;

let currentPath;
let currentData;

const createWindow = () => {
  // Create the browser window.
  log.info('function createWindow() called');
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    }
  });
  log.info('Window object created');
  // and load the index.html of the app.
  log.info('Loading file.');
  mainWindow.loadFile(path.join(__dirname, 'recorder/index.html'));
  // open dev tools
  log.info('html loaded, Opening tools');
  mainWindow.webContents.openDevTools();
  log.info('adding listener');
  mainWindow.on('closed', function () {
    app.quit();
  });
  log.info('createWindow() finished');
};

function createConfigWindow() {
  configWindow = new BrowserWindow({
    width: 400,
    height: 620,
    parent: mainWindow,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
    }
  });
  configWindow.loadFile(path.join(__dirname, 'config/cfg.html'));
  configWindow.on('close', function () { configWindow = null });
}

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
  converterWindow.loadFile(path.join(__dirname, 'videoConverter/convert.html'));
  converterWindow.on('close', function () { converterWindow = null });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
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
  if (process.platform == 'darwin') {
    template.unshift({});
  }
  if (process.env.NODE_ENV !== 'production') {
    template.push({
      label: 'Developer Tools',
      submenu: [{
        role: 'toggleDevTools'
      }]
    });
  }
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  //make/get preferences
  storage.getAsync('config', function (error, data) {
    console.log('storage.get called');
    if (error) throw error;
    if (JSON.stringify(data) == '{}') { // if json is empty or there is no json, makes default settings.
      let defaultSettings = {
        theme: 'light',
        outputFormat: 'mp4',
        outputCodec: 'libx264',
        streamCodec: 'h264',
        defaultPath: '',
        allowDebugLog: false,
      }
      storage.set('config', defaultSettings, function (error) {
        if (error) throw error;
      });
      currentData = defaultSettings;
    } else {
      currentData = data;
    }
  });
  createWindow();

  // IPC LISTENERS
  ipc.on('convert-stuff', (e, arg) => { //main window calls when recording is finished
    currentPath = arg;
    convertOutputWindow();
  });
  
  ipc.on('converter-loaded', (e) => { //converter calls when DOM content is loaded
    e.returnValue = currentPath;
  });
  
  //config thingy
  ipc.on('data-request', (e) => { //whenever any ipc requests data, returns current data
    e.returnValue = currentData;
    console.log('')
  });
  
  ipc.on('write-data', (e, data) => { //config window calls when user wants to save preferences, and sets new config on the var
    storage.set('config', data, (error) => {
      if (error) throw error;
      currentData = data;
      log.info('saved data,', data);
    });
    mainWindow.webContents.send('new-data-written', data); //sends data to main window for update
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
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.