// Imports
const { desktopCapturer, remote, ipcRenderer } = require('electron');
const { writeFileSync, statSync, mkdirSync } = require('fs');
const { dialog, Menu, app } = remote;

const { mix } = require('../util/mixAudio'); // Stream audio mixer
require('../util/setTheme'); // Applies theme

var appVersion = app.getVersion();
console.log(appVersion)

// Import current data from index.js
let currentData = ipcRenderer.sendSync('data-request');

// Global vars
let mediaRecorder; // MediaRecorder instance to capture footage
let recordedChunks = [];
let isRecording = false;

let includeMic = false;
let includeSys = true;

let localStream;
let microAudioStream;

let currentSource;
let windowCaptured;

let durationDiscount;
let videoDuration;

// Buttons
const videoE = document.querySelector('video');
const startB = document.getElementById('startBtn');
const stopB = document.getElementById('stopBtn');
const videoBtn = document.getElementById('videoSelectBtn');
const pauseB = document.getElementById('pause');
const resumeB = document.getElementById('resume');
const microAudio = document.getElementById('micro-audio');
const sysAudio = document.getElementById('sys-audio');
const span = document.querySelector('span');
const root = document.documentElement;

//Buttons event listeners

// Start recording
const startR = () => {
  if (videoE.srcObject != null) {
    mediaRecorder.start();
    isRecording = true;
    videoDuration = Date.now();
    pauseB.style.display = 'block';
    startB.style.display = 'none';
    stopB.style.display = 'block';
    stopB.innerText = 'Recording... Click to stop.';
  } else alert('Select a video source to record!');
}

// Stops recording
const stopR = () => {
  mediaRecorder.stop();
  isRecording = false;
  startB.style.display = 'block';
  stopB.style.display = 'none';
  pauseB.style.display = 'none';
  resumeB.style.display = 'none';
}

// Pauses recording
const pauseR = () => {
  console.log('paused')
  isRecording = false;
  durationDiscount = Date.now();
  mediaRecorder.pause();
  pauseB.style.display = 'none';
  resumeB.style.display = 'block';
  stopB.innerText = 'Record paused.';
}

// Resumes recording
const resumeR = () => {
  console.log('resume')
  mediaRecorder.resume();
  videoDuration = videoDuration + (Date.now() - durationDiscount);
  isRecording = true;
  pauseB.style.display = 'block';
  resumeB.style.display = 'none';
  stopB.innerText = 'Resuming... Click to stop.';
}

startB.onclick = startR;
stopB.onclick = stopR;
pauseB.onclick = pauseR;
resumeB.onclick = resumeR;

// Get video sources (videos, screens)
videoBtn.onclick = () => {
  getVideoSources(['window', 'screen', 'camera']);
};

microAudio.onclick = microAudioCheck; // Checks main microphone audio

sysAudio.onclick = () => { // Just a checkbox if user wants to include system audio
  includeSys = sysAudio.checked;
  // If stream is already up, it refreshes the stream with the current source
  if (localStream != undefined || localStream != null) {
    selectSource(currentSource);
  }
}

// Checks microphone audio, and marks to add the audio to the recording
function microAudioCheck() {
  includeMic = microAudio.checked;

  // If checkbox is marked and microphone is ok, then ipcRenderer checks microphone audio 
  if (includeMic) {
    navigator.webkitGetUserMedia({ audio: true, video: false }, (stream) => {
      console.log('Received audio stream successfully.');
      microAudioStream = stream;
    }, (err) => {
      dialog.showErrorBox('An error occurred', err.message);
    });
  }
  // If stream is already up, it refreshes the stream with the current source
  if (localStream != undefined || localStream != null) {
    selectSource(currentSource);
  }
}

// Get the available video sources
async function getVideoSources(inputTypes = ['window', 'screen']) {
  let getText = videoBtn.innerText;
  videoBtn.innerText = 'Getting video sources...';

  // Gets sources
  const inputSources = await desktopCapturer.getSources({
    types: inputTypes
  });

  // Builds menu from inputSources
  const videoOptionsMenu = Menu.buildFromTemplate(
    inputSources.map(source => {
      return {
        label: source.name,
        sublabel: source.id,
        click: () => {
          videoBtn.innerText = 'Applying...';
          currentSource = source;
          selectSource(source);
          console.log(source);
        },
      };
    })
  );

  videoOptionsMenu.popup();
  videoBtn.innerText = getText;
}

// Change the videoSource window to record
async function selectSource(source) {
  // Sets var to get the window name, so the video title can get it
  windowCaptured = source.name;

  // Setting up stream
  localStream = await navigator.mediaDevices.getUserMedia({
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
  });

  // Audio implementation conditions
  if (includeMic && includeSys) {
    // If user wants to record mic audio and audio from system
    const videoStream = localStream.getVideoTracks()[0];
    const audioStream = mix([localStream, microAudioStream]);
    localStream = new MediaStream([videoStream, audioStream]);
  } else if (includeMic && !includeSys) {
    // If user only wants to record the mic audio
    localStream.addTrack(microAudioStream.getAudioTracks()[0]);
    localStream.removeTrack(localStream.getAudioTracks()[0]);
  } else if (!includeMic && !includeSys) {
    // If user does not want any audio on video
    localStream.removeTrack(localStream.getAudioTracks()[0]);
  }
  // If every condition fails, user will record sys audio only

  // Preview the source in a video element
  videoBtn.innerText = windowCaptured;
  videoE.srcObject = localStream;
  videoE.play();

  // Creates the Media Recorder
  try {
    const options = { mimeType: `video/webm; codecs=${currentData.streamCodec}` };
    mediaRecorder = new MediaRecorder(localStream, options);
    // Register Event Handlers
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;
  } catch (err) {
    console.assert(false, 'Exception while creating MediaRecorder: ' + err);
    return;
  }
}

