import { TextElement, Container } from "./Renderer"

export default class TextManager extends Container {

	constructor(mainContainer) {
		super("textManager", mainContainer)

		this._textElement = new TextElement("textElement", this)
	}

	showMessage(message) { // Where message should be = { type, data }
		// Beware: we can have message.text = 0 (when divina loading starts)
		if (!message || !message.type || message.data === undefined) {
			return
		}

		// Write full text based on message type
		const { type, data } = message
		let text = null
		switch (type) {
		case "loading":
			text = `Loading... ${data}%`
			break
		case "error":
			text = `ERROR!\n${data}`
			break
		default:
			break
		}

		if (!this._textElement || !text) {
			return
		}
		this._textElement.setText(text)
	}

	destroy() {
		// Since this destroy function already runs after all first resources have loaded,
		// ensure the Player's ultimate call to it does not try and achieve the same
		if (!this._textElement) {
			return
		}
		this._textElement.destroy()
		this._textElement = null

		this.removeFromParent()
	}

}