const { BrowserWindow } = require('electron');
const path = require('path');

// Main window
const createMainWindow = () => {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		icon: process.cwd() + '/build/grr.ico',
		webPreferences: {
			nodeIntegration: true,
		}
	});
	// Load the index.html of the app.
	mainWindow.loadFile(path.join(__dirname, '../pages/recorder/index.html'));
	//mainWindow.webContents.openDevTools();
	mainWindow.setMenuBarVisibility(false);
	return mainWindow;
};

// Preferences window
function createConfigWindow() {
	// Create the browser window.
	configWindow = new BrowserWindow({
		width: 400,
		height: 650,
		parent: mainWindow,
		icon: process.cwd() + '/build/grr.ico',
		webPreferences: {
			nodeIntegration: true,
		}
	});
	// Load the cfg.html of the window.
	configWindow.loadFile(path.join(__dirname, '../pages/config/index.html'));
	// On close, window will be set to null
	configWindow.on('close', function () { configWindow = null });
	// Removes menu from window
	configWindow.setMenuBarVisibility(false);
	return configWindow;
}

// Convert video window
function createConvertOutputWindow() {
	converterWindow = new BrowserWindow({
		width: 700,
		height: 200,
		parent: mainWindow,
		icon: process.cwd() + '/build/grr.ico',
		frame: false,
		webPreferences: {
			nodeIntegration: true,
		}
	});
	// Load the convert.html of the window.
	converterWindow.loadFile(path.join(__dirname, '../pages/video-converter/index.html'));
	// On close, window will be set to null
	converterWindow.on('close', function () { converterWindow = null });
	return converterWindow;
}

function createCropWindow() {
	cropWindow = new BrowserWindow({
		width: 500,
		height: 500,
		icon: process.cwd() + '/build/grr.ico',
		transparent: true,
		frame: false,
		resizable: true,
		'minHeight': 300,
		'minWidth': 300,
		
		webPreferences: {
			nodeIntegration: true,
		}
	});
	// Load the convert.html of the window.
	cropWindow.loadFile(path.join(__dirname, '../pages/crop/index.html'));
	// On close, window will be set to null
	cropWindow.on('close', function () { converterWindow = null });
	cropWindow.setMenuBarVisibility(false);
	cropWindow.setIgnoreMouseEvents(false);
	return cropWindow;
}

module.exports = {
	createMainWindow,
	createConfigWindow,
	createConvertOutputWindow,
	createCropWindow,
}