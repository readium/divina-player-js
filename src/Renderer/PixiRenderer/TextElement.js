import {
	TextStyle as PixiTextStyle,
	Text as PixiTextContainer,
	TextMetrics as PixiTextMetrics,
} from "pixi.js-legacy"

import Container from "./Container"

import * as constants from "../../constants"

export default class TextElement extends Container {

	constructor(name, parent, textOptions = {}) {
		const {
			fillColor,
			fontFamily,
			fontSize,
			lineHeight,
			letterSpacing,
			rect,
			hAlign,
		} = textOptions

		const { unscaledSize = {} } = parent
		const textStyle = {
			fill: fillColor,
			fontFamily,
			wordWrap: true,
			wordWrapWidth: unscaledSize.width, // undefined here (for TextManager) is better than 0!
			align: hAlign,
		}
		if (rect) {
			textStyle.wordWrapWidth = (rect.unit === "%")
				? (rect.w * unscaledSize.width) / 100
				: rect.w
		}
		if (fontSize) {
			let actualFontSize = (fontSize.unit === "%")
				? (fontSize.value * unscaledSize.height) / 100
				: fontSize.value
			actualFontSize = Math.min(actualFontSize, constants.MAX_FONT_SIZE)
			textStyle.fontSize = actualFontSize
		}
		if (lineHeight) {
			textStyle.lineHeight = (lineHeight.unit === "%")
				? (lineHeight.value * unscaledSize.height) / 100
				: lineHeight.value
		}
		if (letterSpacing) {
			textStyle.letterSpacing = Math.min(letterSpacing, constants.MAX_LETTER_SPACING)
		}

		const pixiTextContainer = new PixiTextContainer("", textStyle)
		pixiTextContainer.anchor.set(0.5)
		super("text", name, parent, pixiTextContainer)

		this._textStyle = textStyle
	}

	setText(text) {
		// Temporary
		let actualText = text
		let hasAppliedSpecialStyle = false
		if (text.length >= 6) {
			if ((text[0] === "_" && text[1] === "_" && text[2] === "_"
				&& text[text.length - 3] === "_" && text[text.length - 2] === "_" && text[text.length - 1] === "_")
				|| (text[0] === "_" && text[1] === "*" && text[2] === "*"
					&& text[text.length - 3] === "*" && text[text.length - 2] === "*" && text[text.length - 1] === "_")) {
				this._textStyle.fontWeight = "bold"
				this._textStyle.fontStyle = "italic"
				this._pixiContainer._style.fontWeight = "bold"
				this._pixiContainer._style.fontStyle = "italic"
				actualText = text.substr(3, text.length - 6)
				hasAppliedSpecialStyle = true
			}
		}
		if (hasAppliedSpecialStyle === false && text.length >= 4) {
			if ((text[0] === "*" && text[1] === "*" && text[text.length - 2] === "*" && text[text.length - 1] === "*")
				|| (text[0] === "_" && text[1] === "_" && text[text.length - 2] === "_" && text[text.length - 1] === "_")) {
				this._textStyle.fontWeight = "bold"
				this._pixiContainer._style.fontWeight = "bold"
				actualText = text.substr(2, text.length - 4)
				hasAppliedSpecialStyle = true
			}
		}
		if (hasAppliedSpecialStyle === false && text.length >= 2) {
			if ((text[0] === "*" && text[text.length - 1] === "*")
				|| (text[0] === "_" && text[text.length - 1] === "_")) {
				this._textStyle.fontStyle = "italic"
				this._pixiContainer._style.fontStyle = "italic"
				actualText = text.substr(1, text.length - 2)
			}
		}
		this._pixiContainer.text = actualText
	}

	getTextMetrics() {
		const actualTextStyle = new PixiTextStyle(this._textStyle)
		const textMetrics = PixiTextMetrics.measureText(this._pixiContainer.text, actualTextStyle)
		return textMetrics
	}

	destroy() {
		this._pixiContainer.destroy({ children: true, texture: true, baseTexture: true })
		this.removeFromParent()
	}

}