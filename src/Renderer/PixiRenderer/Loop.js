export default class Loop {

	constructor(renderFunction) {
		if (!renderFunction) {
			return
		}
		this._renderFunction = renderFunction

		this._loop = () => {
			if (this._dirty === true) {
				this._dirty = false
				this._renderFunction()
			}
			requestAnimationFrame(this._loop)
		}

		this._loop()
	}

	setDirty(dirty) {
		this._dirty = dirty
	}

	destroy() {
		if (!this._ticker) {
			return
		}
		this._ticker.destroy()
	}

}