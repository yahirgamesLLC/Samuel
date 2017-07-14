import {text2Uint8Array, Uint32ToUint8Array, Uint16ToUint8Array} from '../util/util.es6';

const ENABLE_DEPRECATED_MOZILLA_AUDIO = false;

/**
 *
 * @param {AudioContext} context
 * @param audiobuffer
 */
function Play(context, audiobuffer) {
  return new Promise((resolve) => {
    let source = context.createBufferSource();
    let soundBuffer = context.createBuffer(1, audiobuffer.length, 22050);
    let buffer = soundBuffer.getChannelData(0);
    for(let i=0; i<audiobuffer.length; i++) {
      buffer[i] = audiobuffer[i];
    }
    source.buffer = soundBuffer;
    source.connect(context.destination);
    source.onended = () => {
      resolve(true);
    };
    source.start(0);
  });
}

if (ENABLE_DEPRECATED_MOZILLA_AUDIO) {
function PlayMozilla(context, audiobuffer) {
  return new Promise((resolve) => {
    function play () {
      let written = context.mozWriteAudio(audiobuffer);
      let diff = audiobuffer.length - written;
      if (diff <= 0) {
        resolve(true);
        return;
      }
      let buffer = new Float32Array(diff);
      for (let i = 0; i<diff; i++) {
        buffer[i] = audiobuffer[i+written];
      }
      window.setTimeout(function(){
        PlayMozilla(context, buffer)
      }, 500);
    }
    window.setTimeout(function() {
      play(context, audiobuffer);
    }, 0);
  });
}
}

let context = null;
let player = null;

/**
 * Play an audio buffer.
 *
 * @param {Float32Array} audiobuffer
 */
export function PlayBuffer(audiobuffer) {
  if (null === context) {
    ((window) => {
      ['', 'webkit'].some((prefix) => {
        const implementation = prefix + 'AudioContext';
        if (typeof window[implementation] !== "undefined") {
          context = new window[implementation]();
          player = Play;
          return;
        }
        if (ENABLE_DEPRECATED_MOZILLA_AUDIO) {
          if (typeof Audio !== "undefined") {
            context = new Audio();
            context.mozSetup(1, 22050);
            player = PlayMozilla;
          }
        }
      });
    })(window);
  }

  if (null === player) { throw new Error('No player available!'); }

  return player(context, audiobuffer);
}

/**
 *
 * @param {Uint8Array} audiobuffer
 */
export function RenderBuffer (audiobuffer) {
  let filename = 'sam.wav';

  // Calculate buffer size.
  const realbuffer = new Uint8Array(
    4 + // "RIFF"
    4 + // uint32 filesize
    4 + // "WAVE"
    4 + // "fmt "
    4 + // uint32 fmt length
    2 + // uint16 fmt
    2 + // uint16 channels
    4 + // uint32 sample rate
    4 + // uint32 bytes per second
    2 + // uint16 block align
    2 + // uint16 bits per sample
    4 + // "data"
    4 + // uint32 chunk length
    audiobuffer.length
  );

  let pos=0;
  const write = (buffer) => {
    realbuffer.set(buffer, pos);
    pos+=buffer.length;
  };

  //RIFF header
  write(text2Uint8Array('RIFF')); // chunkID
  write(Uint32ToUint8Array(audiobuffer.length + 12 + 16 + 8 - 8)); // ChunkSize
  write(text2Uint8Array('WAVE')); // riffType
  //format chunk
  write(text2Uint8Array('fmt '));
  write(Uint32ToUint8Array(16)); // ChunkSize
  write(Uint16ToUint8Array(1)); // wFormatTag - 1 = PCM
  write(Uint16ToUint8Array(1)); // channels
  write(Uint32ToUint8Array(22050)); // samplerate
  write(Uint32ToUint8Array(22050)); // bytes/second
  write(Uint16ToUint8Array(1)); // blockalign
  write(Uint16ToUint8Array(8)); // bits per sample
  //data chunk
  write(text2Uint8Array('data'));
  write(Uint32ToUint8Array(audiobuffer.length)); // buffer length
  write(audiobuffer);

  const blob = new Blob([realbuffer], {type: 'audio/vnd.wave'});

  const url     = (window.URL || window.webkitURL);
  const fileURL = url.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = fileURL;
  a.target      = '_blank';
  a.download    = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  url.revokeObjectURL(fileURL);
}
