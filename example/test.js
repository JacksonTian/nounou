setTimeout(function () {
  process.send({type: 'suicide'});
  process.exit(0);
  // throw new Error('exit with exception');
}, 1000);
