var collectStatic = require('../');

var assert = require('assert');
var fs = require('fs-extra');
var glob = require('glob');

function expectEqualFileContent(file1, file2) {
  // TODO: no trimming! exact match
  assert.equal(
    fs.readFileSync(file1, {encoding: 'utf8'}).trim(),
    fs.readFileSync(file2, {encoding: 'utf8'}).trim()
  );
}

describe('collect-static', function() {
  var expectedFiles;
  var actualFiles;

  beforeEach(function(done) {
    // I dun goofed. No way to specify output dir here... yet! So now they're in
    // cwd, which is root dir
    fs.removeSync('./build');
    fs.removeSync('./test/out.js');

    var result;
    collectStatic('./test/fixture/index.js', './test/out.js', function(err) {
      if (err) return done(err);
      done();
    });
  });

  afterEach(function() {
    fs.removeSync('./build');
    fs.removeSync('./test/out.js');
  });

  it('should produce in actual the identical browserified output', function() {
    expectEqualFileContent('./test/fixture/fixture.js', './test/out.js');
  });

  it('should have collected the statics and namespaced the files', function() {
    var filePaths = glob.sync('./test/expectedAssets/*');
    filePaths.forEach(function(filePath) {
      var actualPath = filePath.replace('./test/expectedAssets', './build');
      assert(fs.existsSync(actualPath));
    });
  });

  it('should have namespaced the css selectors and urls correctly', function() {
    var filePaths = glob.sync('./test/expectedAssets/*');
    filePaths.forEach(function(filePath) {
      var actualPath = filePath.replace('./test/expectedAssets', './build');
      var expectedContent = fs.readFileSync(filePath, {encoding: 'utf8'});
      var actualContent = fs.readFileSync(actualPath, {encoding: 'utf8'});
      assert.equal(expectedContent, actualContent);
    });
  });
});
