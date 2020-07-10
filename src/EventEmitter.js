export default class EventEmitter {

	constructor() {
		this._callbacks = {}
	}

	on(event, callback) {
		if (!this._callbacks[event]) {
			this._callbacks[event] = []
		}
		this._callbacks[event].push(callback)
	}

	emit(event, data) {
		const callbacksArray = this._callbacks[event]
		if (callbacksArray) {
			callbacksArray.forEach((callback) => {
				callback(data)
			})
		}
	}

}