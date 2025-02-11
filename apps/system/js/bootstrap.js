/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

window.addEventListener('load', function startup() {

  /**
   * Register global instances and constructors here.
   */
  function registerGlobalEntries() {
    /** @global */
    window.appWindowFactory = new AppWindowFactory();
    window.appWindowFactory.start();
    /** @global */
    window.activityWindowFactory = new ActivityWindowFactory();
    window.activityWindowFactory.start();
    /** @global */
    window.secureWindowManager = window.secureWindowManager ||
      new SecureWindowManager();
    /** @global */
    window.secureWindowFactory = new SecureWindowFactory();
    /** @global */
    if (window.SuspendingAppPriorityManager) {
      window.suspendingAppPriorityManager = new SuspendingAppPriorityManager();
    }
    /** @global */
    window.systemDialogManager = window.systemDialogManager ||
      new SystemDialogManager();

    /** @global */
    window.lockScreenWindowManager = new window.LockScreenWindowManager();
  }

  function safelyLaunchFTU() {
    window.addEventListener('homescreen-ready', function onHomescreenReady() {
      window.removeEventListener('homescreen-ready', onHomescreenReady);
      FtuLauncher.retrieve();
    });
    /** @global */
    window.homescreenLauncher = new HomescreenLauncher().start();
  }

  if (applications.ready) {
    registerGlobalEntries();
    safelyLaunchFTU();
  } else {
    window.addEventListener('applicationready', function appListReady(event) {
      window.removeEventListener('applicationready', appListReady);
      registerGlobalEntries();
      safelyLaunchFTU();
    });
  }

  /**
   * Enable checkForUpdate after FTU is either done or skipped.
   */
  function doneWithFTU() {
    window.removeEventListener('ftudone', doneWithFTU);
    window.removeEventListener('ftuskip', doneWithFTU);
    var lock = window.navigator.mozSettings.createLock();
    lock.set({
      'gaia.system.checkForUpdates': true
    });
  }

  window.addEventListener('ftudone', doneWithFTU);
  // Enable checkForUpdate as well if booted without FTU
  window.addEventListener('ftuskip', doneWithFTU);

  window.sourceView = new SourceView();
  Shortcuts.init();
  ScreenManager.turnScreenOn();
  Places.init();

  // Please sort it alphabetically
  window.activities = new Activities();
  window.devtoolsView = new DevtoolsView();
  window.dialerRinger = new DialerRinger().start();
  window.homeGesture = new HomeGesture().start();
  window.layoutManager = new LayoutManager().start();
  window.permissionManager = new PermissionManager().start();
  window.remoteDebugger = new RemoteDebugger();
  window.softwareButtonManager = new SoftwareButtonManager().start();

  window.telephonySettings = new TelephonySettings();
  window.telephonySettings.start();

  window.title = new Title();
  window.ttlView = new TTLView();
  window.visibilityManager = new VisibilityManager().start();

  navigator.mozL10n.ready(function l10n_ready() {
    window.mediaRecording = new MediaRecording().start();
  });

  // We need to be sure to get the focus in order to wake up the screen
  // if the phone goes to sleep before any user interaction.
  // Apparently it works because no other window has the focus at this point.
  window.focus();

  // With all important event handlers in place, we can now notify
  // Gecko that we're ready for certain system services to send us
  // messages (e.g. the radio).
  // Note that shell.js starts listen for the mozContentEvent event at
  // mozbrowserloadstart, which sometimes does not happen till window.onload.
  var evt = new CustomEvent('mozContentEvent',
      { bubbles: true, cancelable: false,
        detail: { type: 'system-message-listener-ready' } });
  window.dispatchEvent(evt);
});

window.storage = new Storage();

/* === Shortcuts === */
/* For hardware key handling that doesn't belong to anywhere */
var Shortcuts = {
  init: function rm_init() {
    window.addEventListener('keyup', this);
  },

  handleEvent: function rm_handleEvent(evt) {
    if (!ScreenManager.screenEnabled || evt.keyCode !== evt.DOM_VK_F6)
      return;

    document.location.reload();
  }
};

/* === Localization === */
/* set the 'lang' and 'dir' attributes to <html> when the page is translated */
window.addEventListener('localized', function onlocalized() {
  document.documentElement.lang = navigator.mozL10n.language.code;
  document.documentElement.dir = navigator.mozL10n.language.direction;
});

var wallpaperURL = new SettingsURL();

// Define the default background to use for all homescreens
SettingsListener.observe(
  'wallpaper.image',
  'resources/images/backgrounds/default.png',
  function setWallpaper(value) {
    document.getElementById('screen').style.backgroundImage =
      'url(' + wallpaperURL.set(value) + ')';
  }
);

// Use a setting in order to be "called" by settings app
navigator.mozSettings.addObserver(
  'clear.remote-windows.data',
  function clearRemoteWindowsData(setting) {
    var shouldClear = setting.settingValue;
    if (!shouldClear)
      return;

    // Delete all storage and cookies from our content processes
    var request = navigator.mozApps.getSelf();
    request.onsuccess = function() {
      request.result.clearBrowserData();
    };

    // Reset the setting value to false
    var lock = navigator.mozSettings.createLock();
    lock.set({'clear.remote-windows.data': false});
  });

// Cancel dragstart event to workaround
// https://bugzilla.mozilla.org/show_bug.cgi?id=783076
// which stops OOP home screen pannable with left mouse button on
// B2G/Desktop.
window.addEventListener('dragstart', function(evt) {
  evt.preventDefault();
}, true);

/* === XXX Bug 900512 === */
// On some devices touching the hardware home button triggers
// touch events at position 0,0. In order to make sure those does
// not trigger unexpected behaviors those are captured here.
function cancelHomeTouchstart(e) {
  if (e.touches[0].pageX === 0 && e.touches[0].pageY === 0) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

function cancelHomeTouchend(e) {
  if (e.changedTouches[0].pageX === 0 && e.changedTouches[0].pageY === 0) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

function cancelHomeClick(e) {
  if (e.pageX === 0 && e.pageY === 0) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

window.addEventListener('touchstart', cancelHomeTouchstart, true);
window.addEventListener('touchend', cancelHomeTouchend, true);
window.addEventListener('mousedown', cancelHomeClick, true);
window.addEventListener('mouseup', cancelHomeClick, true);
