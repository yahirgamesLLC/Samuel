import {PlayBuffer, RenderBuffer} from '../util/player.es6';

import Parser from '../parser/parser.es6';
//import Parser from '../parser/parser-c.es6';
import Renderer from '../renderer/renderer.es6';
//import Renderer from '../renderer/c-conv/renderer.es6';

export default class Sam {
  /**
   *
   * @param {object}  [options]
   * @param {Boolean} [options.phonetic] Default false.
   * @param {Boolean} [options.singmode] Default false.
   * @param {Boolean} [options.debug]    Default false.
   * @param {Number}  [options.pitch]    Default 64.
   * @param {Number}  [options.speed]    Default 72.
   * @param {Number}  [options.mouth]    Default 128.
   * @param {Number}  [options.throat]   Default 128.
   *
   * @returns {Function}
   * @constructor
   */
  constructor(options) {
    // Default values.
    const opts = {};
    opts.speed = (options.speed || 72) & 0xFF;
    opts.pitch = (options.pitch || 64) & 0xFF;
    opts.mouth = (options.mouth || 128) & 0xFF;
    opts.throat = (options.throat || 128) & 0xFF;
    opts.singmode = options.singmode || false;
    opts.debug = options.debug || false;
    this.getOptions = () => opts;
  }

  speak (_input) {
    const buffer = this.process(_input);
    if (false === buffer) {
      return false;
    }
    const audio = new Float32Array(buffer.length);
    for(let i=0; i < buffer.length; i++) {
      audio[i] = (buffer[i] - 128) / 256;
    }

    // Now push buffer to wave player.
    PlayBuffer(audio).then(() => { console.log('Playback done!'); });
  }

  wave (_input) {
    const buffer = this.process(_input);
    if (false === buffer) {
      return false;
    }
    RenderBuffer(buffer);
  }

  /**
   * Process the input and return the audiobuffer.
   *
   * @param {String} _input
   *
   * @return {Uint8Array|Boolean}
   */
  process (_input) {
    const parsed = Parser(_input);
    if (false === parsed) {
      return false;
    }

    return Renderer(
      parsed,
      this.getOptions().pitch,
      this.getOptions().mouth,
      this.getOptions().throat,
      this.getOptions().speed,
      this.getOptions().singmode
    );
  }
}
