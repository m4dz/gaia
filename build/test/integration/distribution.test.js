'use strict';

/* global require, process, suite, suiteSetup, test, teardown */
var rmrf = require('rimraf').sync;
var exec = require('child_process').exec;
var vm = require('vm');
var AdmZip = require('adm-zip');
var helper = require('./helper');
var path = require('path');
var assert = require('chai').assert;
var fs = require('fs');

suite('Distribution mechanism', function() {
  var cusDir;
  suiteSetup(function() {
    rmrf('profile');
    rmrf('build_stage');
  });

  function validatePreloadSettingDB() {
    var settingsPath = path.join(process.cwd(), 'profile', 'settings.json');
    var settings = JSON.parse(fs.readFileSync(settingsPath));
    var expectedSettings = JSON.parse(
      fs.readFileSync(path.join(cusDir, 'settings.json')));

    var keyboardManifestURL = 'app://keyboard.gaiamobile.org/manifest.webapp';
    var expectedLayouts = {};
    // For test only, so deliberately makes English map to cs and es layout
    expectedLayouts[keyboardManifestURL] = {cs: true, es: true};

    var expectedSettings = {
      'wap.push.enabled': true,
      'keyboard.enabled-layouts': expectedLayouts,
      'keyboard.default-layouts': expectedLayouts
    };

    helper.checkSettings(settings, expectedSettings);
  }

  function validateSettings() {
    var setingsZipPath = path.join(process.cwd(), 'profile',
      'webapps', 'settings.gaiamobile.org', 'application.zip');

    helper.checkFileContentByPathInZip(
      setingsZipPath, 'resources/support.json',
      path.join(cusDir, 'support.json'), true);

    helper.checkFileContentByPathInZip(
      setingsZipPath, 'resources/sensors.json',
      path.join(cusDir, 'sensors.json'), true);
  }

  function validateComm() {
    var zipPath = path.join(process.cwd(), 'profile',
      'webapps', 'communications.gaiamobile.org', 'application.zip');
    var variantConfig = {
        'wallpaper':'/resources/mobizilla_wallpaper.png',
        'default_contacts':'/resources/mobizilla_contacts.json',
        'support_contacts':'/resources/mobizilla_support_contacts.json',
        'keyboardSettings':'/resources/mobizilla_keyboard.json',
        'dataiconstatusbar':'/resources/mobizilla_network_type.json',
        'knownNetworks':'/resources/mobizilla_known_networks.json'
    };
    var expectedCustom = {
      '310-260': variantConfig,
      '311-261': variantConfig
    };
    helper.checkFileContentInZip(zipPath, 'resources/customization.json',
      expectedCustom, true);
    helper.checkFileInZip(zipPath, 'resources/mobizilla_wallpaper.png',
      path.join(cusDir, 'mobizilla', 'mobizilla_wallpaper.png'));
    helper.checkFileInZip(zipPath, 'resources/mobizilla_contacts.json',
      path.join(cusDir, 'mobizilla', 'mobizilla_contacts.json'));
    helper.checkFileInZip(zipPath, 'resources/mobizilla_support_contacts.json',
      path.join(cusDir, 'mobizilla', 'mobizilla_support_contacts.json'));
    helper.checkFileInZip(zipPath, 'resources/mobizilla_keyboard.json',
      path.join(cusDir, 'mobizilla', 'mobizilla_keyboard.json'));
    helper.checkFileInZip(zipPath, 'resources/mobizilla_network_type.json',
      path.join(cusDir, 'mobizilla', 'mobizilla_network_type.json'));
    helper.checkFileInZip(zipPath, 'resources/mobizilla_known_networks.json',
      path.join(cusDir, 'mobizilla', 'mobizilla_known_networks.json'));
  }

  function validateCalendar() {
    var calZip = new AdmZip(path.join(process.cwd(), 'profile',
      'webapps', 'calendar.gaiamobile.org', 'application.zip'));
    var presetsContent = calZip.readAsText(calZip.getEntry('js/presets.js'));
    assert.isNotNull(presetsContent, 'js/presets.js should exist');
    var sandbox = { Calendar: { Presets: null } };
    vm.runInNewContext(presetsContent, sandbox);

    var expectedCalendarData = JSON.parse(fs.readFileSync(
      path.join(cusDir, 'calendar.json')));

    helper.checkSettings(sandbox.Calendar.Presets, expectedCalendarData);
  }

  function validateWappush() {
    var wappushZipPath = path.join(process.cwd(), 'profile',
      'webapps', 'wappush.gaiamobile.org', 'application.zip');

    helper.checkFileContentByPathInZip(wappushZipPath, 'js/whitelist.json',
      path.join(cusDir, 'wappush-whitelist.json'), true);
  }

  function validateWallpaper() {
    var zipPath = path.join(process.cwd(), 'profile',
      'webapps', 'wallpaper.gaiamobile.org', 'application.zip');
    helper.checkFileContentByPathInZip(zipPath, 'resources/list.json',
      path.join(cusDir, 'wallpapers', 'list.json'), true);

    helper.checkFileContentByPathInZip(zipPath,
      'resources/customize.png',
      path.join(cusDir, 'wallpapers', 'customize.png'), false);
  }

  function validateBrowser() {
    var broZipPath = path.join(process.cwd(), 'profile',
      'webapps', 'browser.gaiamobile.org', 'application.zip');
    helper.checkFileContentByPathInZip(broZipPath, 'js/init.json',
      path.join(cusDir, 'browser.json'), true);
  }

  function validateSystem() {
    var sysZipPath = path.join(process.cwd(), 'profile',
          'webapps', 'system.gaiamobile.org', 'application.zip');
    helper.checkFileContentByPathInZip(sysZipPath, 'resources/icc.json',
      path.join(cusDir, 'icc.json'), true);
    helper.checkFileContentByPathInZip(sysZipPath, 'resources/wapuaprof.json',
      path.join(cusDir, 'wapuaprof.json'), true);
    helper.checkFileContentByPathInZip(sysZipPath,
      'resources/power/carrie_power_on.png',
      path.join(cusDir, 'power', 'carrie_power_on.png'), false);
  }

  function validateSms() {
    var zipPath = path.join(process.cwd(), 'profile',
      'webapps', 'sms.gaiamobile.org', 'application.zip');
    helper.checkFileContentByPathInZip(zipPath, 'js/blacklist.json',
      path.join(cusDir, 'sms-blacklist.json'), true);
  }

  function parseCustimizeImageSetting(appConfig) {
    if (typeof appConfig !== 'object') {
      return '';
    }
    var expectedContent =
      '//\n' +
      '// This file is automatically generated: DO NOT EDIT.\n' +
      '// To change these values, create a camera.json file in the\n' +
      '// distribution directory with content like this: \n' +
      '//\n' +
      '//   {\n' +
      '//     "maxImagePixelSize": 6000000,\n' +
      '//     "maxSnapshotPixelSize": 4000000 }\n' +
      '//   }\n' +
      '//\n' +
      '// Optionally, you can also define variables to specify the\n' +
      '// minimum EXIF preview size that will be displayed as a\n' +
      '// full-screen preview by adding a property like this:\n' +
      '//\n' +
      '// "requiredEXIFPreviewSize": { "width": 640, "height": 480}\n' +
      '//\n' +
      '// If you do not specify this property then EXIF previews will only\n' +
      '// be used if they are big enough to fill the screen in either\n' +
      '// width or height in both landscape and portrait mode.\n' +
      '//\n' +
      'var CONFIG_MAX_IMAGE_PIXEL_SIZE = ' +
        appConfig.maxImagePixelSize + ';\n' +
      'var CONFIG_MAX_SNAPSHOT_PIXEL_SIZE = ' +
        appConfig.maxSnapshotPixelSize + ';\n';

    if (appConfig.requiredEXIFPreviewSize) {
      expectedContent +=
        'var CONFIG_REQUIRED_EXIF_PREVIEW_WIDTH = ' +
        appConfig.requiredEXIFPreviewSize.width + ';\n' +
        'var CONFIG_REQUIRED_EXIF_PREVIEW_HEIGHT = ' +
        appConfig.requiredEXIFPreviewSize.height + ';\n';
    } else {
      expectedContent +=
        'var CONFIG_REQUIRED_EXIF_PREVIEW_WIDTH = 0;\n' +
        'var CONFIG_REQUIRED_EXIF_PREVIEW_HEIGHT = 0;\n';
    }
    return expectedContent;
  }

  function validateGallery() {
    var cusPath = path.join(cusDir, 'gallery.json');
    var cusConfig = JSON.parse(fs.readFileSync(cusPath));
    var appZip = new AdmZip(path.join(process.cwd(), 'profile',
      'webapps', 'gallery.gaiamobile.org', 'application.zip'));
    var presetsContent = appZip.readAsText(appZip.getEntry('js/config.js'));

    var expectContent = parseCustimizeImageSetting(cusConfig);
    assert.equal(presetsContent,  expectContent);
  }

  function validateHomescreen() {
    var appZip = new AdmZip(path.join(process.cwd(), 'profile',
      'webapps', 'homescreen.gaiamobile.org', 'application.zip'));
    var config = JSON.parse(appZip.readAsText(appZip.getEntry('js/init.json')));

    assert.equal(config.grid[0][0].name, 'Camera');
    assert.equal(config.grid[0][1].entry_point, 'dialer');
    assert.equal(config.grid[0][2].name, 'Messages');
    assert.equal(config.grid[0][3].name, 'Marketplace');
    assert.equal(config.grid[1][0].name, 'Gallery');

    assert.isTrue(fs.existsSync(path.join(process.cwd(), 'profile',
      'svoperapps', 'Twitter')),
      'profile/svoperapps/Twitter directory should exist');
    assert.isTrue(fs.existsSync(path.join(process.cwd(), 'profile',
      'svoperapps', 'Twitter', 'manifest.webapp')),
      'manifest for Twitter should exist');
  }

  function validateVariantSettings() {
    var expected = {
      '310-260': ['Twitter'],
      '311-261': ['Twitter']
    };
    var configPath = path.join(process.cwd(), 'profile', 'svoperapps',
      'singlevariantconf.json');
    var config = fs.readFileSync(configPath, {encoding: 'utf8'});
    assert.deepEqual(JSON.parse(config), expected);
  }

  test('build with GAIA_DISTRIBUTION_DIR', function(done) {
    cusDir = path.join(process.cwd(), 'customization');
    var cmd = 'GAIA_DISTRIBUTION_DIR=' + cusDir + ' make';
    exec(cmd, { maxBuffer: 400*1024 }, function(error, stdout, stderr) {
      helper.checkError(error, stdout, stderr);
      validatePreloadSettingDB();
      validateSettings();
      validateCalendar();
      validateWappush();
      validateBrowser();
      validateSystem();
      validateSms();
      validateGallery();
      validateComm();
      validateHomescreen();
      validateWallpaper();
      validateVariantSettings();
      done();
    });
  });

  teardown(function() {
    rmrf('profile');
    rmrf('build_stage');
  });
});
