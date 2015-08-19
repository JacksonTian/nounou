# nounou(保姆)
Node.js process deamon.

## 非Cluster模式的进程守护
cluster的fork形式仅能对单一进程使用。nounou适合其他情况，比如守护定时任务。

注意：nounou仅负责重启，不负责调度，不负责负载均衡。

## Usage

```js
var nounou = require('nounou');
var timerPath = '/path/to/timer.js';

// 任务进程
nounou(timerPath).on('fork', function (worker) {
  console.log('[%s] [%d] new task worker start', Date(), worker.pid);
}).on('disconnect', function (worker) {
  console.error('[%s] [%s] task worker: %s disconnect.',
    Date(), process.pid, worker.pid);
}).on('unexpectedExit', function (worker, code, signal) {
  var err = new Error(util.format('task worker %s died (code: %s, signal: %s)',
    worker.pid, code, signal));
  err.name = 'WorkerDiedError';
  console.error('[%s] [%s] worker exit: %s', Date(), process.pid, err.stack);
}).on('reachReforkLimit', function () {
  console.error('Too much refork!!!!!!');
});
```

## 正常退出
如果子进程在运行一段时间后需要退出，之后无需重启。需要通过如下方式进行退出：

```js
process.send({type: 'suicide'});
process.exit(0);
```

该行为会触发`expectedExit`事件，标志退出符合预期，无需重启。

## Events

- `exit`。退出事件。
- `expectedExit`。预期的退出事件。
- `unexpectedExit`。非预期的退出事件。
- `disconnect`。IPC通道断开的事件。
- `reachReforkLimit`。单位事件内重启次数达到上限。该事件后，进程不会再次重启。

## License
The MIT license
