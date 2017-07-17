import {
  tab48426,
  sampleTable,
  multtable,
  sinus,
  rectangle
} from './tables.es6';

import {BREAK, END} from '../common/constants.es6'

import UInt8 from '../types/UInt8.es6';

import SetMouthThroat from './set-mouth-throat.es6'
import CreateTransitions from './create-transitions.es6';
import CreateFrames from './create-frames.es6';

/** ASSIGN PITCH CONTOUR
 *
 * This subtracts the F1 frequency from the pitch to create a
 * pitch contour. Without this, the output would be at a single
 * pitch level (monotone).
 *
 * @param {Uint8Array} pitches
 * @param {Uint8Array} frequency1
 *
 */
function AssignPitchContour (pitches, frequency1) {
  for(let i = 0; i < 256; i++) {
    // subtract half the frequency of the formant 1.
    // this adds variety to the voice
    pitches[i] -= (frequency1[i] >> 1);
  }
}

/**
 * RESCALE AMPLITUDE
 *
 * Rescale volume from a linear scale to decibels.
 */
function RescaleAmplitude (amplitude) {
  const amplitudeRescale = [
    0x00, 0x01, 0x02, 0x02, 0x02, 0x03, 0x03, 0x04,
    0x04, 0x05, 0x06, 0x08, 0x09, 0x0B, 0x0D, 0x0F,
    0x00  //17 elements?
  ];
  for(let i = 255; i >= 0; i--) {
    amplitude[0][i] = amplitudeRescale[amplitude[0][i]];
    amplitude[1][i] = amplitudeRescale[amplitude[1][i]];
    amplitude[2][i] = amplitudeRescale[amplitude[2][i]];
  }
}
/**
 * @param {Uint8Array} phonemeindex
 * @param {Uint8Array} phonemeLength
 * @param {Uint8Array} stress
 * @param {Number} pitch
 * @param {Number} mouth
 * @param {Number} throat
 * @param {Number} speed
 * @param {Boolean} singmode
 *
 * @return Uint8Array
 */
