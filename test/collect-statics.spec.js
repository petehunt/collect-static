var collectStatic = require('../');
var fs = require('fs');
var glob = require('glob');
var mimetype = require('mimetype');
var path = require('path');

describe('collect-static', function() {
  var expectedFiles;
  var actualFiles;
  beforeEach(function() {
    expect(function() {
      // TODO: still need to check __dirname, cwd(), entryPoint (collect-static) etc.
      collectStatic(__dirname);
    }).not.toThrow();
    expectedFiles = glob.sync(path.join(__dirname, 'expected/*'));
    actualFiles = glob.sync(path.join(__dirname, 'node_modules/statics/*'));
  });

  it('should have brought over all the assets and namespaced them', function() {
    // avoid false positives
    expect(expectedFiles.length > 0).toBeTruthy();
    expectedFiles.forEach(function(expectedFile) {
      expect(actualFiles.some(function(actualFile) {
        return path.basename(actualFile) === path.basename(expectedFile);
      })).toBeTruthy();
    });
  });

  it('should have namescaped the CSS rules and url', function() {
    expectedFiles
      .filter(function(expectedFile) {
        // exclude images
        return mimetype.lookup(expectedFile) === 'text/css';
      })
      .forEach(function(expectedFile) {
        var destFilePath = path.join(
          __dirname, 'node_modules/statics', path.basename(expectedFile)
        );

        expect(
          fs.readFileSync(expectedFile, {encoding: 'utf8'}).trim()
        ).toEqual(
          fs.readFileSync(destFilePath, {encoding: 'utf8'}).trim()
        );
    });
  });
});
