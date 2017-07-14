const path = require('path');
const buble = require('rollup-plugin-buble');
const replace = require('rollup-plugin-replace');
const flow = require('rollup-plugin-flow-no-whitespace');
const version = process.env.VERSION || require('../package.json').version;

const banner =
  '/**\n' +
  ' * This is SamJs.js v' + version + '\n' +
  ' *\n' +
  ' * A Javascript port of "SAM Software Automatic Mouth".\n' +
  ' *\n' +
  ' * (c) 2017-' + new Date().getFullYear() + ' Christian Schiffler\n' +
  ' *\n' +
  ' * @link(https://github.com/discordier/sam)\n' +
  ' *\n' +
  ' * @author 2017 Christian Schiffler <c.schiffler@cyberspectrum.de>\n' +
  ' */';

const resolve = p => {
  return path.resolve(__dirname, '../', p)
};

const builds = {
  // runtime-only build (Browser)
  'dev': {
    entry: resolve('src/index.es6'),
    dest: resolve('dist/samjs.js'),
    format: 'umd',
    env: 'development',
    banner
  },
  // Runtime only (CommonJS). Used by bundlers e.g. Webpack & Browserify
  'cjs': {
    entry: resolve('src/index.es6'),
    dest: resolve('dist/samjs.common.js'),
    format: 'cjs',
    env: 'development',
    banner
  },
  // Runtime only (ES Modules). Used by bundlers that support ES Modules,
  // e.g. Rollup & Webpack 2
  'esm': {
    entry: resolve('src/index.es6'),
    dest: resolve('dist/samjs.esm.js'),
    format: 'es',
    env: 'development',
    banner
  },
  // runtime-only production build (Browser)
  'prod': {
    entry: resolve('src/index.es6'),
    dest: resolve('dist/samjs.min.js'),
    format: 'umd',
    env: 'production',
    banner
  },
  // Runtime only production build (CommonJS). Used by bundlers e.g. Webpack & Browserify
  'prod-cjs': {
    entry: resolve('src/index.es6'),
    dest: resolve('dist/samjs.common.min.js'),
    format: 'cjs',
    env: 'production',
    banner
  },
  // Runtime only production build (ES Modules). Used by bundlers that support ES Modules,
  // e.g. Rollup & Webpack 2
  'prod-esm': {
    entry: resolve('src/index.es6'),
    dest: resolve('dist/samjs.esm.min.js'),
    format: 'es',
    env: 'production',
    banner
  },

  // guessnum-demo build (Browser)
  'guessnum-demo-dev': {
    entry: resolve('src/guessnum.es6'),
    dest: resolve('dist/guessnum.js'),
    format: 'umd',
    env: 'development',
    banner
  },
  // guessnum-demo (CommonJS). Used by bundlers e.g. Webpack & Browserify
  'guessnum-demo-cjs': {
    entry: resolve('src/guessnum.es6'),
    dest: resolve('dist/guessnum.common.js'),
    format: 'cjs',
    env: 'development',
    banner
  },
  // guessnum-demo (ES Modules). Used by bundlers that support ES Modules,
  // e.g. Rollup & Webpack 2
  'guessnum-demo-esm': {
    entry: resolve('src/guessnum.es6'),
    dest: resolve('dist/guessnum.esm.js'),
    format: 'es',
    env: 'development',
    banner
  },

  // guessnum-demo production build (Browser)
  'guessnum-demo-prod': {
    entry: resolve('src/guessnum.es6'),
    dest: resolve('dist/guessnum.min.js'),
    format: 'umd',
    env: 'production',
    banner
  },
  // guessnum-demo production build (CommonJS). Used by bundlers e.g. Webpack & Browserify
  'guessnum-demo-prod-cjs': {
    entry: resolve('src/guessnum.es6'),
    dest: resolve('dist/guessnum.common.min.js'),
    format: 'cjs',
    env: 'production',
    banner
  },
  // guessnum-demo production build (ES Modules). Used by bundlers that support ES Modules,
  // e.g. Rollup & Webpack 2
  'guessnum-demo-prod-esm': {
    entry: resolve('src/guessnum.es6'),
    dest: resolve('dist/guessnum.esm.min.js'),
    format: 'es',
    env: 'production',
    banner
  },
};

function genConfig (opts) {
  let moduleName = 'SamJs';
  switch (opts.entry.split('/').pop()) {
    case 'guessnum.es6':
      moduleName = 'GuessNum';
      break;
  }
  const config = {
    entry: opts.entry,
    dest: opts.dest,
    external: opts.external,
    format: opts.format,
    banner: opts.banner,
    moduleName: moduleName,
    plugins: [
      replace({
        __VERSION__: version
      }),
      flow(),
      buble()
    ].concat(opts.plugins || [])
  };

  if (opts.env) {
    config.plugins.push(replace({
      'process.env.NODE_ENV': JSON.stringify(opts.env)
    }))
  }

  return config
}

if (process.env.TARGET) {
  module.exports = genConfig(builds[process.env.TARGET])
} else {
  exports.getBuild = name => genConfig(builds[name]);
  exports.getAllBuilds = () => Object.keys(builds).map(name => genConfig(builds[name]))
}
