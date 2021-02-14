'use strict';

const EventEmitter = require('events');
const util = require('util');
const fork = require('child_process').fork;

module.exports = function (modulePath, options = {}) {
  const refork = options.refork !== false;
  const limit = options.limit || 10;
  const count = options.count || 1;
  const duration = options.duration || 60000; // 1 min
  const disconnects = {};
  var disconnectCount = 0;
  var unexpectedCount = 0;

  const deamon = new EventEmitter();
  const reforks = [];

  /**
   * allow refork
   */
  function allow() {
    if (!refork) {
      return false;
    }

    const times = reforks.push(Date.now());

    if (times > limit) {
      reforks.shift();
    }

    const span = reforks[reforks.length - 1] - reforks[0];
    const canFork = reforks.length < limit || span > duration;

    if (!canFork) {
      deamon.emit('reachReforkLimit');
    }

    return canFork;
  }

  /**
   * uncaughtException default handler
   */
  function onerror(err) {
    console.error('[%s] [%s] master uncaughtException: %s', Date(), process.pid, err.stack);
    console.error(err);
    console.error('(total %d disconnect, %d unexpected exit)', disconnectCount, unexpectedCount);
  }

  /**
   * unexpectedExit default handler
   */
  function onUnexpected(worker, code, signal) {
    const err = new Error(util.format('worker:%s died unexpected (code: %s, signal: %s)',
      worker.pid, code, signal));
    err.name = 'UnexpectedWorkerDiedError';

    console.error('[%s] [%s] (total %d disconnect, %d unexpected exit) %s',
      Date(), process.pid, disconnectCount, unexpectedCount, err.stack);
  }

  var _fork = function () {
    const cp = fork(modulePath, options.args);
    deamon.emit('fork', cp);
    cp.on('disconnect', function () {
      deamon.emit('disconnect', cp);
    });
    cp.on('exit', function (code, signal) {
      deamon.emit('exit', cp, code, signal);
    });
    cp.on('message', function (message) {
      if (message && message.type === 'suicide') {
        cp.suicide = true;
      }
    });
  };

  var _refork = function () {
    if (allow()) {
      _fork();
    }
  };

  process.nextTick(function () {
    for (var i = 0; i < count; i++) {
      _fork();
    }
  });

  deamon.on('disconnect', function (worker) {
    disconnectCount++;
    disconnects[worker.pid] = new Date();
    if (!worker.suicide) {
      _refork();
    }
  });

  deamon.on('exit', function (worker, code, signal) {
    // ignore suicied or exit normally worker
    if (worker.suicide || code === 0) {
      deamon.emit('expectedExit', worker, code, signal);
      return;
    }

    if (disconnects[worker.pid]) {
      delete disconnects[worker.pid];
      // worker disconnect first, exit expected
      return;
    }

    unexpectedCount++;
    _refork();
    deamon.emit('unexpectedExit', worker, code, signal);
  });

  // defer to set the listeners
  // so you can listen this by your own
  process.nextTick(function () {
    if (process.listenerCount('uncaughtException') === 0) {
      process.on('uncaughtException', onerror);
    }

    if (deamon.listenerCount('unexpectedExit') === 0) {
      deamon.on('unexpectedExit', onUnexpected);
    }
  });

  return deamon;
};
