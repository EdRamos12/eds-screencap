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
let localStream;
let currentSource;
let includeMic = false;
let includeSys = true;
let microAudioStream;
let windowCaptured;

// Buttons
const videoE = document.querySelector('video');
const startB = document.getElementById('startBtn');
const stopB = document.getElementById('stopBtn');
const videoBtn = document.getElementById('videoSelectBtn');
const pauseB = document.getElementById('pause');
const resumeB = document.getElementById('resume');
const microAudio = document.getElementById('micro-audio');
const sysAudio = document.getElementById('sys-audio');
const root = document.documentElement;

//Buttons 
startB.onclick = () => {
    if (videoE.srcObject != null) {
        mediaRecorder.start();
        pauseB.style.display = 'block';
        startB.style.display = 'none';
        stopB.style.display = 'block';
        stopB.innerText = 'Recording... Click to stop.';
    } else alert('Select a video source to record!');
};

stopB.onclick = () => {
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

microAudio.onclick = () => {
    microAudioCheck();
    if (localStream != undefined || localStream != null) {
        selectSource(currentSource);
    }
};

sysAudio.onclick = () => {
    includeSys = sysAudio.checked;
    if (localStream != undefined || localStream != null) {
        selectSource(currentSource);
    }
}

function microAudioCheck() {
    includeMic = microAudio.checked;
    console.log('Audio = ', includeMic);
    if (includeMic) {
        navigator.webkitGetUserMedia({ audio: true, video: false }, getMicroAudio, getUserMediaError);
    }
}

const getMicroAudio = (stream) => {
    console.log('Received audio stream.')
    microAudioStream = stream;
    stream.onended = () => { console.log('Micro audio ended.') }
}

const getUserMediaError = () => {
    console.log('getUserMedia() failed.');
}

function mix(streams) {
    const audioContext = new AudioContext();
    const dest = audioContext.createMediaStreamDestination();
    streams.forEach(stream => {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(dest);
    });
    return dest.stream.getTracks()[0];
}

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
                    currentSource = source;
                    selectSource(source);
                },
            };
        })
    );
    videoOptionsMenu.popup();
    videoBtn.innerText = getText;
}

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

    // Implements Mic audio if true
    if (includeMic && includeSys) { // If user wants to record mic audio and audio from system
        const videoStream = localStream.getVideoTracks()[0];
        const audioStream = mix([localStream, microAudioStream]);
        localStream = new MediaStream([videoStream, audioStream]);
    } else if (includeMic && !includeSys) { // If user only wants to record the mic audio
        localStream.addTrack(microAudioStream.getAudioTracks()[0]);
        localStream.removeTrack(localStream.getAudioTracks()[0]);
    } else if (!includeMic && !includeSys) { // If user does not want any audio on video
        localStream.removeTrack(localStream.getAudioTracks()[0]);
    } // If every condition fails, user will record sys audio only

    // Preview the source in a video element
    videoBtn.innerText = windowCaptured;
    videoE.srcObject = localStream;
    videoE.play();
    let codec = currentData.streamCodec;

    // Create the Media Recorder
    try {
        const options = { mimeType: `video/webm; codecs=${codec}` };
        mediaRecorder = new MediaRecorder(localStream, options);
    } catch (err) {
        console.assert(false, 'Exception while creating MediaRecorder: ' + err);
        return
    }

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
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const buffer = Buffer.from(await blob.arrayBuffer());
    
    let saveFailed = true;
    let format = 'mp4';
    let temp = process.cwd() + '\\temp';
    let vidTemp = temp + '\\toConvert.webm';
    let tempTest = 'C:\\Users\\Eduardo\\Desktop\\webtests\\fix-' + Date.now() + '.webm';
    let fixTitle = windowCaptured.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    let title = `${fixTitle}-${Date.now()}.${format}`;
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
            writeFileSync(tempTest, buffer, () => { console.log(`temptest saved. ${vidTemp}`) });
            writeFileSync(vidTemp, buffer, () => { console.log(`temp saved. ${vidTemp}`) });
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

//ipc listeners
ipcRenderer.on('new-data-written', (e, data) => {
    if (currentData.streamCodec !== data.streamCodec) {
        try {
            selectSource(currentSource);
        } catch (err) {
            alert('Could not refresh stream, try again.');
        }
    }
    currentData = data;
    if (currentData.theme == 'dark') {
        root.style.setProperty('--bgTheme', '#121212');
        root.style.setProperty('--fontColor', 'white');
    } else if (currentData.theme == 'light') {
        root.style.setProperty('--bgTheme', 'white');
        root.style.setProperty('--fontColor', 'black');
    }
});