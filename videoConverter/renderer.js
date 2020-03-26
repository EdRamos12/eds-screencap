const { ipcRenderer, remote } = require('electron');
const { rmdir, unlinkSync } = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.getAvailableEncoders((err, encoders) => {
    console.log('getAvailableEncoders', encoders);
});
require('../util/setTheme');

let test = process.cwd() + '\\temp\\toConvert.webm'
let temp = process.cwd() + '\\temp';
let format = 'mp4';
let codec = 'libx264';

document.addEventListener('DOMContentLoaded', function (e) {
    console.log('DOM loaded, initializing converter');
    let currentData = ipcRenderer.sendSync('data-request');
    if (currentData.theme == 'dark') {
        let root = document.documentElement;
        root.style.setProperty('--bgTheme', '#121212');
        root.style.setProperty('--fontColor', 'white');
    }
    try {
        console.log(currentData);
        format = currentData.outputFormat;
        codec = currentData.outputCodec;
        let logInfo = document.querySelector('span');
        const filePath = ipcRenderer.sendSync('converter-loaded');
        console.log(filePath);
        new Promise((resolve, reject) => {
            ffmpeg(test).withVideoCodec(codec).toFormat(format)
                .on('error', (err) => {
                    if (err) {
                        unlinkSync(test, function (err) {
                            if (err) throw err;
                            console.log('file temp deleted');
                        });
                        rmdir(temp, function (err) {
                            if (err) throw err;
                            console.log('temp deleted');
                        });
                        reject('failed' + err);
                        throw err;
                    }
                })
                .on('progress', function (progress) {
                    logInfo.innerHTML = 'Processing: ' + progress.targetSize + ' KB converted (' +
                        progress.timemark + ')';
                })
                .on('end', () => {
                    unlinkSync(test, function (err) {
                        if (err) throw err;
                        console.log('file temp deleted');
                    });
                    rmdir(temp, function (err) {
                        if (err) throw err;
                        console.log('temp deleted');
                        logInfo.innerText = '';
                    });
                    resolve('Processing finished !');
                })
                .save(filePath);
        }).then((message) => {
            alert(message);
            remote.getCurrentWindow().close();
        }).catch((message) => {
            alert(message);
            remote.getCurrentWindow().close();
        });
    } catch (err) {
        alert(err);
    }
});