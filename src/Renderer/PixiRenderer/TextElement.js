import { TextStyle as PixiTextStyle, TextMetrics as PixiTextMetrics } from "pixi.js-legacy"

import TextBlock from "./TextBlock"

import * as constants from "../../constants"

export default class TextElement {

	get boundingRect() { return this._boundingRect }

	constructor(name, parent, textOptions = {}) {
		this._name = name
		this._parent = parent

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
			wordWrapWidth: undefined, // undefined is better than 0 (e.g. for TextManager)
			align: hAlign,
			letterSpacing: Math.min(letterSpacing || 0, constants.MAX_LETTER_SPACING),
		}
		let maxWidth = unscaledSize.width
		if (rect) {
			maxWidth = (rect.unit === "%")
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

		this._maxWidth = maxWidth
		this._textStyle = textStyle
		this._boundingRect = { width: 0, height: 0 }

		this._text = null
		this._textBlocksArray = []
	}

	setText(text) {
		if (this._text === text) {
			return
		}
		this.destroy()
		this._text = text

		// 1. Split the initial text string in substrings separated by specific lookup strings

		// Items in lookupStringsArray are ordered in a way that favors complex tags/markdown
		const lookupStringsArray = [
			" ",
			"\\*", "\\_",
			"\n", "<br>", "<br/>", "<br />",
			"***", "_**", "___", "**_",
			"**", "__", "<b>", "</b>", "<strong>", "</strong>",
			"*", "_", "<i>", "</i>", "<em>", "</em>",
		]
		const currentStyles = {}
		const resultsArray = TextElement._lookupAndSplit(text, lookupStringsArray, false, currentStyles,
			[])

		// 2. Compute text metrics for each substring (i.e. the dimensions of bounding rectangles)

		const linesArray = []
		let currentLine = []
		let currentLineWidth = 0
		let nbOfSpaces = 0

		resultsArray.forEach((substring) => {
			const {
				string, isNewLine, isBold, isItalic,
			} = substring

			if (string === " " && isNewLine === false) {
				nbOfSpaces += 1 // All spaces have the same size, whatever their isBold or isItalic

			} else {
				let actualString = ""
				for (let i = 0; i < nbOfSpaces; i += 1) {
					actualString += " "
				}
				actualString += string

				let actualTextStyle = { ...this._textStyle }
				if (isBold === true) {
					actualTextStyle.fontWeight = "bold"
				}
				if (isItalic === true) {
					actualTextStyle.fontStyle = "italic"
				}
				actualTextStyle = new PixiTextStyle(actualTextStyle)

				// IMPORTANT NOTE: PixiJS does not measure spaces at the end of a string,
				// but does include the measure of those at the start!
				let textMetrics = PixiTextMetrics.measureText(actualString, actualTextStyle)

				if (isNewLine === true
					|| (this._maxWidth && currentLineWidth + textMetrics.width > this._maxWidth)) {
					currentLine.width = currentLineWidth
					linesArray.push(currentLine)
					currentLine = []
					currentLineWidth = 0

					// Get rid of spaces
					actualString = string
					textMetrics = PixiTextMetrics.measureText(string, actualTextStyle)
				}

				substring.string = actualString
				substring.textMetrics = textMetrics
				currentLine.push(substring)
				currentLineWidth += textMetrics.width

				nbOfSpaces = 0
			}
		})

		// Last line
		if (currentLine.length > 0) {
			currentLine.width = currentLineWidth
			linesArray.push(currentLine)
		}

		// 3. Merge substrings by style within a line

		const styledLines = []
		let styledLine = []
		let styledText = ""
		let left = 0
		let blockWidth = 0
		let currentStyle = null
		let lineHeight = 0
		let maxLineWidth = 0

		linesArray.forEach((line) => {
			styledLine = []
			styledText = ""
			left = 0
			blockWidth = 0
			line.forEach(({
				string, isBold, isItalic, textMetrics,
			}) => {
				if (!lineHeight) {
					lineHeight = Math.max(textMetrics.height, textMetrics.lineHeight)
				}
				if (!currentStyle) {
					currentStyle = { isBold, isItalic }

				// If the style changes, store merged substrings
				} else if (currentStyle.isBold !== isBold || currentStyle.isItalic !== isItalic) {

					if (styledText.length > 0) {

						// Apply style
						const finalStyle = { ...this._textStyle }
						if (currentStyle.isBold === true) {
							finalStyle.fontWeight = "bold"
						}
						if (currentStyle.isItalic === true) {
							finalStyle.fontStyle = "italic"
						}

						// Store text (blocks)
						let actualBlockWidth = blockWidth
						if (string.charAt(0) === " ") {
							actualBlockWidth += this._textStyle.letterSpacing
						}
						styledLine.push({
							text: styledText, style: finalStyle, left, width: actualBlockWidth,
						})
						left += actualBlockWidth
					}
					styledText = ""
					currentStyle = { isBold, isItalic }
					blockWidth = 0
				}

				styledText += string
				blockWidth += textMetrics.width + this._textStyle.letterSpacing
			})
			// Last block
			if (styledText.length > 0) {
				const finalStyle = { ...this._textStyle }
				if (currentStyle.isBold === true) {
					finalStyle.fontWeight = "bold"
				}
				if (currentStyle.isItalic === true) {
					finalStyle.fontStyle = "italic"
				}
				styledLine.push({
					text: styledText, style: finalStyle, left, width: blockWidth,
				})
			}
			styledLine.width = left + blockWidth
			if (!maxLineWidth || maxLineWidth < styledLine.width) {
				maxLineWidth = styledLine.width
			}
			styledLines.push(styledLine)
		})

		this._boundingRect = { width: maxLineWidth, height: lineHeight * styledLines.length }

		// 4. Create and all text blocks

		styledLines.forEach((line, i) => {
			line.forEach((lineItem) => {
				const rect = { // Relative inside boundingRect? Depends on align!
					x: lineItem.left, y: i * lineHeight, width: lineItem.width, height: lineHeight,
				}
				const textBlock = new TextBlock(this._name, this._parent, lineItem.text, lineItem.style,
					rect, line.width, this._boundingRect)
				this._textBlocksArray.push(textBlock)
			})
		})
	}

