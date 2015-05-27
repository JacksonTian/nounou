# deamon
Node.js process deamon.

## 非Cluster模式的进程守护
cluster的fork形式仅能对单一进程使用。deamon适合其他情况，比如守护定时任务。

注意：deamon仅负责重启，不负责调度，不负责负载均衡。

## Usage

```js
var deamon = require('deamon');
var timerPath = '/path/to/timer.js';

// 任务进程
daemon(timerPath).on('fork', function (worker) {
  console.log('[%s] [worker:%d] new task worker start', Date(), worker.pid);
}).on('disconnect', function (worker) {
  console.error('[%s] [master:%s] task worker: %s disconnect.',
    Date(), process.pid, worker.pid);
}).on('exit', function (worker, code, signal) {
  var exitCode = worker.exitCode;
  var err = new Error(util.format('task worker %s died (code: %s, signal: %s)',
    worker.pid, exitCode, signal));
  err.name = 'TaskWorkerDiedError';
  console.error('[%s] [master:%s] worker exit: %s', Date(), process.pid, err.stack);
}).on('reachReforkLimit', function () {
  console.error('Too much refork!!!!!!');
});
```

## License
The MIT license
