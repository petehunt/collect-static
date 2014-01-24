var falafel = require('falafel');
var fs = require('fs-extra');
var mimetype = require('mimetype');
var path = require('path');
var rework = require('rework');
var reworkNamespace = require('rework-namespace');
var through = require('through');
var zipObject = require('lodash.zipobject');

var destFolderPath = './build';

function isCSS(filePath) {
  return mimetype.lookup(filePath) === 'text/css';
}

function isImage(filePath) {
  var type = mimetype.lookup(filePath);
  // mimetype gets false if it's like 'asd/bla'
  return type && type.indexOf('image/') === 0;
}

function getComponentNameFromAssetPath(filePath) {
  // TODO: clean this up. Fuck regexp
  var nodeModulesStr = 'node_modules/';
  var a = filePath.lastIndexOf(nodeModulesStr);
  if (a < 0) {
    // no 'node_modules/' found, so must be a root component
    // something like './assets/banner.png'
    // TODO: check this is valid
    return path.basename(path.dirname(path.resolve(filePath)));
  }

  var b = filePath.slice(a + nodeModulesStr.length);
  return b.slice(0, b.indexOf('/'));
}

function getNamespaceFromAssetPath(filePath) {
  // same namespacing strategy for file name, css selectors, and dunno what else
  // keep it simple for now
  return getComponentNameFromAssetPath(filePath) + '_';
}

function getAssetNameFromAssetPath(filePath) {
  return path.basename(filePath);
}

function getAbsNamespacedDestPathForAsset(filePath) {
  // TODO: this is the pluggable part for image urls
  // TODO: bla no folder creation here
  fs.mkdirpSync(destFolderPath);
  return path.join(
    path.resolve(destFolderPath),
    getNamespaceFromAssetPath(filePath) +
    getAssetNameFromAssetPath(filePath)
  );
}

function getNamespacedDestPathForAsset(filePath) {
  return path.relative(process.cwd(), getAbsNamespacedDestPathForAsset(filePath));
}

function getAbsRequiredPathFromFileAndItsRequire(filePath, requirePath) {
  return path.join(path.dirname(filePath), requirePath);
}

function blawritegetImageConfigString(filePath, requirePath, c) {
  var absRequiredPathFromFileAndItsRequire = getAbsRequiredPathFromFileAndItsRequire(filePath, requirePath);
  var namespacedDestPathForAsset = getAbsNamespacedDestPathForAsset(absRequiredPathFromFileAndItsRequire);
  if (!fs.existsSync(absRequiredPathFromFileAndItsRequire)) throw 'wtf img src should have been found';
  if (fs.existsSync(namespacedDestPathForAsset)) {
    fs.unlinkSync(namespacedDestPathForAsset);
  }
  fs.symlinkSync(absRequiredPathFromFileAndItsRequire, namespacedDestPathForAsset);
  return getNamespacedDestPathForAsset(absRequiredPathFromFileAndItsRequire);
}

// TODO: anything else?
function namespaceCSSUrls(src, namespace) {
  return rework(src).use(rework.url(function(url) {
    return './' + namespace + url;
  })).toString();
}

// TODO: keyframes, media-queries, etc.
function namespaceCSSSelectors(src, namespace) {
  // TODO: plugin here too just like imageconfig string
  return rework(src)
    .use(reworkNamespace(namespace))
    .toString();
}

// TODO: this is a plugin model. This one might always be included by default
function rewriteCSSByNamespacing(src, namespace) {
  var newSrc = namespaceCSSUrls(src, namespace);
  var newSrc2 = namespaceCSSSelectors(newSrc, namespace);
  return newSrc2;
}

function getRequirableCSSModuleSrc(src, namespacedSrc) {
  // creates the `require`-able js obj, whose key is the css selector string,
  // and whose value is the same selector, namespaced
  // TODO: currently, the selector can only be one class name/id. Or else the
  // a = require('a.css'); node.className=a['.banner'] doesn't make sense

  // TODO: pluginfy this
  var originalSelectors = [];
  var namespacedSelectors = [];

  rework(src).use(function(style) {
    style.rules.forEach(function(rule) {
      // FIXME: this is not correct, still need to add something to cssObj
      if (!rule.selectors || !rule.selectors.length) return;

      // FIXME: check why selectors is in array
      originalSelectors = originalSelectors.concat(rule.selectors);
    });
  });

  rework(namespacedSrc).use(function(style) {
    style.rules.forEach(function(rule) {
      // FIXME: this is not correct, still need to add something to cssObj
      if (!rule.selectors || !rule.selectors.length) return;

      // TODO: currently only accepts a single selector, either an id or a class
      // or else className={bla['.a .b']} wouldn't make sense
      // FIXME: check why selectors is in array. Only 1 item
      var selectedWithClassDotOrIdHashStripped = rule.selectors[0].slice(1);
      namespacedSelectors.push(selectedWithClassDotOrIdHashStripped);
    });
  });

  // TODO: rm this when stable
  if (originalSelectors.length !== namespacedSelectors.length) throw 'never trust interns';

  var cssObj = zipObject(originalSelectors, namespacedSelectors);

  return cssObj;
}

function blawritegetCSSConfigString(filePath, requirePath, c) {
  // TODO: plugin here too just like imageconfig string
  var CSSPath = getAbsRequiredPathFromFileAndItsRequire(filePath, requirePath);

  var src = fs.readFileSync(CSSPath, {encoding: 'utf8'});
  var namespacedSrc = rewriteCSSByNamespacing(src, getNamespaceFromAssetPath(CSSPath));
  fs.outputFileSync(getAbsNamespacedDestPathForAsset(CSSPath), namespacedSrc, {encoding: 'utf8'});

  var CSSJSModuleSrc = getRequirableCSSModuleSrc(src, namespacedSrc);

  // prettify, 2-space indent
  // TODO: don't prettify when done
  return JSON.stringify(CSSJSModuleSrc);
}

// credit: pete hunt, lol
function staticify(filePath, a, b) {
  if (/\.json$/.test(filePath)) return through();
  var buffer = '';

  return through(function(data) {
    // TODO: wtf is concat-stream?
    buffer += data;
  }, function processFile() {
    // TODO: I have no idea how to parse stuff
    // TODO: maybe use requiremap
    var output = falafel(buffer, function(node) {
      if (node.type === 'Identifier' &&
          node.name === 'require' &&
          node.parent &&
          node.parent.type === 'CallExpression') {
        // TODO: pete: requireStatic goes here
        var requirePath = node.parent.arguments[0].value;

        var isPathCSS = isCSS(requirePath);
        var isPathImage = isImage(requirePath);
        if (!isPathCSS && !isPathImage) return;

        // TODO: how to dedupe components assets, since we're symlinking them in
        // --------------
        var requireReplacement = '';
        if (isPathCSS) {
          requireReplacement = blawritegetCSSConfigString(filePath, requirePath);
        } else if (isPathImage) {
          requireReplacement = '\'' + blawritegetImageConfigString(filePath, requirePath) + '\'';
        }
        node.parent.update(requireReplacement);
      }
    });

    this.queue(String(output));
    this.queue(null);
  });
}

module.exports = staticify;
