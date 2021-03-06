const { ipcMain, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createConfigWindow, createConvertOutputWindow } = require('./renderers');
const Bluebird = require('bluebird');
const storage = Bluebird.promisifyAll(require('electron-json-storage'));
storage.setDataPath(app.getPath('userData'));

let converterStatus;

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

	// Makes taskbar progress bar appear according to converting process 
	ipcMain.on('taskbar-percent', (e, data) => {
		window.setProgressBar(data);
	});

	// Sets taskbar progress back to normal
	ipcMain.on('converter-done', (e) => {
		window.setProgressBar(-1);
	});

	ipcMain.on('converter-failed', (e) => {
		window.setProgressBar(-1);
		window.webContents.send('save-bkp', converterStatus);
	});

	ipcMain.on('do-update', (e) => {
		autoUpdater.quitAndInstall();
	});

	ipcMain.on('open-cfg', (e) => {
		createConfigWindow();
	});
}