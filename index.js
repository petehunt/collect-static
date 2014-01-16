/*
current assumptions:

  static assets must all reside in a folder called statics at the root of the
  component. No nested hierarchy for now bc name clash (TODO: this).

  TODO: first point is a problem. Need to establish now to recognize a component
  folder. Simplest way is to force people to prefix their component with
  'react-', but this really isn't react-specific so no. Second would be to check
  all the static folders. A bit slower with false positives but works.

*/

var fs = require('fs-extra');
var glob = require('glob');
var mimetype = require('mimetype');
var path = require('path');
var rework = require('rework');
var reworkNamespace = require('rework-namespace');
var zipObject = require('lodash.zipobject');

var assert = require('assert');
// TODO: rm
assert = function() {};assert.deepEqual=function() {};

function _getAssets(root) {
  var files = glob.sync(path.join(root, 'node_modules/*'));
  // TODO: would be a big optimization if we can assume that every component has
  // a statics/ folder; if not, stop recursively searching its deps since it
  // wouldn't be a component (just a random dep). But this hinders and confuses
  // people who don't want to put a statics/ folder if they themselves don't
  // need any asset

  // note that the final output is stored in node_modules/statics/, but nowwhere
  // in the recursive search will such a pattern be possible (we search for a
  // statics/ folder inside a component, not at the level of its node_modules
  // folder); therefore, no need to worry about infinite recursion
  var currStatics = glob.sync(path.join(root, 'statics/*'));
  if (!files.length) return currStatics;

  return files.reduce(function(accum, filePath) {
    return accum.concat(_getAssets(filePath));
  }, currStatics);
}

// TODO: clear the asserts
assert.deepEqual(
  _getAssets('./tests'),
  [
    'tests/statics/spinner.css',
    'tests/node_modules/spinner2/statics/spinner.css',
    'tests/node_modules/spinner2/statics/spinner.png',
    'tests/node_modules/treeview/statics/treeview.css',
    'tests/node_modules/treeview/statics/treeview.png',
    'tests/node_modules/treeview/node_modules/react-table/statics/table.css'
  ]
);
assert(_getAssets('./tests').length === 6);

function _extractComponentNameFromAssetPath(assetPath) {
  // TODO: check if using cwd() is correct
  var relativeModulePath = path.relative(process.cwd(), assetPath);
  var matchedIndex = relativeModulePath.lastIndexOf('statics/');
  var cutPath = relativeModulePath.slice(matchedIndex);
  var asd = /(.+)\/statics\/.+\..+$/.exec(relativeModulePath);
  return asd
    ? asd[1].slice(asd[1].lastIndexOf('/') + 1)
    : path.basename(process.cwd()); // root folder
  // TODO: no need to namespace the root folder's assets.
}

assert(_extractComponentNameFromAssetPath('statics/spinner.css') === 'collect-statics');
assert(_extractComponentNameFromAssetPath('./statics/spinner.css') === 'collect-statics');
assert(_extractComponentNameFromAssetPath('tests/statics/spinner.css') === 'tests');
assert(_extractComponentNameFromAssetPath('tests/node_modules/spinner2/statics/spinner.css') === 'spinner2');
assert(_extractComponentNameFromAssetPath('tests/node_modules/spinner2/statics/spinner.png') === 'spinner2');
assert(_extractComponentNameFromAssetPath('tests/node_modules/treeview/statics/treeview.css') === 'treeview');
assert(_extractComponentNameFromAssetPath('tests/node_modules/treeview/statics/treeview.png') === 'treeview');
assert(_extractComponentNameFromAssetPath('tests/node_modules/treeview/node_modules/react-table/statics/table.css') === 'react-table');

function _extractAssetNameFromAssetPath(assetPath) {
  return path.basename(assetPath);
}

assert(_extractAssetNameFromAssetPath('statics/spinner.css') === 'spinner.css');
assert(_extractAssetNameFromAssetPath('./statics/spinner.css') === 'spinner.css');
assert(_extractAssetNameFromAssetPath('tests/statics/spinner.css') === 'spinner.css');
assert(_extractAssetNameFromAssetPath('tests/node_modules/spinner2/statics/spinner.css') === 'spinner.css');
assert(_extractAssetNameFromAssetPath('tests/node_modules/spinner2/statics/spinner.png') === 'spinner.png');
assert(_extractAssetNameFromAssetPath('tests/node_modules/treeview/statics/treeview.css') === 'treeview.css');
assert(_extractAssetNameFromAssetPath('tests/node_modules/treeview/statics/treeview.png') === 'treeview.png');
assert(_extractAssetNameFromAssetPath('tests/node_modules/treeview/node_modules/react-table/statics/table.css') === 'table.css');

