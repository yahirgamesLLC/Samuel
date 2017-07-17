import {
  ampl1data,
  ampl2data,
  ampl3data,
  sampledConsonantFlags,
  tab47492,
} from './tables.es6';
import {END} from '../common/constants.es6'
import {PHONEME_PERIOD, PHONEME_QUESTION} from '../parser/constants.es6';

const RISING_INFLECTION = 1;
const FALLING_INFLECTION = 255;

/** CREATE FRAMES
 *
 * The length parameter in the list corresponds to the number of frames
 * to expand the phoneme to. Each frame represents 10 milliseconds of time.
 * So a phoneme with a length of 7 = 7 frames = 70 milliseconds duration.
 *
 * The parameters are copied from the phoneme to the frame verbatim.
 *
 * Returns:
 *   [
 *      pitches,
 *      frequency,
 *      amplitude,
 *      sampledConsonantFlag
 *   ]
 *
 * @param {Number}       pitch                Input
 * @param {Uint8Array}   phonemeIndexOutput   Input
 * @param {Uint8Array}   phonemeLengthOutput  Input
 * @param {Uint8Array}   stressOutput         Input
 * @param {Uint8Array[]} frequencyData        Input
 *
 * @return Array
 */
export default function CreateFrames (
  pitch,
  phonemeIndexOutput,
  phonemeLengthOutput,
  stressOutput,
  frequencyData) {
  const pitches              = new Uint8Array(256);
  const frequency            = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  const amplitude            = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  const sampledConsonantFlag = new Uint8Array(256);

  /**
   * Create a rising or falling inflection 30 frames prior to index X.
   * A rising inflection is used for questions, and a falling inflection is used for statements.
   */
  const AddInflection = (inflection, pos) => {
    // store the location of the punctuation
    let end = pos;
    if (pos < 30) {
      pos = 0;
    } else {
      pos -= 30;
    }

    let A;
    // FIXME: Explain this fix better, it's not obvious
    // ML : A =, fixes a problem with invalid pitch with '.'
    while ((A = pitches[pos]) === 127) {
      ++pos;
    }

    while (pos !== end) {
      // add the inflection direction
      A += inflection;

      // set the inflection
      pitches[pos] = A;

      while ((++pos !== end) && pitches[pos] === 255) { /* keep looping */}
    }
  };

  let X = 0;
  let i = 0;
  while(i < 256) {
    // get the phoneme at the index
    let phoneme = phonemeIndexOutput[i];
    // if terminal phoneme, exit the loop
    if (phoneme === END) break;
    if (phoneme === PHONEME_PERIOD) {
      AddInflection(RISING_INFLECTION, X);
    } else if (phoneme === PHONEME_QUESTION) {
      AddInflection(FALLING_INFLECTION, X);
    }

    // get the stress amount (more stress = higher pitch)
    let phase1 = tab47492[stressOutput[i] + 1];
    // get number of frames to write
    // copy from the source to the frames list
    for (let frames = phonemeLengthOutput[i];frames > 0;frames--) {
      frequency[0][X] = frequencyData[0][phoneme];     // F1 frequency
      frequency[1][X] = frequencyData[1][phoneme];     // F2 frequency
      frequency[2][X] = frequencyData[2][phoneme];     // F3 frequency
      amplitude[0][X] = ampl1data[phoneme];     // F1 amplitude
      amplitude[1][X] = ampl2data[phoneme];     // F2 amplitude
      amplitude[2][X] = ampl3data[phoneme];     // F3 amplitude
      sampledConsonantFlag[X] = sampledConsonantFlags[phoneme]; // phoneme data for sampled consonants
      pitches[X] = pitch + phase1;      // pitch
      X++;
    }
    ++i;
  }

  return [
    pitches,
    frequency,
    amplitude,
    sampledConsonantFlag
  ];
}
