import {blendRank, inBlendLength, outBlendLength} from './tables.es6';

/**
 * CREATE TRANSITIONS.
 *
 * Linear transitions are now created to smoothly connect each
 * phoeneme. This transition is spread between the ending frames
 * of the old phoneme (outBlendLength), and the beginning frames
 * of the new phoneme (inBlendLength).
 *
 * To determine how many frames to use, the two phonemes are
 * compared using the blendRank[] table. The phoneme with the
 * smaller score is used. In case of a tie, a blend of each is used:
 *
 *      if blendRank[phoneme1] ==  blendRank[phomneme2]
 *          // use lengths from each phoneme
 *          outBlendFrames = outBlend[phoneme1]
 *          inBlendFrames = outBlend[phoneme2]
 *      else if blendRank[phoneme1] < blendRank[phoneme2]
 *          // use lengths from first phoneme
 *          outBlendFrames = outBlendLength[phoneme1]
 *          inBlendFrames = inBlendLength[phoneme1]
 *      else
 *          // use lengths from the second phoneme
 *          // note that in and out are swapped around!
 *          outBlendFrames = inBlendLength[phoneme2]
 *          inBlendFrames = outBlendLength[phoneme2]
 *
 *  Blend lengths can't be less than zero.
 *
 * For most of the parameters, SAM interpolates over the range of the last
 * outBlendFrames-1 and the first inBlendFrames.
 *
 * The exception to this is the Pitch[] parameter, which is interpolates the
 * pitch from the center of the current phoneme to the center of the next
 * phoneme.
 *
 * @param {Uint8Array} pitches
 * @param {Uint8Array} frequency
 * @param {Uint8Array} amplitude
 * @param {Array} phonemeIndex
 * @param {Array} phonemeLength
 *
 * @return {Number}
 */
export default function CreateTransitions(pitches, frequency, amplitude, phonemeIndex, phonemeLength) {
  // 0=pitches
  // 1=frequency1
  // 2=frequency[1]
  // 3=frequency3
  // 4=amplitude1
  // 5=amplitude2
  // 6=amplitude3
  const tables = [pitches, frequency[0], frequency[1], frequency[2], amplitude[0], amplitude[1], amplitude[2]];
  const Read = (table, pos) => {
    if (process.env.NODE_ENV === 'development') {
      if (table < 0 || table > tables.length -1 ) {
        throw new Error(`Error invalid table in Read: ${table}`);
      }
    }
    return tables[table][pos];
  };

  const Write = (table, pos, value) => {
    if (process.env.NODE_ENV === 'development') {
      if (table < 0 || table > tables.length -1 ) {
        throw new Error(`Error invalid table in Read: ${table}`);
      }
    }
    return tables[table][pos] = value;
  };

  // linearly interpolate values
  const interpolate = (width, table, frame, mem53) => {
    let sign      = (mem53 < 0);
    let remainder = Math.abs(mem53) % width;
    let div       = (mem53 / width) | 0;

    let error = 0;
    let pos   = width;

    while (--pos > 0) {
      let val = Read(table, frame) + div;
      error += remainder;
      if (error >= width) {
        // accumulated a whole integer error, so adjust output
        error -= width;
        if (sign) {
          val--;
        } else if (val) {
          // if input is 0, we always leave it alone
          val++;
        }
      }
      Write(table, ++frame, val); // Write updated value back to next frame.
      val += div;
    }
  };

  const interpolate_pitch = (width, pos, mem49, phase3) => {
    // unlike the other values, the pitches[] interpolates from
    // the middle of the current phoneme to the middle of the
    // next phoneme

    // half the width of the current and next phoneme
    let cur_width  = phonemeLength[pos] >> 1;
    let next_width = phonemeLength[pos+1] >> 1;
    // sum the values
    width = cur_width + next_width;
    let pitch = pitches[next_width + mem49] - pitches[mem49 - cur_width];
    interpolate(width, 0, phase3, pitch);
  };

  let phase1;
  let phase2;
  let mem49 = 0;
  for (let pos=0;pos<phonemeIndex.length - 1;pos++) {
    let phoneme      = phonemeIndex[pos];
    let next_phoneme = phonemeIndex[pos+1];

    // get the ranking of each phoneme
    let next_rank = blendRank[next_phoneme];
    let rank      = blendRank[phoneme];

    // compare the rank - lower rank value is stronger
    if (rank === next_rank) {
      // same rank, so use out blend lengths from each phoneme
      phase1 = outBlendLength[phoneme];
      phase2 = outBlendLength[next_phoneme];
    } else if (rank < next_rank) {
      // next phoneme is stronger, so us its blend lengths
      phase1 = inBlendLength[next_phoneme];
      phase2 = outBlendLength[next_phoneme];
    } else {
      // current phoneme is stronger, so use its blend lengths
      // note the out/in are swapped
      phase1 = outBlendLength[phoneme];
      phase2 = inBlendLength[phoneme];
    }
    mem49 += phonemeLength[pos];
    let speedcounter = mem49 + phase2;
    let phase3       = mem49 - phase1;
    let transition   = phase1 + phase2; // total transition?

    if (((transition - 2) & 128) === 0) {
      interpolate_pitch(transition, pos, mem49, phase3);
      for (let table = 1; table < 7;table++) {
        // tables:
        // 0  pitches[]
        // 1  frequency1
        // 2  frequency[1]
        // 3  frequency3
        // 4  amplitude1
        // 5  amplitude2
        // 6  amplitude3
        let value = Read(table, speedcounter) - Read(table, phase3);
        interpolate(transition, table, phase3, value);
      }
    }
  }

  // add the length of this phoneme
  return (mem49 + phonemeLength[phonemeLength.length - 1]) & 0xFF;
}
