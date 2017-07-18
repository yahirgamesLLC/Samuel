import TextToPhonemes from './reciter/reciter.es6';
import {SamSpeak} from './sam/sam.es6';

function SamJs (options) {
  const opts = options || {};

  const convert = this.convert = (text) => {
    let input = TextToPhonemes(text);
    if (!input) {
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`phonetic input: "${text}" could not be converted`);
      }
      throw new Error();
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('phonetic data: "%s"', input);
    }

    return input;
  };

  this.speak = (text, phonetic) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('text input: ', text);
    }

    let input;

    if (!(phonetic || opts.phonetic)) {
      input = convert(text);
    } else {
      input = text.toUpperCase();
    }

    return SamSpeak(input, opts);
  };
}

export default SamJs;
