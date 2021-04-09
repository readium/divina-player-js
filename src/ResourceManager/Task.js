export default class Task {

	// Used in AsyncTaskQueue

	get id() { return this._id }

	get data() { return this._data }

	get priority() { return this._priority }

	get forcedPriority() { return this._forcedPriority }

	constructor(id, data, doAsync, doOnEnd, doOnKill, forcedPriority) {
		this._id = id
		this.setData(data)
		this._doAsync = doAsync
		this._doOnEnd = doOnEnd
		this._doOnKill = doOnKill
		this._forcedPriority = (forcedPriority !== undefined) ? forcedPriority : null

		this._priority = this._forcedPriority
		this._isRunning = false
	}

	setData(data) {
		this._data = data
	}

	setPriority(priority) {
		this._priority = priority
	}

	run(doAtTheVeryEnd) {
		this._isRunning = true

		const callback = () => {
			this._isRunning = false
			if (this._doOnEnd) {
				this._doOnEnd()
			}
			if (doAtTheVeryEnd) {
				doAtTheVeryEnd()
			}
		}

		if (this._doAsync) {
			this._doAsync()
				.then(callback)
				.catch(() => {
					callback()
				})
		} else {
			callback()
		}
	}

	kill() {
		if (this._isRunning === true && this._doOnKill) {
			this._doOnKill()
		}
		this._isRunning = false
	}

}