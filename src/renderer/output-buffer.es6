export default function CreateOutputBuffer(buffersize) {
  const buffer = new Uint8Array(buffersize);
  let bufferpos = 0;
  let oldTimeTableIndex = 0;
  // Writer to buffer.
  const writer = (index, A) => {
    // timetable for more accurate c64 simulation
    const timetable = [
      [162, 167, 167, 127, 128],
      [226, 60, 60, 0, 0],
      [225, 60, 59, 0, 0],
      [200, 0, 0, 54, 55],
      [199, 0, 0, 54, 54]
    ];
    bufferpos += timetable[oldTimeTableIndex][index];
    if (bufferpos / 50 > buffer.length) {
      throw new Error('Buffer overflow!');
    }
    oldTimeTableIndex = index;
    // write a little bit in advance
    for (let k = 0; k < 5; k++) {
      buffer[(bufferpos / 50 | 0) + k] = (A & 15) * 16;
    }
  };
  writer.get = () => {
    // Hack for PhantomJS which does not have slice() on UintArray8
    if (process.env.NODE_ENV === 'karma-test') {
      return buffer.slice
        ? buffer.slice(0, bufferpos / 50 | 0)
        : new Uint8Array([].slice.call(buffer).slice(0, bufferpos / 50 | 0));
    }
    return buffer.slice(0, bufferpos / 50 | 0);
  };
  return writer;
}