export default function Renderer(phonemeindex, phonemeLength, stress, pitch, mouth, throat, speed, singmode) {
  pitch = (pitch || 64) & 0xFF;
  mouth = (mouth || 128) & 0xFF;
  throat = (throat || 128) & 0xFF;
  speed = (speed || 72) & 0xFF;
  singmode = singmode || false;

  // Writer to buffer.
  function Output (index, A) {
    // timetable for more accurate c64 simulation
    const timetable = [
      [162, 167, 167, 127, 128],
      [226, 60, 60, 0, 0],
      [225, 60, 59, 0, 0],
      [200, 0, 0, 54, 55],
      [199, 0, 0, 54, 54]
    ];
    Output.bufferpos += timetable[Output.oldTimeTableIndex][index];
    if (Output.bufferpos / 50 > Output.buffer.length) {
      throw new Error('Buffer overflow!');
    }
    Output.oldTimeTableIndex = index;
    // write a little bit in advance
    for (let k = 0; k < 5; k++) {
      Output.buffer[(Output.bufferpos / 50 | 0) + k] = (A & 15) * 16;
    }
  }
  // TODO, check for free the memory, 10 seconds of output should be more than enough
  Output.buffer = new Uint8Array(22050 * 10);
  Output.bufferpos = 0;
  Output.oldTimeTableIndex = 0;

  const freqdata = SetMouthThroat(mouth, throat);

  const phonemeIndexOutput  = new Uint8Array(60);
  const stressOutput        = new Uint8Array(60);
  const phonemeLengthOutput = new Uint8Array(60);

  // Main render loop.
  let srcpos  = 0; // Position in source
  let destpos = 0; // Position in output
  while(1) {
    let A = phonemeindex[srcpos];
    phonemeIndexOutput[destpos] = A;
    switch(A) {
      case END:
        Render(phonemeIndexOutput, phonemeLengthOutput, stressOutput);
        // Hack for PhantomJS which does not have slice() on UintArray8
        if (process.env.NODE_ENV === 'karma-test') {
          return Output.buffer.slice
            ? Output.buffer.slice(0, Math.floor(Output.bufferpos / 50))
            : new Uint8Array([].slice.call(Output.buffer).slice(0, Math.floor(Output.bufferpos / 50)));
        }
        return Output.buffer.slice(0, Math.floor(Output.bufferpos / 50));
      case BREAK:
        phonemeIndexOutput[destpos] = END;
        Render(phonemeIndexOutput, phonemeLengthOutput, stressOutput);
        destpos = 0;
        break;
      case 0:
        break;
      default:
        phonemeLengthOutput[destpos] = phonemeLength[srcpos];
        stressOutput[destpos]        = stress[srcpos];
        ++destpos;
    }
    ++srcpos;
  }

  /**
   * RENDER THE PHONEMES IN THE LIST
   *
   * The phoneme list is converted into sound through the steps:
   *
   * 1. Copy each phoneme <length> number of times into the frames list,
   *    where each frame represents 10 milliseconds of sound.
   *
   * 2. Determine the transitions lengths between phonemes, and linearly
   *    interpolate the values across the frames.
   *
   * 3. Offset the pitches by the fundamental frequency.
   *
   * 4. Render the each frame.
   */
  function Render (phonemeIndexOutput, phonemeLengthOutput, stressOutput) {
    if (phonemeIndexOutput[0] === 255) {
      return; //exit if no data
    }

    const [pitches, frequency, amplitude, sampledConsonantFlag] = CreateFrames(
      pitch,
      phonemeIndexOutput,
      phonemeLengthOutput,
      stressOutput,
      freqdata
    );

    let t = CreateTransitions(
      pitches,
      frequency,
      amplitude,
      phonemeIndexOutput,
      phonemeLengthOutput
    );

    if (!singmode) {
      AssignPitchContour(pitches, frequency[0]);
    }
    RescaleAmplitude(amplitude);

    if (process.env.NODE_ENV === 'development') {
      PrintOutput(pitches, frequency, amplitude, sampledConsonantFlag);
    }
    if (process.env.NODE_ENV === 'karma-test') {
      // Karma run, store data for karma retrieval.
      Renderer.karmaOutput = {
        sampledConsonantFlag: sampledConsonantFlag,
        amplitude1: amplitude[0],
        frequency1: frequency[0],
        amplitude2: amplitude[1],
        frequency2: frequency[1],
        amplitude3: amplitude[2],
        frequency3: frequency[2],
        pitches: pitches,
        freq1data: freqdata[0],
        freq2data: freqdata[1],
        freq3data: freqdata[2],
      };
    }

    ProcessFrames(t, speed, frequency, pitches, amplitude, sampledConsonantFlag);
  }

  /**
   * PROCESS THE FRAMES
   *
   * In traditional vocal synthesis, the glottal pulse drives filters, which
   * are attenuated to the frequencies of the formants.
   *
   * SAM generates these formants directly with sin and rectangular waves.
   * To simulate them being driven by the glottal pulse, the waveforms are
   * reset at the beginning of each glottal pulse.
   */
  function ProcessFrames(mem48, speed, frequency, pitches, amplitude, sampledConsonantFlag) {
    const CombineGlottalAndFormants = (phase1, phase2, phase3, Y) => {
      let tmp; // unsigned int
      tmp   = multtable[sinus[phase1]     | amplitude[0][Y]];
      tmp  += multtable[sinus[phase2]     | amplitude[1][Y]];
      tmp  += tmp > 255 ? 1 : 0; // if addition above overflows, we for some reason add one;
      tmp  += multtable[rectangle[phase3] | amplitude[2][Y]];
      tmp  += 136;
      tmp >>= 4; // Scale down to 0..15 range of C64 audio.

      Output(0, tmp & 0xf);
    };

    const RenderSample = (mem66, consonantFlag, mem49) => {
      const RenderVoicedSample = (hi, off, phase1) => {
        hi = hi & 0xFFFF; // unsigned short
        off = off & 0xFF; // unsigned char
        phase1 = phase1 & 0xFF; // unsigned char
        do {
          let sample = sampleTable[hi+off];
          let bit = 8;
          do {
            if ((sample & 128) !== 0) {
              Output(3, 26);
            } else {
              Output(4, 6);
            }
            sample <<= 1;
          } while(--bit !== 0);
          off++;
        } while (((++phase1) & 0xFF) !== 0);

        return off;
      };

      const RenderUnvoicedSample = (hi, off, mem53) => {
        hi = hi & 0xFFFF; // unsigned short
        off = off & 0xFF; // unsigned char
        mem53 = mem53 & 0xFF; // unsigned char
        do {
          let bit = 8;
          let sample = sampleTable[hi+off];
          do {
            if ((sample & 128) !== 0) {
              Output(2, 5);
            }
            else {
              Output(1, mem53);
            }
            sample <<= 1;
          } while (--bit !== 0);
        } while (((++off) & 0xFF) !== 0);
      };

      // mem49 == current phoneme's index - unsigned char

      // mask low three bits and subtract 1 get value to
      // convert 0 bits on unvoiced samples.
      let hibyte = (consonantFlag & 7) - 1;

      // determine which offset to use from table { 0x18, 0x1A, 0x17, 0x17, 0x17 }
      // T, S, Z                0          0x18
      // CH, J, SH, ZH          1          0x1A
      // P, F*, V, TH, DH       2          0x17
      // /H                     3          0x17
      // /X                     4          0x17

      let hi = hibyte * 256; // unsigned short
      // voiced sample?
      let pitch = consonantFlag & 248; // unsigned char
      if(pitch === 0) {
        // voiced phoneme: Z*, ZH, V*, DH
        pitch = pitches[mem49 & 0xFF] >> 4;
        return RenderVoicedSample(hi, mem66, pitch ^ 255);
      }
      RenderUnvoicedSample(hi, pitch ^ 255, tab48426[hibyte]);
      return mem66;
    };

    let speedcounter = new UInt8(72);
    let phase1 = new UInt8();
    let phase2 = new UInt8();
    let phase3 = new UInt8();
    let mem66 = new UInt8();
    let Y = new UInt8();
    let glottal_pulse = new UInt8(pitches[0]);
    let mem38 = new UInt8(glottal_pulse.get() - (glottal_pulse.get() >> 2)); // mem44 * 0.75

    while(mem48) {
      let flags = sampledConsonantFlag[Y.get()];

      // unvoiced sampled phoneme?
      if ((flags & 248) !== 0) {
        mem66.set(RenderSample(mem66.get(), flags, Y.get()));
        // skip ahead two in the phoneme buffer
        Y.inc(2);
        mem48 -= 2;
        speedcounter.set(speed);
      } else {
        CombineGlottalAndFormants(phase1.get(), phase2.get(), phase3.get(), Y.get());

        speedcounter.dec();
        if (speedcounter.get() === 0) {
          Y.inc(); //go to next amplitude
          // decrement the frame count
          mem48--;
          if(mem48 === 0) {
            return;
          }
          speedcounter.set(speed);
        }

        glottal_pulse.dec();

        if(glottal_pulse.get() !== 0) {
          // not finished with a glottal pulse

          mem38.dec();
          // within the first 75% of the glottal pulse?
          // is the count non-zero and the sampled flag is zero?
          if((mem38.get() !== 0) || (flags === 0)) {
            // reset the phase of the formants to match the pulse
            phase1.inc(frequency[0][Y.get()]);
            phase2.inc(frequency[1][Y.get()]);
            phase3.inc(frequency[2][Y.get()]);
            continue;
          }

          // voiced sampled phonemes interleave the sample with the
          // glottal pulse. The sample flag is non-zero, so render
          // the sample for the phoneme.
          mem66.set(RenderSample(mem66.get(), flags, Y.get()));
        }
      }

      glottal_pulse.set(pitches[Y.get()]);
      mem38.set(glottal_pulse.get() - (glottal_pulse.get() >> 2)); // mem44 * 0.75

      // reset the formant wave generators to keep them in
      // sync with the glottal pulse
      phase1.set(0);
      phase2.set(0);
      phase3.set(0);
    }
  }
}

function PrintOutput(pitches, frequency, amplitude, sampledConsonantFlag) {
  function pad(num) {
    let s = '00000' + num;
    return s.substr(s.length - 5);
  }
  console.log('===========================================');
  console.log('Final data for speech output:');
  let i = 0;
  console.log(' flags ampl1 freq1 ampl2 freq2 ampl3 freq3 pitch');
  console.log('------------------------------------------------');
  while(i < 255)
  {
    console.log(
      ' %s %s %s %s %s %s %s %s',
      pad(sampledConsonantFlag[i]),
      pad(amplitude[0][i]),
      pad(frequency[0][i]),
      pad(amplitude[1][i]),
      pad(frequency[1][i]),
      pad(amplitude[2][i]),
      pad(frequency[2][i]),
      pad(pitches[i])
    );
    i++;
  }
  console.log('===========================================');
}