function _extractComponentPathFromAssetPath(assetPath) {
  // asset path: bla/component/static/asd.png
  // component path: bla/component
  return path.dirname(path.dirname(assetPath));
}

// there's one, single namespacing strategy for everything, including file, css
// selectors, etc.
function getNamespace(namespace) {
  return namespace + '_';
}

// TODO: anything else?
function _namespaceCSSUrls(src, namespace) {
  return rework(src).use(rework.url(function(url) {
    return './' + namespace + url;
  })).toString();
}

// TODO: keyframes, media-queries, etc.
function _namespaceCSSSelectors(src, namespace) {
  return rework(src)
    .use(reworkNamespace(namespace))
    .toString();
}

// TODO: this is a plugin model. This one might always be included by default
function _rewriteCSSByNamespacing(src, namespace) {
  var newSrc = _namespaceCSSUrls(src, namespace);
  var newSrc2 = _namespaceCSSSelectors(newSrc, namespace);
  return newSrc2;
}

function _getRequirableCSSModuleSrc(src, namespacedSrc) {
  // creates the `require`-able js module that exports an obj, whose key is the
  // css selector string, and whose value is the same selector, namespaced

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

      // FIXME: check why selectors is in array
      namespacedSelectors = namespacedSelectors.concat(rule.selectors);
    });
  });

  // TODO: rm this when stable
  if (originalSelectors.length !== namespacedSelectors.length) throw 'never trust interns';

  var cssObj = zipObject(originalSelectors, namespacedSelectors);

  // prettify, 2-space indent
  var fileContent = 'module.exports = ' + JSON.stringify(cssObj, null, 2) + ';\n';
  return fileContent;
}

function _getRequirableImageModuleSrc(assetName, namespace) {
  // creates the `require`-able .js that exposes a link
  // TODO: pluginfy this
  // ./img.png
  // TODO: path not correct but I need sleep
  var fileContent = 'module.exports = \'./' + namespace + assetName + '\';\n';
  return fileContent;
}

// TODO: in the end, it's possible that 2 components require react-spinner,
// which is troublesome especially if the two versions are different. `npm
// dedupe` won't help here; we'll see...
function collectStatic(entryPoint, next) {
  var topLevelDestFolderForAssets = path.join(entryPoint, 'node_modules/statics');
  fs.removeSync(topLevelDestFolderForAssets);
  fs.mkdirpSync(topLevelDestFolderForAssets);

  _getAssets(entryPoint).forEach(function(assetPath) {
    var componentPath = _extractComponentPathFromAssetPath(assetPath);
    var componentName = _extractComponentNameFromAssetPath(assetPath);
    var assetName = _extractAssetNameFromAssetPath(assetPath);

    var destPathForAsset = path.join(
      topLevelDestFolderForAssets, getNamespace(componentName) + assetName
    );

    var jsSuffixedDestPathForCurrComponent = path.join(
      componentPath,
      'node_modules/statics',
      assetName + '.js'
    );

    if (mimetype.lookup(assetPath) === 'text/css') {
      var src = fs.readFileSync(assetPath, {encoding: 'utf8'});
      var namespacedSrc = _rewriteCSSByNamespacing(src, getNamespace(componentName));
      fs.outputFileSync(destPathForAsset, namespacedSrc, {encoding: 'utf8'});

      var CSSJSModuleSrc = _getRequirableCSSModuleSrc(src, namespacedSrc);
      fs.outputFileSync(jsSuffixedDestPathForCurrComponent, CSSJSModuleSrc, {encoding: 'utf8'});
    } else {
      // img copying too expensive; symlink them
      // note: use absolute path or it dies
      fs.symlinkSync(path.resolve(assetPath), path.resolve(destPathForAsset));
      var imageJSModuleSrc = _getRequirableImageModuleSrc(assetName, getNamespace(componentName));
      fs.outputFileSync(jsSuffixedDestPathForCurrComponent, imageJSModuleSrc, {encoding: 'utf8'});
    }
  });

  next && next();
}

module.exports = collectStatic;
