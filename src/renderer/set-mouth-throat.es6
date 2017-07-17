import {freq1data, freq2data, freq3data} from './tables.es6';

// mouth formants (F1) 5..29
const mouthFormants5_29 = [
  0, 0, 0, 0, 0, 10,
  14, 19, 24, 27, 23, 21, 16, 20, 14, 18, 14, 18, 18,
  16, 13, 15, 11, 18, 14, 11, 9, 6, 6, 6
];
// formant 1 frequencies (mouth) 48..53
const mouthFormants48_53 = [19, 27, 21, 27, 18, 13];

// throat formants (F2) 5..29
const throatFormants5_29 = [
  255, 255,
  255, 255, 255, 84, 73, 67, 63, 40, 44, 31, 37, 45, 73, 49,
  36, 30, 51, 37, 29, 69, 24, 50, 30, 24, 83, 46, 54, 86,
];
// formant 2 frequencies (throat) 48..53
const throatFormants48_53 = [72, 39, 31, 43, 30, 34];

function trans(mem39212, mem39213) {
  return ((((mem39212 & 0xFF) * (mem39213 & 0xFF)) >> 8) & 0xFF) << 1;
}

/**
 * SAM's voice can be altered by changing the frequencies of the
 * mouth formant (F1) and the throat formant (F2). Only the voiced
 * phonemes (5-29 and 48-53) are altered.
 *
 * This returns the three base frequency arrays.
 *
 * @return {Array}
 */
export default function SetMouthThroat(mouth, throat) {
  let initialFrequency;
  let newFrequency = 0;
  let pos = 5;
  const freqdata = [freq1data.slice(), freq2data.slice(), freq3data];

  // recalculate formant frequencies 5..29 for the mouth (F1) and throat (F2)
  while(pos < 30) {
    // recalculate mouth frequency
    initialFrequency = mouthFormants5_29[pos];
    if (initialFrequency !== 0) {
      newFrequency = trans(mouth, initialFrequency);
    }
    freqdata[0][pos] = newFrequency;

    // recalculate throat frequency
    initialFrequency = throatFormants5_29[pos];
    if(initialFrequency !== 0) {
      newFrequency = trans(throat, initialFrequency);
    }
    freqdata[1][pos] = newFrequency;
    pos++;
  }

  // recalculate formant frequencies 48..53
  pos = 0;
  while(pos < 6) {
    // recalculate F1 (mouth formant)
    initialFrequency = mouthFormants48_53[pos];
    newFrequency = trans(mouth, initialFrequency);
    freqdata[0][pos+48] = newFrequency;
    // recalculate F2 (throat formant)
    initialFrequency = throatFormants48_53[pos];
    newFrequency = trans(throat, initialFrequency);
    freqdata[1][pos+48] = newFrequency;
    pos++;
  }

  return freqdata;
}
