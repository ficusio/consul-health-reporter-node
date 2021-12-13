import got, { RequestError } from 'got';

type State = 'pass' | 'warn' | 'fail';

class CheckResult {
	state: State;
	note: string;

	constructor(state: State, note: string) {
		this.state = state;
		this.note = stringify(note);
	}
}

type CheckFunction = (pass?: (note?: string) => CheckResult, warn?: (note?: string) => CheckResult, fail?: (note?: string) => CheckResult) => CheckResult;

const defaultCheck: CheckFunction = () => pass();

const stringify = (obj: unknown): string => {
	if (typeof obj === 'string') {
		return obj;
	}

	if (obj instanceof Error) {
		return obj.stack ?? obj.message ?? String(obj);
	}

	if (typeof obj === 'object') {
		return JSON.stringify(obj);
	}

	return String(obj);
};

const pass = (note = 'OK') => new CheckResult('pass', note);
const warn = (note = 'Help me please!') => new CheckResult('warn', note);
const fail = (note = 'I\'m a teapot.') => new CheckResult('fail', note);

/**
 * Regularly reports health state to Consul.
 */
export class ConsulHealthReporter {
	private readonly checkId: string;
	private readonly consulAgentUrl: string;
	private readonly intervalSec: number;
	private readonly checkFunc: CheckFunction;
	private scheduleId: number | undefined;
	private interrupted: boolean;
	private result: CheckResult | undefined;

	constructor(serviceId: string, {
		consulAgentUrl = 'http://127.0.0.1:8500',
		intervalSec = 5,
		check = defaultCheck
	}: {
		consulAgentUrl?: string;
		intervalSec?: number;
		check?: CheckFunction;
	} = {}) {
		this.checkId = `service:${serviceId}`;
		this.consulAgentUrl = consulAgentUrl;
		this.intervalSec = intervalSec;
		this.checkFunc = check;
		this.result = undefined;
		this.scheduleId = undefined;
		this.interrupted = false;
	}

	resume() {
		this.interrupted = false;
		this.checkAndReport();
		this.reschedule();
		return this;
	}

	makeWarn(note: string) {
		this.interrupt(warn(note));
		return this;
	}

	makeFail(note: string) {
		this.interrupt(fail(note));
		return this;
	}

	stop() {
		this.unschedule();
		return this;
	}

	private interrupt(result: CheckResult) {
		this.interrupted = true;
		this.result = result;
		this.report();
		this.reschedule();
	}

	private reschedule() {
		this.unschedule();
		this.scheduleId = setInterval(_ => {
			this.checkAndReport();
		}, 1000 * this.intervalSec);
	}

	private unschedule() {
		if (this.scheduleId === undefined) return;

		clearInterval(this.scheduleId);
		this.scheduleId = undefined;
	}

	private checkAndReport() {
		if (!this.interrupted) {
			this.check();
		}

		this.report();
	}

	private check() {
		try {
			const result = this.checkFunc(pass, warn, fail);
			if (!(result instanceof CheckResult)) {
				throw new TypeError(`invalid check function result: ${result as string}`);
			}

			this.result = result;
		} catch (error: unknown) {
			this.result = fail(stringify(error));
		}
	}

	private report() {
		const result = this.result;
		const state = String(result?.state);
		const note = String(result?.note);
		const url = `${this.consulAgentUrl}/v1/agent/check/${state}/${this.checkId}`;
		got(url, {
			body: JSON.stringify({ note })
		}).catch((error: RequestError) => {
			const statusCode = Number(error.code);
			const message = error.message;
			const errorDescription = error ? error : (statusCode === 200 ? undefined : `Consul returned status ${statusCode}, message: "${message}"`);
			if (errorDescription) console.error('[ConsulHealthReporter] failed to report health "%s" (check %):%s', state, this.checkId, errorDescription);
		});
	}
}