	static _lookupAndSplit(string, lookupStringsArray, isNewLine, currentStyles, resultsArray) {
		let newResultsArray = [...resultsArray]
		let firstIndex = null
		let firstLookupString = null

		// Look up for specific characters/strings respecting priorities
		lookupStringsArray.forEach((lookupString) => {
			const index = string.indexOf(lookupString)
			if (index !== -1 && (firstIndex === null || index < firstIndex)) {
				firstIndex = index
				firstLookupString = lookupString
			}
		})

		if (firstIndex !== null) {
			let substring = string.substring(0, firstIndex)
			if (firstLookupString === "\\*") {
				substring += "*"
			} else if (firstLookupString === "\\_") {
				substring += "_"
			}
			newResultsArray = TextElement._addSubstring(substring, isNewLine, currentStyles,
				newResultsArray)
			isNewLine = false

			if (firstLookupString === " ") {
				newResultsArray = TextElement._addSubstring(" ", isNewLine, currentStyles, newResultsArray)
			}

			switch (firstLookupString) {
			case "\n":
			case "<br>":
			case "<br/>":
			case "<br />":
				isNewLine = true
				break
			case "***":
				currentStyles.tripleStar = !currentStyles.tripleStar
				break
			case "___":
				currentStyles.tripleUnderscore = !currentStyles.tripleUnderscore
				break
			case "_**":
				currentStyles.tripleCompound = true
				break
			case "**_":
				currentStyles.tripleCompound = false
				break
			case "**":
				currentStyles.doubleStar = !currentStyles.doubleStar
				break
			case "__":
				currentStyles.doubleUnderscore = !currentStyles.doubleUnderscore
				break
			case "*":
				currentStyles.singleStar = !currentStyles.singleStar
				break
			case "_":
				currentStyles.singleUnderscore = !currentStyles.singleUnderscore
				break
			case "<b>":
				currentStyles.b = true
				break
			case "</b>":
				currentStyles.b = false
				break
			case "<strong>":
				currentStyles.strong = true
				break
			case "</strong>":
				currentStyles.strong = false
				break
			case "<i>":
				currentStyles.i = true
				break
			case "</i>":
				currentStyles.i = false
				break
			case "<em>":
				currentStyles.em = true
				break
			case "</em>":
				currentStyles.em = false
				break
			default: // Including "\\*" and "\\_"
				break
			}

			const nextString = string.substring(firstIndex + firstLookupString.length)
			newResultsArray = TextElement._lookupAndSplit(nextString, lookupStringsArray,
				isNewLine, currentStyles, newResultsArray)
			return newResultsArray
		}

		newResultsArray = TextElement._addSubstring(string, isNewLine, currentStyles, newResultsArray)
		return newResultsArray
	}

	static _addSubstring(string, isNewLine, currentStyles, resultsArray) {
		if (string.length === 0 && isNewLine === false) { // i.e. if a space (not a line break)
			return resultsArray
		}
		let isBold = false
		let isItalic = false
		Object.entries(currentStyles).forEach(([style, value]) => {
			if (value === true) {
				if (style === "tripleStar" || style === "tripleUnderscore" || style === "tripleCompound"
					|| style === "doubleStar" || style === "doubleUnderscore"
					|| style === "b" || style === "strong") {
					isBold = true
				}
				if (style === "tripleStar" || style === "tripleUnderscore" || style === "tripleCompound"
					|| style === "singleStar" || style === "singleUnderscore"
					|| style === "i" || style === "em") {
					isItalic = true
				}
			}
		})
		const newSubstring = {
			string, isNewLine, isBold, isItalic,
		}
		const newResultsArray = [...resultsArray, newSubstring]
		return newResultsArray
	}

	setPosition(position) {
		this._textBlocksArray.forEach((textBlock) => {
			textBlock.setReferencePosition(position)
		})
	}

	destroy() {
		this._textBlocksArray.forEach((textBlock) => {
			textBlock.destroy()
		})
		this._textBlocksArray = []
	}

}