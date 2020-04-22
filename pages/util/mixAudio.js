// Module that mixes multiple streams audio tracks into only one audio track
// WebRTC can't record more than one audio track in a single stream, this module can be really useful
// Then user can get the returned value (one audio track), to combine with another video stream

module.exports.mix = function (streams) {
    if (typeof streams !== 'object') {throw new Error('Argument is not an Array.')}

    // Creates audio context
    let audioContext = new AudioContext();
    // Creates stream destination
    let dest = audioContext.createMediaStreamDestination();

    // This function will make all audio tracks connect to "dest", so we can get the track generated
    streams.forEach(stream => {
        let source = audioContext.createMediaStreamSource(stream);
        source.connect(dest);
    });

    // Returns the track mixed from the streams
    return dest.stream.getTracks()[0];
};