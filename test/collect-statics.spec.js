var collectStatic = require('../');
var fs = require('fs-extra');
var glob = require('glob');
var mimetype = require('mimetype');
var path = require('path');

function expectEqualFileContent(file1, file2) {
  // TODO: no trimming! exact match
  expect(
    fs.readFileSync(file1, {encoding: 'utf8'}).trim()
  ).toEqual(
    fs.readFileSync(file2, {encoding: 'utf8'}).trim()
  );
}

function replaceExpectedPathByActual(expectedPath) {
  return expectedPath.replace(/^test\/expected/, 'test/actual');
}

describe('Validate expected/ folder', function() {
  it('should not produce false positives', function() {
    // 10 is arbitrary
    expect(glob.sync('test/expected/**').length).toBeGreaterThan(10);
  });
});

describe('collect-static', function() {
  var expectedFiles;
  var actualFiles;

  beforeEach(function() {
    fs.removeSync('test/actual');
    fs.copySync('test/fixtures', 'test/actual');

    expect(function() {
      // TODO: still need to check __dirname, cwd(), entryPoint (collect-static) etc.
      collectStatic('test/actual');
    }).not.toThrow();
    // remove root expected/ and actual/ dir from result
    expectedFiles = glob.sync('test/expected/**').slice(1);
    actualFiles = glob.sync('test/actual/**').slice(1);

    // writing our own matcher here, or else `expect` file existence will just
    // yield true/false, which doesn't help debugging
    this.addMatchers({
      toHaveEquivalentInActual: function() {
        // sry, the distinction between actual and expected is reversed here
        // check usage
        var actualPath = replaceExpectedPathByActual(this.actual);
        return fs.existsSync(actualPath);
      }
    });
  });

  it('should produce in actual the identical file names and content than in expected', function() {
    // make sure there's no random extra file generated
    // expect(actualFiles.length).toBe(expectedFiles.length);

    expectedFiles.forEach(function(expectedFile) {
      expect(expectedFile).toHaveEquivalentInActual();
      if (fs.statSync(expectedFile).isDirectory()) return;

      // image. Done
      if (/^image\//.test(mimetype.lookup(expectedFile))) return;

      // the rest: .css, .css.js, .png.js (or whatever img extension)
      expectEqualFileContent(expectedFile, replaceExpectedPathByActual(expectedFile));
    });
  });
});
