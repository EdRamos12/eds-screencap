const {ipcRenderer} = require('electron');
let currentData;

window.addEventListener('DOMContentLoaded', function (e) {
    currentData = ipcRenderer.sendSync('data-request');
    if (currentData.theme == 'dark') {
        let root = document.documentElement;
        root.style.setProperty('--bgTheme', '#121212');
        root.style.setProperty('--fontColor', 'white');
    }
});
