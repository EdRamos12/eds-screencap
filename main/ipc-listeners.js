const { ipcMain, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createConvertOutputWindow } = require('./renderers');
const Bluebird = require('bluebird');
const storage = Bluebird.promisifyAll(require('electron-json-storage'));
storage.setDataPath(process.cwd());

module.exports.registerIpcHandlers = function (currentData, window) {
	// Main window calls when recording is finished
	ipcMain.on('convert-stuff', (e, arg) => {
		converterStatus = arg;
		createConvertOutputWindow();
	});

	// Converter calls when DOM content is loaded, which returns the path for the video
	ipcMain.on('converter-loaded', (e) => {
		e.returnValue = converterStatus;
	});
	
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
			registerShortcuts(data, window);
		}
		// Sends data to main window for update
		window.webContents.send('new-data-written', data);
	});
	ipcMain.on('taskbar-percent', (e, data) => {
		window.setProgressBar(data);
	});
	ipcMain.on('converter-done', (e) => {
		window.setProgressBar(-1);
	});
	window.webContents.on('did-finish-load', async function () {
		autoUpdater.autoDownload = false;
		autoUpdater.checkForUpdatesAndNotify();
		console.log(app.getVersion());
	});
}