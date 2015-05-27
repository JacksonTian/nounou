'use strict';

var EventEmitter = require('events');
var util = require('util');
var fork = require('child_process').fork;

module.exports = function (modulePath, options) {
  options = options || {};
  var refork = options.refork !== false;
  var limit = options.limit || 60;
  var duration = options.duration || 60000; // 1 min
  var disconnects = {};
  var disconnectCount = 0;
  var unexpectedCount = 0;

  var deamon = new EventEmitter();
  var reforks = [];

  /**
   * allow refork
   */
  function allow() {
    if (!refork) {
      return false;
    }

    var times = reforks.push(Date.now());

    if (times > limit) {
      reforks.shift();
    }

    var span = reforks[reforks.length - 1] - reforks[0];
    var canFork = reforks.length < limit || span > duration;

    if (!canFork) {
      deamon.emit('reachReforkLimit');
    }

    return canFork;
  }

  /**
   * uncaughtException default handler
   */

  function onerror(err) {
    console.error('[%s] [master:%s] master uncaughtException: %s', Date(), process.pid, err.stack);
    console.error(err);
    console.error('(total %d disconnect, %d unexpected exit)', disconnectCount, unexpectedCount);
  }

  /**
   * unexpectedExit default handler
   */
  function onUnexpected(worker, code, signal) {
    var exitCode = worker.exitCode;
    var err = new Error(util.format('worker:%s died unexpected (code: %s, signal: %s, suicide: %s, state: %s)',
      worker.pid, exitCode, signal, worker.suicide, worker.state));
    err.name = 'WorkerDiedUnexpectedError';

    console.error('[%s] [master:%s] (total %d disconnect, %d unexpected exit) %s',
      Date(), process.pid, disconnectCount, unexpectedCount, err.stack);
  }

  var _fork = function () {
    if (allow()) {
      var cp = fork(modulePath);
      deamon.emit('fork', cp);
      cp.on('disconnect', function () {
        deamon.emit('disconnect', cp);
      });
      cp.on('exit', function (code, signal) {
        deamon.emit('exit', cp, code, signal);
      });
    }
  };

  _fork();

  deamon.on('disconnect', function (worker) {
    disconnectCount++;
    disconnects[worker.pid] = new Date();
    _fork();
  });

  deamon.on('exit', function (worker, code, signal) {
    if (disconnects[worker.pid]) {
      delete disconnects[worker.pid];
      // worker disconnect first, exit expected
      return;
    }
    unexpectedCount++;
    _fork();
    deamon.emit('unexpectedExit', worker, code, signal);
  });

  // defer to set the listeners
  // so you can listen this by your own
  process.nextTick(function () {
    if (EventEmitter.listenerCount(process, 'uncaughtException') === 0) {
      process.on('uncaughtException', onerror);
    }

    if (EventEmitter.listenerCount(deamon, 'unexpectedExit') === 0) {
      deamon.on('unexpectedExit', onUnexpected);
    }
  });

  return deamon;
};
