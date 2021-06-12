import { TextElement, Container } from "../Renderer"

import * as constants from "../constants"

const {
	LOADING_FILL_COLOR,
	LOADING_FONT_FAMILY,
	LOADING_FONT_SIZE,
	LOADING_MESSAGE,
} = constants

export default class TextManager extends Container {

	constructor(mainContainer, player) {
		super("textManager", "textManager", mainContainer)

		this._player = player

		const textOptions = {
			fillColor: LOADING_FILL_COLOR,
			fontFamily: LOADING_FONT_FAMILY,
			fontSize: LOADING_FONT_SIZE,
			hAlign: "center",
		}
		this._textElement = new TextElement("loadingText", this, textOptions)
	}

	showMessage(message) { // Where message should be = { type, data }
		// Beware: we can have message.text = 0 (when a Divina starts loading)
		if (!message || !message.type || message.data === undefined) {
			return
		}

		// Write full text based on message type
		const { type, data } = message
		let text = null
		switch (type) {
		case "loading":
			text = `${LOADING_MESSAGE}... ${data}%`
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
		if (!this._textElement) {
			return
		}
		this._textElement.destroy()
		this._textElement = null

		this.removeFromParent()
	}

}