const { remote, ipcRenderer } = require('electron');
const { dialog } = remote;
require('../util/setTheme');

const dirBtn = document.querySelector('#dir');
const clearDirBtn = document.querySelector('#disableDir');
const clsBtn = document.querySelector('#close');
const saveBtn = document.querySelector('#save');

const themeValueE = document.querySelector('#theme');
const outputFormatE = document.querySelector('#format');
const outputCodecE = document.querySelector('#codecs');
const streamCodecE = document.querySelector('#stream-codecs');
const dirOutput = document.querySelector('#outputdir');
const logBtn = document.querySelector('#log');
let root = document.documentElement;

let currentData;
window.addEventListener('DOMContentLoaded', () => {
    currentData = ipcRenderer.sendSync('data-request');
    console.log('data loaded!, ', currentData);
    themeValueE.value = currentData.theme;
    outputFormatE.value = currentData.outputFormat;
    outputCodecE.value = currentData.outputCodec;
    streamCodecE.value = currentData.streamCodec;
    dirOutput.value = currentData.defaultPath;
    logBtn.checked = currentData.allowDebugLog;
});

saveBtn.addEventListener("click", function (e) {
    let newConfig = {
        theme: themeValueE.value,
        outputFormat: outputFormatE.value,
        outputCodec: outputCodecE.value,
        streamCodec: streamCodecE.value,
        defaultPath: dirOutput.value,
        allowDebugLog: logBtn.checked,
    }
    if (themeValueE.value == 'dark') {
        root.style.setProperty('--bgTheme', '#121212');
        root.style.setProperty('--fontColor', 'white');
    } else {
        root.style.setProperty('--bgTheme', 'white');
        root.style.setProperty('--fontColor', 'black');
    }
    ipcRenderer.send('write-data', newConfig);
});

clsBtn.addEventListener("click", function (e) {
    remote.getCurrentWindow().close();
});

dirBtn.addEventListener("click", function (e) {
    let setOutputPath = dialog.showOpenDialogSync({
        properties: ['openDirectory']
    })[0];
    dirOutput.value = setOutputPath;
});

clearDirBtn.addEventListener('click', function (e) {
    dirOutput.value = '';
});