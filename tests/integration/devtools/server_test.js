/* global RemoteDebugger, DebuggerServer */
'use strict';
var assert = require('assert');

marionette('Dev Tools server', function() {

  var client = marionette.client({
    prefs: {
      'devtools.debugger.prompt-connection': false,
      'devtools.debugger.forbid-certified-apps': false,
      'devtools.debugger.unix-domain-socket': '6080'
    },
    settings: {
      'debugger.remote-mode': 'adb-devtools'
    }
  });
  client = client.scope({ context: 'chrome' });

  setup(function() {
    var remoteMode = client.settings.get('debugger.remote-mode');
    assert.equal(remoteMode, 'adb-devtools', 'Remote mode setting verified');
  });

  test('is running and listening', function() {
    var debuggerServerInited = client.executeScript(function() {
      return DebuggerServer.initialized;
    });
    assert.ok(debuggerServerInited, 'Debugger server initialized');
    var debuggerServerListening = client.executeScript(function() {
      return !!DebuggerServer._listener;
    });
    assert.ok(debuggerServerListening, 'Debugger server listening');
  });

});
