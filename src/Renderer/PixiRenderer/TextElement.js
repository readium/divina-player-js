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
		// New method
		//actualText = actualText.replace(/<em>(.+)<\/em>/g, "<i>$1</i>")
		//actualText = actualText.replace(/<strong>(.+)<\/strong>/g, "<b>$1</b>")
		//actualText = actualText.replace(/[\*\_]{2}([^\*\_]+)[\*\_]{2}/g, "<b>$1</b>")
		//actualText = actualText.replace(/[\*\_]{1}([^\*\_]+)[\*\_]{1}/g, "<i>$1</i>")
		this._pixiContainer.text = actualText

		// New algo
		const lookupAndSplit = (string, lookupStringsArray, isNewWord, isNewLine, isBold, isItalic,
			resultsArray) => {
			let firstIndex = null
			let firstLookupString = null
			lookupStringsArray.forEach((lookupString) => {
				const index = string.indexOf(lookupString)
				if (index !== -1) {
					if (firstIndex === null || index < firstIndex) {
						firstIndex = index
						firstLookupString = lookupString
					}
				}
			})
			if (firstIndex !== null) {
				const substring = string.substring(0, firstIndex)
				const nextString = string.substring(firstIndex + firstLookupString.length)
				if (substring.length > 0) {
					const newSub = { substring }
					if (isNewWord === true) {
						newSub.isNewWord = true
					}
					if (isNewLine === true) {
						newSub.isNewLine = true
					}
					if (isBold === true) {
						newSub.isBold = true
					}
					if (isItalic === true) {
						newSub.isItalic = true
					}
					resultsArray.push(newSub)
					isNewWord = false
					isNewLine = false
				}

				switch (firstLookupString) {
				case " ":
					isNewWord = true
					break
				case "\n":
				case "<br>":
					isNewLine = true
					break
				/*case "***":
				case "_**":
				case "___":
					bold = true
					italic = true
					break
				case "***":
				case "_**":
				case "___":
					bold = true
					italic = true
					break*/
				case "**":
				case "__":
					isBold = !isBold
					break
				case "*":
				case "_":
					isItalic = !isItalic
					break
				case "<b>":
				case "<strong>":
					isBold = true
					break
				case "</b>":
				case "</strong>":
					isBold = false // Only if was true and because of an opening tag!
					break
				case "<i>":
				case "<em>":
					isItalic = true
					break
				case "</i>":
				case "</em>":
					isItalic = false // Only if was true and because of an opening tag!
					break
				default:
					break
				}
				return lookupAndSplit(nextString, lookupStringsArray, isNewWord, isNewLine, isBold, isItalic, resultsArray)
			}
			return resultsArray
		}

		const lookupStringsArray = [" ", "\n", "<br>", "**", "__", "*", "_"] // "_**" will have precedence over "_"
		//const resultsArray = lookupAndSplit(text, lookupStringsArray, false, false, false, false, [])
		//console.log(resultsArray)
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