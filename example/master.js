'use strict';

const util = require('util');
const path = require('path');
const nounou = require('../');
const timerPath = path.join(__dirname, 'test.js');

// 任务进程
nounou(timerPath).on('fork', function (worker) {
  console.log('[%s] [worker:%d] new task worker start', Date(), worker.pid);
}).on('disconnect', function (worker) {
  console.error('[%s] [master:%s] task worker: %s disconnect.',
    Date(), process.pid, worker.pid);
}).on('unexpectedExit', function (worker, code, signal) {
  var err = new Error(util.format('task worker %s died (code: %s, signal: %s)',
    worker.pid, code, signal));
  err.name = 'WorkerDiedError';
  console.error('[%s] [master:%s] worker exit: %s', Date(), process.pid, err.stack);
}).on('reachReforkLimit', function () {
  console.error('Too much refork!!!!!!');
});
