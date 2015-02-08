Regularly reports health state of a Node.js app to [Consul](https://consul.io). Useful for TTL kind of [checks](https://consul.io/docs/agent/checks.html).


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
* `opts.consulAgentUrl` URL of local Consul agent, defaults to `'http://127.0.0.1:8500'`.
* `opts.intervalSec` Interval between successive reports, defaults to 5 seconds. Should be smaller than TTL specified for the check.
* `opts.check` A function to determine current health state of the app; defaults to always reporting passing state. It is called each time health is about to be reported, and provided with three arguments: `pass`, `warn` and `fail`, which are functions that accept a single optional parameter, `note`. The check function should return the result of calling one of these functions, e.g. `return pass('ok')`.

The reporter will not report anything until `reporter.resume()` is called.

### resume

`reporter.resume()`

Starts reporting health to Consul, or resumes normal operation after calling `makeWarn()` or `makeFail()`.

Returns the same reporter instance.

### makeWarn and makeFail

`reporter.makeWarn(note)`
`reporter.makeFail(note)`

Immediately reports warning/failure health state to Consul. Stops consulting `opts.check` function, assuming that health state will not change until `reporter.resume()` is called.

Returns the same reporter instance.


### Example

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
  reportAndExit('error starting server: ' + err);
})

.listen(3000, function() {
  console.log('listening on port 3000');
  // start reporting health
  health.resume();
});
```
