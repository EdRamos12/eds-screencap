// Imports
const { ipcRenderer, remote } = require('electron');
const { rmdir, unlinkSync } = require('fs');
const { dialog } = remote;

// Sets up ffmpeg
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegInstaller.replace('app.asar', 'app.asar.unpacked')) // replace .asar path to unpacked lib
ffmpeg.getAvailableEncoders((err, encoders) => { // Get encoders
	console.log('getAvailableEncoders', encoders);
});

// DOM content
const logInfo = document.querySelector('span');
const progressBar = document.querySelector('.progress');

require('../util/setTheme'); // Sets window theme

// Makes temp folder for the webm file
let temp = process.cwd() + '\\temp';
// Sets path for the file in temp
let vidTemp = temp + '\\toConvert.webm';

// TODO: make more formats to convert to
// sets up default info for the vars
let format = 'mp4';
let codec = 'libx264';

function convertDurationToMilliseconds(string) {
	let durationSplit = string.split(':');
	let splitSeconds = durationSplit[2].split('.');
	let convertHoursToMinutes = Number(durationSplit[0]) * 60 + Number(durationSplit[1]);
	let convertMinutesToSeconds = convertHoursToMinutes * 60 + Number(splitSeconds[0]);
	return (convertMinutesToSeconds * 1000) + (Number(splitSeconds[1]) * 10);
}

// Once DOM content is loaded, then starts converting process
document.addEventListener('DOMContentLoaded', function (e) {
	let filePath, totalDuration;
	const converterStuff = ipcRenderer.sendSync('converter-loaded');
	console.log('DOM loaded, initializing converter');
	// Requests data
	let currentData = ipcRenderer.sendSync('data-request');
	// Gets info
	format = currentData.outputFormat;
	codec = currentData.outputCodec;
	try {
		if (!!converterStuff) {
			filePath = converterStuff.path;
			totalDuration = converterStuff.duration;
		}
		setTimeout(() => {
			console.log(totalDuration)
			// Sends ipc message saying that window content is loaded, to then get the file path
			new Promise((resolve, reject) => {
				// Starts converting things
				ffmpeg(vidTemp).withVideoCodec(codec).toFormat(format)
					.on('error', (err) => {
						// When ffmpeg causes an error, it deletes the temp 
						if (err) {
							// Stops Promise
							dialog.showErrorBox('An error ocurred while converting', err.message);
							let makeBkp = confirm('It appears that there was an error converting the file. Would you like to save the backup?');
							if (makeBkp) { reject(true) } else { 
								unlinkSync(vidTemp, function (err) {
									if (err) throw err;
									console.log('file temp deleted');
								});
								rmdir(temp, function (err) {
									if (err) throw err;
									console.log('temp deleted');
									logInfo.innerText = 'All done!';
								});
								reject(false); 
							};
							throw err;
						}
					})
					.on('progress', function (progress) {
						if (totalDuration != 0) {
							// Percentage stuff
							let obtainedDuration = convertDurationToMilliseconds(progress.timemark);
							let percent = obtainedDuration * 100 / totalDuration;
							ipcRenderer.send('taskbar-percent', parseInt(percent) / 100);
							// Informs user the progress from the converting process
							logInfo.innerHTML = `Processing ${progress.targetSize} KB converted (${progress.timemark} | ${parseInt(percent)}%)`;
							progressBar.style.width = percent + '%';
						} else {
							logInfo.innerHTML = `Processing ${progress.targetSize} KB converted (${progress.timemark})`;
							progressBar.style.display = 'none';
						}
					})
					.on('end', () => {
						// When converting is finished, it deletes the temp 
						unlinkSync(vidTemp, function (err) {
							if (err) throw err;
							console.log('file temp deleted');
						});
						rmdir(temp, function (err) {
							if (err) throw err;
							console.log('temp deleted');
							logInfo.innerText = 'All done!';
						});
						// Stops Promise
						resolve('Processing finished!');
					})
					.save(`${filePath}.${format}`);
			}).then((message) => { // Once Promise is over, alerts user it finished processing
				ipcRenderer.send('converter-done');
				alert(message);
				remote.getCurrentWindow().close();
			}).catch((message) => { // If Promise catches and error, it will show user the error message
				if (message) ipcRenderer.send('converter-failed');
				remote.getCurrentWindow().close();
			});
		}, 1000)
	} catch (err) {
		dialog.showErrorBox('An error ocurred while converting', err.message);
	}
	ipcRenderer.on('convert-backup', (e, data) => {
		console.log(data);
		codec = data.settings.outputCodec;
		format = data.settings.outputFormat;
		vidTemp = data.path;
		filePath = data.path;
		totalDuration = 0;
	});
});