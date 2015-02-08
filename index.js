import needle from 'needle';

/**
 * Regularly reports health state to Consul.
 */
export default class ConsulHealthReporter {

  constructor(serviceId, {
    consulAgentUrl = 'http://127.0.0.1:8500',
    intervalSec = 5,
    check = defaultCheck
  } = {}) {
    this._checkId = `service:${serviceId}`;
    this._consulAgentUrl = consulAgentUrl;
    this._intervalSec = intervalSec;
    this._checkFunc = check;
    this._result = undefined;
    this._scheduleId = undefined;
    this._interrupted = false;
  }

  resume() {
    this._interrupted = false;
    this._checkAndReport();
    this._reschedule();
    return this;
  }

  makeWarn(note) {
    this._interrupt(warn(note));
    return this;
  }

  makeFail(note) {
    this._interrupt(fail(note));
    return this;
  }

  stop() {
    this._unschedule();
    return this;
  }

  _interrupt(result) {
    this._interrupted = true;
    this._result = result;
    this._report();
    this._reschedule();
  }

  _reschedule() {
    this._unschedule();
    this._scheduleId = setInterval(_ => this._checkAndReport(), 1000 * this._intervalSec);
  }

  _unschedule() {
    if (this._scheduleId == undefined) {
      return;
    }
    clearInterval(this._scheduleId);
    this._scheduleId = undefined;
  }

  _checkAndReport() {
    if (!this._interrupted) {
      this._check();
    }
    this._report();
  }

  _check() {
    var checkResult;
    try {
      checkResult = this._checkFunc(pass, warn, fail);
      if (!(checkResult instanceof CheckResult)) {
        throw new TypeError(`invalid check function result: ${checkResult}`);
      }
    } catch (e) {
      checkResult = fail(e);
    }
    this._result = checkResult;
  }

  _report() {
    let result = this._result,
        url = `${this._consulAgentUrl}/v1/agent/check/${result.state}/${this._checkId}`;
    needle.request('get', url, {note: result.note}, (err, res) => {
      let errDesc = err
        ? err
        : res.statusCode == 200
          ? undefined
          : `Consul returned status ${res.statusCode}, message: "${res.raw}"`;
      if (errDesc) console.error(
        `[ConsulHealthReporter] failed to report health "${result.state}" (check ${this._checkId}):`,
        errDesc
      );
    });
  }
}


const defaultCheckResult = pass();

function defaultCheck() {
  return defaultCheckResult;
}


function pass(note = "I'm ok") {
  return new CheckResult('pass', note);
}

function warn(note = "Help me please!") {
  return new CheckResult('warn', note);
}

function fail(note = "I'm a teapot.") {
  return new CheckResult('fail', note);
}


function CheckResult(state, note) {
  this.state = state;
  this.note = attempt(stringify, note) || '' + note;
}

function stringify(obj) {
  if (typeof obj == 'string') {
    return obj;
  }
  if (obj instanceof Error) {
    return obj.stack || obj.message || '' + obj;
  }
  if (typeof obj == 'object') {
    return JSON.stringify(obj);
  }
  return '' + obj;
}

function attempt(func, arg) {
  try {
    return func(arg);
  }
  catch(e) {
    return null;
  }
}
