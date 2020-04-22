const { globalShortcut } = require('electron');
module.exports.registerShortcuts = function (data, window) {
	const { recordShort, stopShort, pauseShort, resumeShort } = data;
	// Start and Stop recording
	if (recordShort == stopShort && recordShort !== '' && stopShort !== '') {
		globalShortcut.register(recordShort, () => {
			window.webContents.send('start-stop-shortcut');
		});
	} else {
		if (recordShort !== '') globalShortcut.register(recordShort, () => {
			window.webContents.send('start-recording');
		});
		if (stopShort !== '') globalShortcut.register(stopShort, () => {
			window.webContents.send('stop-recording');
		});
	}
	// Pause and Resume recording
	if (pauseShort == resumeShort && pauseShort !== '' && resumeShort !== '') {
		globalShortcut.register(pauseShort, () => {
			window.webContents.send('pause-resume-shortcut');
		});
	} else {
		if (pauseShort !== '') {
			globalShortcut.register(pauseShort, () => {
				window.webContents.send('pause-recording');
			});
		}
		if (resumeShort !== '') {
			globalShortcut.register(resumeShort, () => {
				window.webContents.send('resume-recording');
			});
		}
	}
}