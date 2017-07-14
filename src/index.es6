//import TextToPhonemes from './reciter/c-conv/reciter.es6';
import TextToPhonemes from './reciter/reciter.es6';
import Sam from './sam/sam.es6';

class SamJs {
  constructor(options) {
    const opts = options || {};
    this.getOptions = () => opts;
    this.renderer = new Sam(opts);
  }

  convert(text) {
    let input = TextToPhonemes(text);
    if (!input) {
      throw new Error(`phonetic input: "${text}" could not be converted`);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('phonetic data: "%s"', input);
    }

    return input;
  }

  speak (text, phonetic) {
    const opts = this.getOptions();
    if (process.env.NODE_ENV !== 'production') {
      console.log('text input: ', text);
    }

    let input;

    if (!(phonetic || opts.phonetic)) {
      input = this.convert(text);
    } else {
      input = text.toUpperCase();
    }

    this.renderer.speak(input);
  };
}

export default SamJs;
