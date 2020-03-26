// Imports
const { desktopCapturer, remote, ipcRenderer } = require('electron');
const { writeFileSync, statSync, mkdirSync } = require('fs');
const { dialog, Menu } = remote;
require('../util/setTheme');

let currentData = ipcRenderer.sendSync('data-request');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.getAvailableEncoders((err, encoders) => {
    if (err) throw err;
    console.log('getAvailableEncoders', encoders);
});

// Global vars
let mediaRecorder; // MediaRecorder instance to capture footage
let recordedChunks = [];
let numRecordedChunks = 0;
let isRecording = false;
let localStream;
//TODO
//let microAudioStream;
//let includeMic = false;

// Buttons
const videoE = document.querySelector('video');
const startB = document.getElementById('startBtn');
const stopB = document.getElementById('stopBtn');
const videoBtn = document.getElementById('videoSelectBtn');
const pauseB = document.getElementById('pause');
const resumeB = document.getElementById('resume');
const root = document.documentElement;
//const microAudio = document.getElementById('micro-audio');

//Buttons 
startB.onclick = () => {
    if (videoE.srcObject != null) {
        mediaRecorder.start(0);
        isRecording = true;
        pauseB.style.display = 'block';
        startB.style.display = 'none';
        stopB.style.display = 'block';
        stopB.innerText = 'Recording... Click to stop.';
    } else alert('Select a video source to record!');
};

stopB.onclick = () => {
    isRecording = false;
    mediaRecorder.stop();
    startB.style.display = 'block';
    stopB.style.display = 'none';
    pauseB.style.display = 'none';
    resumeB.style.display = 'none';
};

pauseB.onclick = () => {
    mediaRecorder.pause();
    pauseB.style.display = 'none';
    resumeB.style.display = 'block';
    stopB.innerText = 'Record paused.';
}

resumeB.onclick = () => {
    mediaRecorder.resume();
    pauseB.style.display = 'block';
    resumeB.style.display = 'none';
    stopB.innerText = 'Resuming... Click to stop.';
}

videoBtn.onclick = getVideoSources;

// Get the available video sources
async function getVideoSources() {
    let getText = videoBtn.innerText;
    videoBtn.innerText = 'Getting video sources...';

    const inputSources = await desktopCapturer.getSources({
        types: ['window', 'screen']
    });

    const videoOptionsMenu = Menu.buildFromTemplate(
        inputSources.map(source => {
            return {
                label: source.name,
                click: () => {
                    videoBtn.innerText = 'Applying...';
                    selectSource(source);
                },
            };
        })
    );

    videoOptionsMenu.popup();
    videoBtn.innerText = getText;
}

let windowCaptured;

// Change the videoSource window to record
async function selectSource(source) {

    windowCaptured = source.name;

    const constraints = {
        audio: {
            mandatory: {
                chromeMediaSource: 'desktop',
            }
        },
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
            },
        }
    };

    // Create a Stream

    // Video with audio implemented
    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Preview the source in a video element
    videoBtn.innerText = windowCaptured;
    videoE.srcObject = localStream;
    videoE.play();
    let codec = currentData.streamCodec;
    console.log(codec);

    // Create the Media Recorder
    const options = { mimeType: `video/webm; codecs=${codec}` };
    mediaRecorder = new MediaRecorder(localStream, options);

    // Register Event Handlers
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;
}

// Captures all recorded chunks
function handleDataAvailable(e) {
    if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
        numRecordedChunks += e.data.byteLength;
    }
}

// Saves the video file on stop
async function handleStop(e) {
    if (!isRecording) {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const buffer = Buffer.from(await blob.arrayBuffer());

        let saveFailed = true;
        let format = 'mp4';
        let test = process.cwd() + '\\temp\\toConvert.webm'
        let temp = process.cwd() + '\\temp';
        let title = `${windowCaptured.replace(' ', '')}-${Date.now()}.${format}`;
        let filePath, canceled;

        while (saveFailed) {
            if (currentData.defaultPath == '') {
                var saveDialog = await dialog.showSaveDialog({
                    buttonLabel: 'Save video',
                    defaultPath: title
                });
                filePath = saveDialog.filePath;
                canceled = saveDialog.canceled;
            } else {
                filePath = currentData.defaultPath + '\\' + title;
                canceled = false;
            }
            if (filePath) {
                mkdirSync(temp, function () {
                    statSync(temp).isDirectory();//will be created at this point
                });
                writeFileSync(test, buffer, () => { console.log(`temp saved. ${test}`) });
                console.log(filePath);
                ipcRenderer.send('convert-stuff', filePath);
                saveFailed = false;
            } else if (canceled) {
                saveFailed = await confirm('Do you wish to still save the file?');
                if (!saveFailed) {
                    console.log('User declined to save video.');
                }
            }
        }
        numRecordedChunks = 0;
        recordedChunks = [];
    }
}

//ipc listeners
ipcRenderer.on('new-data-written', (e, data) => {
    currentData = data;
    if (currentData.theme == 'dark') {
        root.style.setProperty('--bgTheme', '#121212');
        root.style.setProperty('--fontColor', 'white');
    } else if (currentData.theme == 'light') {
        root.style.setProperty('--bgTheme', 'white');
        root.style.setProperty('--fontColor', 'black');
    }
});