// Captures all recorded chunks
function handleDataAvailable(e) {
  if (e.data && e.data.size > 0) {
    recordedChunks.push(e.data);
  }
}

// Saves the video file on stop
async function handleStop(e) {
  if (durationDiscount !== 0 && durationDiscount !== undefined) {
    videoDuration = videoDuration + (Date.now() - durationDiscount)
  };
  let finalDuration = Date.now() - videoDuration;

  // Creates blob, and then buffers from blob
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const buffer = Buffer.from(await blob.arrayBuffer());

  // Only works when default path does not exists; TODO: confirmation to save file with default path.
  let saveFailed = true;
  // Makes temp folder for the webm file
  let temp = process.cwd() + '\\temp';
  // Sets path for the file in temp
  let vidTemp = temp + '\\toConvert.webm';
  // Removes emojis from the string, which would cause an error on converting
  let fixTitle = windowCaptured.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');

  // Sets up title and vars
  let title = `${fixTitle}-${Date.now()}`;
  let filePath, canceled;

  // Loop that first asks user where they want to save
  // If user rejects to save, program will still ask if they want to save the video
  // If yes, loop is canceled and clears the recording, if user still wants to save the video, loops the function
  while (saveFailed) {
    // If user does not have a default path, program will ask user the path they want to save the video webm
    if (!currentData.defaultPath) {
      let saveDialog = await dialog.showSaveDialog({
        buttonLabel: 'Save video',
        defaultPath: title
      });
      filePath = saveDialog.filePath;
      canceled = saveDialog.canceled;
      // else, if user has default path to save video, skips to convert
      // WIP
    } else {
      // Sets up vars from current data
      filePath = currentData.defaultPath + '\\' + title;
      canceled = false;
    }

    // If filePath exists, makes temp and sends signal to convert the webm video
    if (filePath) {
      // Makes temp folder
      mkdirSync(temp, function () {
        // Will be created at this point
        statSync(temp).isDirectory();
      });

      // Writes video webm in temp folder
      writeFileSync(vidTemp, buffer, () => { console.log(`temp saved. ${vidTemp}`) });

      // Sends ipc event to main
      let sendConverter = {
        path: filePath,
        duration: finalDuration,
      }
      ipcRenderer.send('convert-stuff', sendConverter);

      // Stops loop
      saveFailed = false;
    } else if (canceled) {
      // Asks user if they still want to save the video
      saveFailed = await confirm('Do you wish to still save the file?');
      // If they don't want it, converting video will be canceled
      if (!saveFailed) {
        console.log('User declined to save video.');
      }
    }
  }
  // Video chunks will reset to an empty array
  recordedChunks = [];
  durationDiscount = 0;
}

// IPC listeners

// IPC listener when user saves new config.json on program
ipcRenderer.on('new-data-written', (e, data) => {
  // When user changes stream codec, preview will try to update
  if (currentData.streamCodec !== data.streamCodec) {
    try {
      selectSource(currentSource);
    } catch (err) {
      alert('Could not refresh stream, try again.');
    }
  }

  // Updates currentData to a new submitted one
  currentData = data;

  // Updates theme on main window
  if (currentData.theme == 'dark') {
    root.style.setProperty('--bgTheme', '#121212');
    root.style.setProperty('--fontColor', 'white');
  } else if (currentData.theme == 'light') {
    root.style.setProperty('--bgTheme', 'white');
    root.style.setProperty('--fontColor', 'black');
  }
});

// IPC Listeners
ipcRenderer.on('start-recording', () => { if (!isRecording) startR(); if (currentSource == undefined) startR();} );
ipcRenderer.on('stop-recording', () => { if (isRecording || mediaRecorder.state === 'paused') stopR() });
ipcRenderer.on('start-stop-shortcut', () => { if (isRecording || mediaRecorder.state === 'paused') { stopR() } else if (!isRecording) { startR() };});

ipcRenderer.on('pause-recording', () => { if (mediaRecorder.state === 'recording') { pauseR() }; });
ipcRenderer.on('resume-recording', () => { if (mediaRecorder.state === 'paused') { resumeR() }; });
ipcRenderer.on('pause-resume-shortcut', () => { 
  if (mediaRecorder !== undefined && mediaRecorder.state === 'recording') { 
    pauseR();
  } else if (mediaRecorder !== undefined && mediaRecorder.state === 'paused') {
    resumeR();
  }; 
})

ipcRenderer.on('update-message', (e, message) => {
  //span.innerText = message;
  console.log(message);
})