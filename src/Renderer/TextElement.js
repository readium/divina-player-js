import { Text as PIXITextContainer } from "pixi.js-legacy"

import Container from "./Container"

import * as constants from "../constants"

// All functions are used in TextManager

export default class TextElement extends Container {

	constructor(name, parent) {
		const {
			textFontFamily,
			textFontSize,
			textFillColor,
			wordWrapWidth,
		} = constants
		const pixiTextContainer = new PIXITextContainer("", {
			fontFamily: textFontFamily,
			fontSize: textFontSize,
			fill: textFillColor,
			wordWrap: true,
			wordWrapWidth,
		})
		pixiTextContainer.anchor.set(0.5)

		super(name, parent, pixiTextContainer)
	}

	setText(text) {
		this._pixiContainer.text = text
	}

	destroy() {
		this._pixiContainer.destroy({ children: true, texture: true, baseTexture: true })
		this.removeFromParent()
	}

}