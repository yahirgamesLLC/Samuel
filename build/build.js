const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const rollup = require('rollup');
const uglify = require('uglify-js');
const uglifyEs = require('uglify-es');

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist')
}

let builds = require('./config').getAllBuilds();

// filter builds via command line arg
if (process.argv[2]) {
  const filters = process.argv[2].split(',');
  builds = builds.filter(b => {
    return filters.some(f => b.dest.indexOf(f) > -1)
  })
}

build(builds);

function build (builds) {
  let built = 0;
  const total = builds.length;
  const next = () => {
    buildEntry(builds[built]).then(() => {
      built++;
      if (built < total) {
        next()
      }
    }).catch(logError)
  };

  next()
}

function buildEntry (config) {
  const isProd = /min\.js$/.test(config.dest);
  return rollup.rollup(config).then(bundle => {
    const code = bundle.generate(config).code;
    if (isProd) {
      let result = (/esm\.min$/.test(config.dest) ? uglify : uglifyEs).minify(code, {
        mangle: {
          // keep_classnames: true,
        },
        warnings: true,
        toplevel: true,
        output: {
          ascii_only: true
        },
        compress: {
          properties: true,
          dead_code: true,
          conditionals: true,
          reduce_vars: true,
          keep_fnames: true
        },
        sourceMap: {
          filename: path.basename(config.dest),
          url: path.basename(config.dest) + '.map'
        }
      });
      let minimized = (config.banner ? config.banner + '\n' : '') + result.code;
      if (result.error) console.error(result.error.message);
      if (result.warnings) console.warn(result.warnings);

      return Promise.all([
        write(config.dest, minimized, true),
        write(config.dest + '.map', result.map || '', true)
      ]);
    } else {
      return write(config.dest, code)
    }
  })
}

function write (dest, code, zip) {
  return new Promise((resolve, reject) => {
    function report (extra) {
      console.log(blue(path.relative(process.cwd(), dest)) + ' ' + getSize(code) + (extra || ''));
      resolve()
    }

    fs.writeFile(dest, code, err => {
      if (err) return reject(err);
      if (zip) {
        zlib.gzip(code, (err, zipped) => {
          if (err) return reject(err);
          report(' (gzipped: ' + getSize(zipped) + ')')
        })
      } else {
        report()
      }
    })
  })
}

function getSize (code) {
  return (code.length / 1024).toFixed(2) + 'kb'
}

function logError (e) {
  console.log(e)
}

function blue (str) {
  return '\x1b[1m\x1b[34m' + str + '\x1b[39m\x1b[22m'
}
