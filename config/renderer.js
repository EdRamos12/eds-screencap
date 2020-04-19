const { remote, ipcRenderer, shell } = require('electron');
const { dialog } = remote;
require('../util/setTheme');

const dirBtn = document.getElementById('dir');
const clearDirBtn = document.getElementById('disableDir');
const saveBtn = document.getElementById('save');

const themeValueE = document.getElementById('theme');
const outputFormatE = document.getElementById('format');
const outputCodecE = document.getElementById('codecs');
const streamCodecE = document.getElementById('stream-codecs');
const dirOutput = document.getElementById('outputdir');
const openBtn = document.getElementById('open-dir');

let recordShort = document.getElementById('recordShort');
let stopShort = document.getElementById('stopShort');
let pauseShort = document.getElementById('pauseShort');
let resumeShort = document.getElementById('resumeShort');

let root = document.documentElement;
let currentData;

function openTab(evt, name) {
	let i, tabContent, tabLinks;
	tabContent = document.getElementsByClassName("tabContent");
	for (i = 0; i < tabContent.length; i++) {
		tabContent[i].style.display = "none";
	}
	tabLinks = document.getElementsByClassName("tabLinks");
  	for (i = 0; i < tabLinks.length; i++) {
    	tabLinks[i].className = tabLinks[i].className.replace(" active", "");
	}
	document.getElementById(name).style.display = "block";
	evt.currentTarget.className += " active";
}

document.getElementById('videoOutputB').onclick = (evt) => {
	openTab(evt, 'videoOutput');
};

document.getElementById('shortcutsB').onclick = (evt) => {
	openTab(evt, 'shortcuts');
};

window.addEventListener('DOMContentLoaded', () => {
	document.getElementById('videoOutput').style.display = "block";
	currentData = ipcRenderer.sendSync('data-request');
	console.log('data loaded!, ', currentData);
	themeValueE.value = currentData.theme;
	outputFormatE.value = currentData.outputFormat;
	outputCodecE.value = currentData.outputCodec;
	streamCodecE.value = currentData.streamCodec;
	dirOutput.value = currentData.defaultPath;
	recordShort.value = currentData.recordShort;
	stopShort.value = currentData.stopShort;
	pauseShort.value = currentData.pauseShort;
	resumeShort.value = currentData.resumeShort;
});

const savePreferences = () => {
	let newConfig = {
		theme: themeValueE.value,
		outputFormat: outputFormatE.value,
		outputCodec: outputCodecE.value,
		streamCodec: streamCodecE.value,
		defaultPath: dirOutput.value,
		recordShort: recordShort.value,
		stopShort: stopShort.value,
		pauseShort: pauseShort.value,
		resumeShort: resumeShort.value
	}
	if (themeValueE.value == 'dark') {
		root.style.setProperty('--bgTheme', '#121212');
		root.style.setProperty('--fontColor', 'white');
	} else {
		root.style.setProperty('--bgTheme', 'white');
		root.style.setProperty('--fontColor', 'black');
	}
	console.log('saved');
	ipcRenderer.send('write-data', newConfig);
}

saveBtn.onclick = () => {
	saveBtn.innerText = 'Settings saved!';
	savePreferences();
	setTimeout(() => saveBtn.innerText = 'Save settings', 1500);
};

dirBtn.onclick = () => {
	let setOutputPath;
	try {
		setOutputPath = dialog.showOpenDialogSync({
			properties: ['openDirectory']
		})[0];
		dirOutput.value = setOutputPath;
	} catch (err) {
		console.log('path not recognized');
	}
}

clearDirBtn.onclick = () => {
	dirOutput.value = '';
}

openBtn.onclick = () => {shell.openItem(dirOutput.value);}

function addMultipleShortcutListener() {
	if (arguments.length == 0) throw new Error('No arguments entered'); 
	for(let i = 0; i < arguments.length; i++) {
		let clearCurrentShort = document.querySelectorAll('#clearShort');
		console.log(clearCurrentShort[i], i);
		clearCurrentShort[i].addEventListener('click', (event) => {
			arguments[i].value = '';
			savePreferences();
		})
		arguments[i].addEventListener('keydown', (event) => {
			console.log(arguments[i] == recordShort);
			if (((event.key.toUpperCase() == recordShort.value || event.key.toUpperCase() == stopShort.value) && arguments[i] != recordShort && arguments[i] != stopShort) ||
			((event.key.toUpperCase() == resumeShort.value || event.key.toUpperCase() == pauseShort.value) && arguments[i] != resumeShort && arguments[i] != pauseShort)) {
				alert('This key has already been registered! (Try not using same keys from different sections!)');
			} else {
				arguments[i].value = event.key.toUpperCase();
				arguments[i].blur();
			}
		});
	}
}

addMultipleShortcutListener(recordShort, stopShort, pauseShort, resumeShort);

document.getElementById('clearAll').onclick = () => {
	recordShort.value = '';
	stopShort.value = '';
	pauseShort.value = '';
	resumeShort.value = '';
	savePreferences();
}