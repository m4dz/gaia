suite('lib/camera', function() {
  'use strict';
  var require = window.req;

  suiteSetup(function(done) {
    var self = this;
    require(['lib/camera'], function(Camera) {
      self.Camera = Camera;
      done();
    });
  });

  setup(function() {
    var mozCameras = {
      getListOfCameras: function() {},
      getCamera: function() {}
    };

    if (!navigator.mozCameras) { navigator.mozCameras = mozCameras; }
    if (!navigator.getDeviceStorage) { navigator.getDeviceStorage = function() {}; }

    this.sandbox = sinon.sandbox.create();
    this.sandbox.stub(navigator, 'getDeviceStorage').returns({});
    this.sandbox.stub(navigator.mozCameras);

    navigator.mozCameras.getListOfCameras.returns([]);

    // Fake mozCamera
    this.mozCamera = {
      autoFocus: sinon.stub(),
      release: sinon.stub()
    };

    this.camera = new this.Camera();
    this.sandbox.stub(this.camera, 'emit');
  });

  teardown(function() {
    this.sandbox.restore();
  });

  suite('Camera#focus()', function() {
    setup(function() {
      this.camera = {
        autoFocus: {},
        set: sinon.spy(),
        mozCamera: this.mozCamera,
        focus: this.Camera.prototype.focus,
        orientation: sinon.stub()
      };

      this.clock = sinon.useFakeTimers();
    });

    teardown(function() {
      this.clock.restore();
    });

    test('Should not call mozCamera.autoFocus if not supported', function() {
      var done = sinon.spy();
      this.camera.autoFocus.auto = false;
      this.camera.focus(done);
      assert.ok(!this.camera.mozCamera.autoFocus.called);
      assert.ok(done.called);
    });

    test('Should call to focus the camera if supported', function() {
      var done = sinon.spy();

      this.camera.autoFocus.auto = true;
      this.camera.mozCamera.autoFocus.callsArgWith(0, true);

      this.camera.focus(done);

      // Check the focus state was first set to 'focusing'
      assert.ok(this.camera.set.args[0][0] === 'focus');
      assert.ok(this.camera.set.args[0][1] === 'focusing');

      // Check the call to `autoFocus` was made
      assert.ok(this.camera.mozCamera.autoFocus.called);

      // Check the second focus state was then set to 'focused'
      assert.ok(this.camera.set.args[1][0] === 'focus');
      assert.ok(this.camera.set.args[1][1] === 'focused');

      // The callback
      assert.ok(done.called, 'callback called');
    });

    test('Should repond correctly on focus failure', function() {
      var done = sinon.spy();

      this.camera.autoFocus.auto = true;
      this.camera.mozCamera.autoFocus.callsArgWith(0, false);

      this.camera.focus(done);

      // Check the focus state was first set to 'focusing'
      assert.ok(this.camera.set.args[0][0] === 'focus');
      assert.ok(this.camera.set.args[0][1] === 'focusing');

      // Check the call to `autoFocus` was made
      assert.ok(this.camera.mozCamera.autoFocus.called);

      // Check the second focus state was then set to 'focused'
      assert.ok(this.camera.set.args[1][0] === 'focus');
      assert.ok(this.camera.set.args[1][1] === 'fail');

      // The callback
      assert.ok(done.calledWith('failed'));

      this.clock.tick(1001);
      assert.ok(this.camera.set.calledWith('focus', 'none'));
    });
  });

  suite('Camera#startRecording()', function() {
    setup(function() {
      this.options = {
        orientation: { get: sinon.stub().returns(0) },
        recordSpaceMin: 999,
        recordSpacePadding: 100
      };

      this.camera = new this.Camera(this.options);

      this.camera.mozCamera = {
        startRecording: sinon.stub()
      };

      // Stub all camera methods
      sinon.stub(this.camera);

      // Happy default
      this.camera.getFreeVideoStorageSpace.callsArgWith(0, null, 9999);
      this.camera.createVideoFilepath.callsArgWith(0, 'file/path/video.3gp');
      this.camera.get.withArgs('selectedCamera').returns('back');
      this.camera.get.withArgs('maxFileSizeBytes').returns(0);

      // Unstab the method we are testing
      this.camera.startRecording.restore();
    });


    test('Should emit a \'busy\' event', function() {
      this.camera.startRecording();
      assert.ok(this.camera.emit.calledWith('busy'));
    });

    test('Should error if not enough storage space', function() {
      this.camera.getFreeVideoStorageSpace =
        sinon.stub().callsArgWith(0, null, 9);
      this.camera.startRecording();
      assert.ok(this.camera.onRecordingError.called);
    });

    test('Should get the video filepath from the ' +
      'publicly writable `createVideoFilepath`', function() {
      var custom = sinon.spy();

      this.camera.startRecording();
      assert.ok(this.camera.createVideoFilepath.called);

      this.camera.createVideoFilepath = custom;
      this.camera.startRecording();
      assert.ok(custom.called);
    });

    test('Should call mozCamera.startRecording with the current rotation',
      function() {
      this.camera.orientation.get.returns(90);
      this.camera.startRecording();

      var args = this.camera.mozCamera.startRecording.args[0];
      var config = args[0];

      assert.ok(config.rotation === 90);
    });

    test('Should rotation should be inversed for front camera', function() {
      this.camera.get.withArgs('selectedCamera').returns('front');
      this.camera.orientation.get.returns(90);
      this.camera.startRecording();

      var args = this.camera.mozCamera.startRecording.args[0];
      var config = args[0];

      assert.ok(config.rotation === -90);
    });

    test('Should cap recording size to `maxFileSizeBytes` if set, ' +
      'else uses remaining bytes in storage', function() {
      var maxFileSizeBytes;
      var args;

      this.camera.video.spacePadding = 10;

      // Without `maxFileSizeBytes` set
      this.camera.startRecording();

      args = this.camera.mozCamera.startRecording.args[0];
      maxFileSizeBytes = args[0].maxFileSizeBytes;
      assert.ok(maxFileSizeBytes === (9999 - this.camera.video.spacePadding));
      this.camera.mozCamera.startRecording.reset();

      // With `maxFileSizeBytes` set
      this.camera.get.withArgs('maxFileSizeBytes').returns(99);
      this.camera.startRecording();

      args = this.camera.mozCamera.startRecording.args[0];
      maxFileSizeBytes = args[0].maxFileSizeBytes;
      assert.ok(maxFileSizeBytes === 99);
    });

    test('Should pass the video storage object', function() {
      this.camera.startRecording();
      var args = this.camera.mozCamera.startRecording.args[0];
      var storage = args[1];
      assert.ok(storage === this.camera.video.storage);
    });

    test('Should pass the generated filepath', function() {
      this.camera.createVideoFilepath =
        sinon.stub().callsArgWith(0, 'dir/my-video.3gp');
      this.camera.startRecording();
      var filepath = this.camera.mozCamera.startRecording.args[0][2];
      assert.ok(filepath === 'dir/my-video.3gp');
    });

    test('Should set the following onSuccess', function() {
      this.camera.mozCamera.startRecording.callsArg(3);
      this.camera.startRecording();
      assert.ok(this.camera.set.calledWith('recording', true));
      assert.ok(this.camera.emit.calledWith('ready'));
      assert.ok(this.camera.startVideoTimer.called);
    });

    test('Should call onRecordingError on error', function() {
      this.camera.mozCamera.startRecording.callsArg(4);
      this.camera.startRecording();
      assert.ok(this.camera.onRecordingError.called);
    });
  });

  suite('Camera#configureFocus()', function() {
    setup(function() {
      this.camera = {
        autoFocus: {},
        configureFocus: this.Camera.prototype.configureFocus
      };
    });

    test('Should convert modes to a hash', function() {
      var modes = ['auto', 'infinity', 'normal', 'macro'];
      this.camera.configureFocus(modes);

      assert.ok('auto' in this.camera.autoFocus);
      assert.ok('infinity' in this.camera.autoFocus);
      assert.ok('normal' in this.camera.autoFocus);
      assert.ok('macro' in this.camera.autoFocus);
    });

    test('Should empty hash each time', function() {
      this.camera.configureFocus(['infinity']);
      assert.ok('infinity' in this.camera.autoFocus);
      this.camera.configureFocus(['auto', 'normal']);
      assert.ok('auto' in this.camera.autoFocus);
      assert.ok('normal' in this.camera.autoFocus);
      assert.ok(!('infinity' in this.camera.autoFocus));
    });
  });

  suite('Camera#setISOMode()', function() {
    setup(function() {
      this.camera = {
        mozCamera: {
          capabilities: {
            isoModes: ['auto', 'hjr', '100', '200', '400', '800', '1600']
          },
          isoMode: null
        },
        setISOMode: this.Camera.prototype.setISOMode
      };
    });

    test('Should set the `isoMode` property to "auto"', function() {
      var isoMode = 'auto';
      this.camera.setISOMode(isoMode);

      assert.ok(this.camera.mozCamera.isoMode === isoMode);
    });

    test('Should *NOT* set the `isoMode` property to "invalid"', function() {
      var isoMode = 'invalid';
      this.camera.setISOMode(isoMode);

      assert.ok(this.camera.mozCamera.isoMode !== isoMode);
    });
  });

  suite('Camera#setWhiteBalance()', function() {
    setup(function() {
      this.camera = {
        mozCamera: {
          capabilities: {
            whiteBalanceModes: ['auto', 'cloudy', 'sunny', 'incandescen']
          },
          whiteBalanceMode: null
        },
        setWhiteBalance: this.Camera.prototype.setWhiteBalance
      };
    });

    test('Should set the setWhiteBalance property to "auto"', function() {
      var whiteBalanceMode = 'auto';
      this.camera.setWhiteBalance(whiteBalanceMode);

      assert.equal(this.camera.mozCamera.whiteBalanceMode, whiteBalanceMode);
    });

    test('Should *NOT* set the setWhiteBalance property to "invalid"',
      function() {
      var whiteBalanceMode = 'invalid';
      this.camera.setWhiteBalance(whiteBalanceMode);

      assert.ok(this.camera.mozCamera.whiteBalanceMode !== whiteBalanceMode);
    });
  });

  suite('Camera#setSceneMode()', function() {
    setup(function() {
      this.camera = {
        mozCamera: {
          capabilities: {
            sceneModes: ['auto', 'hdr']
          },
          sceneMode: null
        },
        setSceneMode: this.Camera.prototype.setSceneMode,
        setHDR: this.Camera.prototype.setHDR,
        get: function() {}
      };

      this.sandbox.stub(this.camera, 'get', function() {
        return {sceneModes: ['auto', 'hdr']};
      });
    });

    test('should set the scene mode value parameter to hdr', function() {
      this.camera.setSceneMode('hdr');
      assert.equal(this.camera.mozCamera.sceneMode, 'hdr');
    });

    test('should set the scene mode value parameter to auto', function() {
      this.camera.setSceneMode('auto');
      assert.equal(this.camera.mozCamera.sceneMode, 'auto');
    });
  });

  suite('Camera#setHDRMode()', function() {
    setup(function() {
      this.camera = {
        mozCamera: {
          capabilities: {
            sceneModes: ['auto', 'hdr']
          },
          sceneMode: null
        },
        setSceneMode: this.Camera.prototype.setSceneMode,
        setHDR: this.Camera.prototype.setHDR,
        get: function() {}
      };

      this.sandbox.stub(this.camera, 'get', function() {
        return {sceneModes: ['auto', 'hdr']};
      });
    });

    test('Test for HDRMode method called with value "on"', function() {
      this.camera.setSceneMode = sinon.spy();
      this.camera.setHDR('on');
      assert.isTrue(this.camera.setSceneMode.calledWith('hdr'));
    });

    test('Test for HDRMode method called with value "off"', function() {
      this.camera.setSceneMode = sinon.spy();
      this.camera.setHDR('off');
      assert.isTrue(this.camera.setSceneMode.calledWith('auto'));
    });
  });

  suite('Camera#takePicture()', function() {
    setup(function() {
      this.camera = new this.Camera();
      sinon.stub(this.camera, 'focus').callsArg(0);
      sinon.stub(this.camera, 'set');
      this.camera.mozCamera = {
        takePicture: sinon.stub().callsArgWith(1, 'the-blob'),
        resumePreview: sinon.stub()
      };
    });

    test('Should emit a `busy` when picture taking starts', function() {
      sinon.stub(this.camera, 'emit');
      this.camera.takePicture({});
      assert.isTrue(this.camera.emit.calledWith('busy'));
    });

    test('Should call `mozCamera.takePicture`', function() {
      this.camera.takePicture({});
      assert.isTrue(this.camera.mozCamera.takePicture.called);
    });

    test('Should still take picture even when focus fails', function() {
      this.camera.focus = sinon.stub().callsArgWith(0, 'some error');
      this.camera.takePicture({});
      assert.isTrue(this.camera.mozCamera.takePicture.called);
    });

    test('Should pass the position value to `mozCamera.takePicture`', function() {
      this.camera.takePicture({ position: 123 });
      var config = this.camera.mozCamera.takePicture.args[0][0];
      assert.equal(config.position, 123);
    });

    test('Should take jpegs', function() {
      this.camera.takePicture({});
      var config = this.camera.mozCamera.takePicture.args[0][0];
      assert.equal(config.fileFormat, 'jpeg');
    });

    test('Should pass the current `pictureSize`', function() {
      this.camera.pictureSize = { width: 400, height: 300 };
      this.camera.takePicture({});
      var config = this.camera.mozCamera.takePicture.args[0][0];
      assert.equal(config.pictureSize.width, 400);
      assert.equal(config.pictureSize.height, 300);
    });

    test('Should emit a `newimage` event passing the blob', function() {
      var spy = sinon.spy();
      this.camera.on('newimage', spy);
      this.camera.takePicture({});
      var arg = spy.args[0][0];
      assert.equal(arg.blob, 'the-blob');
    });

    test('Should set focus back to none', function() {
      this.camera.takePicture({});
      assert.isTrue(this.camera.set.calledWith('focus', 'none'));
    });

    test('Should emit a `ready` event once done', function() {
      var busy = sinon.spy();
      var ready = sinon.spy();

      this.camera.on('busy', busy);
      this.camera.on('ready', ready);
      this.camera.takePicture({});

      assert.isTrue(busy.calledBefore(ready));
    });

    test('Should call `mozCamera.resumePreview` after `takePicture`', function() {
      var takePicture = this.camera.mozCamera.takePicture;
      var resumePreview = this.camera.mozCamera.resumePreview;

      this.camera.takePicture({});
      assert.isTrue(takePicture.calledBefore(resumePreview));
    });
  });

  suite('Camera#onPreviewStateChange()', function() {
    setup(function() {
      this.camera = new this.Camera();
      sinon.stub(this.camera, 'emit');
    });

    test('Should fire \'busy\' event if \'stopped\' or \'paused\'', function() {
      this.camera.onPreviewStateChange('stopped');
      assert.ok(this.camera.emit.calledWith('busy'));
      this.camera.emit.reset();

      this.camera.onPreviewStateChange('paused');
      assert.ok(this.camera.emit.calledWith('busy'));
    });

    test('Should not fire \'ready\' event for all other states', function() {
      this.camera.onPreviewStateChange('something else');
      assert.ok(this.camera.emit.calledWith('ready'));
      this.camera.emit.reset();

      this.camera.onPreviewStateChange('other');
      assert.ok(this.camera.emit.calledWith('ready'));
    });
  });

  suite('Camera#load()', function() {
    setup(function() {
      var self = this;

      this.camera = new this.Camera();

      sinon.stub(this.camera, 'emit');
      sinon.stub(this.camera, 'release').callsArg(0);
      sinon.stub(this.camera, 'configureCamera');

      sinon.stub(this.camera, 'requestCamera', function(camera, done) {
        self.camera.mozCamera = self.mozCamera;
        if (done) { done(); }
      });

      this.camera.set('selectedCamera', 'back');
    });

    test('Should emit a \'busy\' event', function() {
      this.camera.load();
      assert.isTrue(this.camera.emit.calledWith('busy'));
    });

    test('Should not request camera until camera has finished releasing', function() {
      this.camera.releasing = true;
      this.camera.load();

      assert.isFalse(this.camera.requestCamera.called);

      this.camera.releasing = false;
      this.camera.fire('released');

      assert.isTrue(this.camera.requestCamera.called);
    });

    test('Should `requestCamera` first time called', function() {
      var callback = sinon.spy();
      this.camera.load(callback);

      assert.isTrue(this.camera.requestCamera.calledWith('back'));
      assert.isFalse(this.camera.release.called);
      assert.isTrue(callback.calledOnce);
    });

    test('Should `release` camera then `request` if selectedCamera changed', function() {
      var requestCamera = this.camera.requestCamera;
      var release = this.camera.release;
      var callback = sinon.spy();

      this.camera.load();
      this.camera.set('selectedCamera', 'front');
      this.camera.requestCamera.reset();

      this.camera.load(callback);
      assert.isTrue(release.calledBefore(requestCamera));
      assert.isTrue(requestCamera.calledWith('front'));
      assert.isTrue(callback.calledOnce);
    });

    test('Should just `configureCamera` if selected camera has\'t changed', function() {
      var callback = sinon.spy();

      this.camera.load();
      this.camera.requestCamera.reset();

      this.camera.load(callback);
      assert.isTrue(this.camera.configureCamera.called);
      assert.isFalse(this.camera.requestCamera.called);
      assert.equal(callback.callCount, 1);
    });
  });

  suite('Camera#requestCamera()', function() {
    setup(function() {
      this.camera = new this.Camera();
      this.sandbox.stub(this.camera, 'configureCamera');
      navigator.mozCameras.getCamera.callsArgWith(2, this.mozCamera);
    });

    test('Should call `navigator.mozCameras.getCamera()`', function() {
      this.camera.requestCamera('back');
      assert.isTrue(navigator.mozCameras.getCamera.called);
    });

    test('Should call .configureCamera', function() {
      var callback = sinon.spy();
      this.camera.requestCamera('back', callback);
      assert.isTrue(this.camera.configureCamera.calledWith(this.mozCamera));
    });

    test('Should call the callback', function() {
      var callback = sinon.spy();
      this.camera.requestCamera('back', callback);
      assert.isTrue(callback.called);
    });

    test('Should pass a single argument on error', function() {
      var callback = sinon.spy();

      // Simulate error callback
      navigator.mozCameras.getCamera.restore();
      this.sandbox.stub(navigator.mozCameras, 'getCamera').callsArgWith(3, 'error');

      this.camera.requestCamera('back', callback);
      assert.isTrue(callback.calledWith('error'));
    });
  });

  suite('Camera#release()', function() {
    setup(function() {
      this.mozCamera.release.callsArgAsync(0);
      this.camera.mozCamera = this.mozCamera;
    });

    test('Should flag as `releasing` until released', function(done) {
      var self = this;

      this.camera.release(function() {
        assert.isFalse(self.camera.releasing);
        done();
      });

      assert.isTrue(this.camera.releasing);
    });

    test('Should call the callback', function(done) {
      this.camera.release(done);
    });

    test('Should emit \'released\' event', function(done) {
      var self = this;
      this.camera.release(function() {
        assert.isTrue(self.camera.emit.called);
        done();
      });
    });

    test('Should call the callback with an error argument', function(done) {
      var self = this;

      this.mozCamera.release = sinon.stub();
      this.mozCamera.release.callsArgWithAsync(1, 'error');

      this.camera.release(function(err) {
        assert.equal(err, 'error');
        done();
      });
    });
  });
});
