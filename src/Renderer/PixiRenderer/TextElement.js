import { Text as PixiTextContainer } from "pixi.js-legacy"

import Container from "./Container"

import * as Utils from "../../utils"
import * as constants from "../../constants"

// All functions are used in TextManager

export default class TextElement extends Container {

	constructor(name, parent) {
		const {
			TEXT_FONT_FAMILY,
			TEXT_FONT_SIZE,
			TEXT_FILL_COLOR,
			WORD_WRAP_WIDTH,
		} = constants

		const pixiTextContainer = new PixiTextContainer("", {
			fontFamily: TEXT_FONT_FAMILY,
			fontSize: TEXT_FONT_SIZE,
			fill: Utils.convertColorStringToNumber(TEXT_FILL_COLOR),
			wordWrap: true,
			wordWrapWidth: WORD_WRAP_WIDTH,
		})
		pixiTextContainer.anchor.set(0.5)

		super("text", name, parent, pixiTextContainer)
	}

	setText(text) {
		this._pixiContainer.text = text
	}

	destroy() {
		this._pixiContainer.destroy({ children: true, texture: true, baseTexture: true })
		this.removeFromParent()
	}

}