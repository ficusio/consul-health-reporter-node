Regularly reports health state of a Node.js app to [Consul](https://consul.io). Useful for TTL kind of [checks](https://consul.io/docs/agent/checks.html).

Does not perform registration of a service, at least for now. If you're using Docker, check this excellent [automatical service registrator](https://github.com/progrium/registrator).


## Installation

```bash
$ npm install consul-health-reporter
```

The source is written in ES6, but ES5 version is provided too (generated using [6to5](http://6to5.org)):

```js
// ES6
import Reporter from 'consul-health-reporter'

// ES5
var Reporter = require('consul-health-reporter/es5')
```


## API

### Constructor

`new Reporter(serviceId, opts)`

Returns a new instance of reporter.

* `serviceId` ID of the service, which must be already registered in Consul; required.
* `opts.consulAgentUrl` URL of local Consul agent's HTTP interface, defaults to `'http://127.0.0.1:8500'`.
* `opts.intervalSec` Interval between successive reports, defaults to 5 seconds. Should be smaller than TTL specified for the Consul check, to reduce the possibility of Consul assuming that the service is dead when a report was delayed due to ephemeral conditions, e.g. high CPU load.
* `opts.check` A function to determine current health state of the app; defaults to always reporting passing state. It is called each time health is about to be reported, and provided with three arguments: `pass`, `warn` and `fail`, which are functions that accept a single optional parameter, `note`. The check function should return the result of calling one of these functions, e.g. `return pass('ok')`.

The reporter will not report anything until `reporter.resume()` is called.

### resume

`reporter.resume()`

Starts reporting health to Consul, or resumes normal operation after calling `makeWarn()` or `makeFail()`. Sends the first report immediately.

Returns the same reporter instance.

### makeWarn and makeFail

`reporter.makeWarn(note)`

`reporter.makeFail(note)`

Immediately reports warning/failure health state to Consul. Stops consulting `opts.check` function, assuming that health state will not change until `reporter.resume()` is called.

The `note` parameter is optional. Returns the same reporter instance.


## Example

```js
var Reporter = require('consul-health-reporter/es5');

var health = new Reporter('my-app', {
  intervalSec: 7,
  check: myAppCheck
});

function myAppCheck(pass, warn, fail) {
  if (isEverythingOk()) {
    return pass();
  }
  return fail('oh no!');
}

process.on('uncaughtException', reportAndExit);

function reportAndExit(err) {
  console.log('Error (will exit): ' + (err && err.stack || err));
  // report immediately, don't wait till the next scheduled time
  health.makeFail(err);
  // stop normal operation
  stopAcceptingRequests();
  // allow the report to reach Consul
  setTimeout(process.exit.bind(process, 1), 1000);
}

http.createServer(app.callback())

.on('error', function(err) {
  reportAndExit('cannot start server: ' + err);
})

.listen(3000, function() {
  console.log('listening on port 3000');
  // start reporting health
  health.resume();
});
```
