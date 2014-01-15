var collectStatic = require('../');
var fs = require('fs');
var glob = require('glob');
var mimetype = require('mimetype');
var path = require('path');

function expectEqualFileContent(file1, file2) {
  expect(
    fs.readFileSync(file1, {encoding: 'utf8'}).trim()
  ).toEqual(
    fs.readFileSync(file2, {encoding: 'utf8'}).trim()
  );
}

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
    expect(expectedFiles.length).toBeGreaterThan(0);
    expect(expectedFiles.length).toBe(actualFiles.length);

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
        // unlike in the script, cannot use mimetype lookup here as the file
        // extension's been appended the .js
        return /\.css\.js$/.test(expectedFile);
      })
      .forEach(function(expectedFile) {
        var destFilePath = path.join(
          __dirname, 'node_modules/statics', path.basename(expectedFile)
        );
        expectEqualFileContent(expectedFile, destFilePath);
    });
  });

  it('should have created the images .js exported urls correctly', function() {
    expectedFiles
      .filter(function(expectedFile) {
        return /\.png\.js$/.test(expectedFile);
      })
      .forEach(function(expectedFile) {
        var destFilePath = path.join(
          __dirname, 'node_modules/statics', path.basename(expectedFile)
        );
        expectEqualFileContent(expectedFile, destFilePath);
      });
  });
});
