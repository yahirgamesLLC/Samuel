import {BREAK, END} from '../common/constants.es6'
import {PhonemeNameTable} from './tables.es6';
import Parser1 from './parse1.es6';
import Parser2 from './parse2.es6';
import AdjustLengths from './adjust-lengths.es6';
import CopyStress from './copy-stress.es6';
import SetPhonemeLength from './set-phoneme-length.es6';
import InsertBreath from './insert-breath.es6';
import ProlongPlosiveStopConsonantsCode41240 from './prolong-plosive-stop-consonants.es6';

/**
 * Parsed speech data.
 * @typedef {Object} ParsedSpeechData
 * @property {Uint8Array} stress
 * @property {Uint8Array} phonemeLength
 * @property {Uint8Array} phonemeindex
 */

/**
 * Parses speech data.
 *
 * @param {string} input
 *
 * @return {ParsedSpeechData|Boolean} The parsed data.
 */
export default function Parser (input) {
  const getPhoneme = (pos) => {
    if (process.env.NODE_ENV === 'development') {
      if (pos < 0 || pos > phonemeindex.length) {
        throw new Error('Out of bounds: ' + pos)
      }
    }
    return (pos === phonemeindex.length - 1) ? END : phonemeindex[pos]
  };
  const setPhoneme = (pos, value) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${pos} CHANGE: ${PhonemeNameTable[phonemeindex[pos]]} -> ${PhonemeNameTable[value]}`);
    }
    phonemeindex[pos]  = value;
  };

  /**
   * @param {Number} pos         The position in the phoneme array to insert at.
   * @param {Number} value       The phoneme to insert.
   * @param {Number} stressValue The stress.
   * @param {Number} [length]    The (optional) phoneme length, if not given, length will be 0.
   *
   * @return {undefined}
   */
  const insertPhoneme = (pos, value, stressValue, length) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${pos} INSERT: ${PhonemeNameTable[value]}`);
    }
    // ML : always keep last safe-guarding 255
    for(let i = 253; i >= pos; i--) {
      phonemeindex[i+1]  = phonemeindex[i];
      phonemeLength[i+1] = phonemeLength[i];
      stress[i+1]        = stress[i];
    }
    phonemeindex[pos]  = value;
    phonemeLength[pos] = length | 0;
    stress[pos]        = stressValue;
  };
  const getStress = (pos) => stress[pos];
  const setStress = (pos, stressValue) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `${pos} "${PhonemeNameTable[phonemeindex[pos]]}" SET STRESS: ${stress[pos]} -> ${stressValue}`
      );
    }
    stress[pos] = stressValue;
  };
  const getLength = (pos) => phonemeLength[pos];
  const setLength = (pos, length) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `${pos} "${PhonemeNameTable[phonemeindex[pos]]}" SET LENGTH: ${phonemeLength[pos]} -> ${length}`
      );
      if ((length & 128) !== 0) {
        throw new Error('Got the flag 0x80, see CopyStress() and SetPhonemeLength() comments!');
      }
      if (pos<0 || pos>phonemeindex.length) {
        throw new Error('Out of bounds: ' + pos)
      }
    }
    phonemeLength[pos] = length;
  };

  const stress = new Uint8Array(256); //numbers from 0 to 8
  const phonemeLength = new Uint8Array(256);
  const phonemeindex = new Uint8Array(256);

  // Clear the stress table.
  for(let i=0; i<256; i++) { stress[i] = 0; }

  let pos = 0;
  Parser1(
    input,
    (value) => {
      phonemeindex[pos++] = value;
    },
    (value) => {
      if (process.env.NODE_ENV === 'development') {
        if ((value & 128) !== 0) {
          throw new Error('Got the flag 0x80, see CopyStress() and SetPhonemeLength() comments!');
        }
      }
      stress[pos - 1] = value; /* Set stress for prior phoneme */
    }
  );
  phonemeindex[pos] = END;

  if (process.env.NODE_ENV === 'development') {
    PrintPhonemes(phonemeindex, phonemeLength, stress);
  }
  Parser2(insertPhoneme, setPhoneme, getPhoneme, getStress);
  CopyStress(getPhoneme, getStress, setStress);
  SetPhonemeLength(getPhoneme, getStress, setLength);
  AdjustLengths(getPhoneme, setLength, getLength);
  ProlongPlosiveStopConsonantsCode41240(getPhoneme, insertPhoneme, getStress);

  for (let i = 0;i<phonemeindex.length;i++) {
    if (phonemeindex[i] > 80) {
      phonemeindex[i] = END;
      break; // error: delete all behind it
    }
  }

  InsertBreath(getPhoneme, setPhoneme, insertPhoneme, getStress, getLength, setLength);

  if (process.env.NODE_ENV === 'development') {
    PrintPhonemes(phonemeindex, phonemeLength, stress);
  }

  return {
    phonemeindex: phonemeindex,
    phonemeLength: phonemeLength,
    stress: stress,
  };
}

/**
 * Debug printing.
 *
 * @param {Uint8Array} phonemeindex
 * @param {Uint8Array} phonemeLength
 * @param {Uint8Array} stress
 *
 * @return undefined
 */
function PrintPhonemes (phonemeindex, phonemeLength, stress) {
  function pad(num) {
    let s = '000' + num;
    return s.substr(s.length - 3);
  }

  let i = 0;
  console.log('==================================');
  console.log('Internal Phoneme presentation:');
  console.log(' pos  idx  phoneme  length  stress');
  console.log('----------------------------------');

  while((phonemeindex[i] !== 255) && (i < 255))
  {
    const name = (phoneme) => {
      if (phonemeindex[i] < 81) {
        return PhonemeNameTable[phonemeindex[i]];
      }
      if (phoneme === BREAK) {
        return '  ';
      }
      return '??'
    };
    console.log(
      ' %s  %s  %s       %s     %s',
      pad(i),
      pad(phonemeindex[i]),
      name(phonemeindex[i]),
      pad(phonemeLength[i]),
      pad(stress[i])
    );
    i++;
  }
  console.log('==================================');
}
