var assert = require('assert');

var spinnerPngURL = require('statics/spinner.png');
// TODO: if you want spriting, you can require a css class and have it all work
// out
var spinnerCSS = require('statics/spinner.css');

var spinner2 = require('spinner2');
var treeview = require('treeview');

assert(spinnerPngURL === './test_spinner.png');
assert.deepEqual(
  spinnerCSS,
  {
    '#header': '#test_header',
    '#header2': '#test_header2'
  }
);
