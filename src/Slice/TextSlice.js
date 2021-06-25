import Slice from "./Slice"
import { TextElement } from "../Renderer"

import * as Utils from "../utils"

export default class TextSlice extends Slice {

	constructor(resourceInfoArray, textOptions, properties, player, parentInfo = null) {
		super([], properties, player, parentInfo)

		this._textOptions = textOptions

		this._resourceInfoArray = resourceInfoArray // Which is a textVersionsArray

		const { backgroundColor } = textOptions
		if (backgroundColor) {
			this._setBackgroundColor(backgroundColor)
		}

		this._text = null
		this._textElement = null
	}

	resize() {
		const oldSize = this.size
		super.resize()
		this._applySizeClip()
		if (!this._textElement || (this.hasVariableSize === true // At least one dimension is not fixed
			&& (this.size.width !== oldSize.width || this.size.height !== oldSize.height))) {
			this._createAndPositionTextElement()
		}
	}

	_createAndPositionTextElement() {
		if (this._textElement) {
			this._textElement.destroy()
		}
		this._textElement = new TextElement("text", this, this._textOptions)
		if (!this._text) {
			return
		}
		this._textElement.setText(this._text)

		const { boundingRect } = this._textElement
		const { width, height } = boundingRect
		const position = {
			x: (width - this._width) / 2,
			y: (height - this._height) / 2,
		}

		const { rect, hAlign, vAlign } = this._textOptions
		if (rect) {
			const shouldLimitSize = false
			const actualRect = Utils.getRectWithSize(rect, this.size, shouldLimitSize)
			if (actualRect) {
				const {
					x, y, w, h,
				} = actualRect
				position.x += x
				if (hAlign !== "left") {
					const delta = w - width
					if (hAlign === "center") {
						position.x += delta / 2
					} else if (hAlign === "right") {
						position.x += delta
					}
				}
				position.y += y
				if (vAlign !== "top") {
					const delta = h - height
					if (vAlign === "center") {
						position.y += delta / 2
					} else if (vAlign === "bottom") {
						position.y += delta
					}
				}
			}
		} else {
			if (hAlign === "center") {
				position.x = 0
			} else if (hAlign === "right") {
				position.x = (this._width - width) / 2
			}
			if (vAlign === "center") {
				position.y = 0
			} else if (vAlign === "bottom") {
				position.y = (this._height - height) / 2
			}
		}

		// Layer child slices need to be offset
		if (this._role === "layersChild" && this._parentInfo) {
			const parentSlice = this._parentInfo.slice
			const { unscaledSize } = parentSlice
			position.x -= (this._width / 2) * (unscaledSize.width / this._width - 1)
			position.y -= (this._height / 2) * (unscaledSize.height / this._height - 1)
		}

		this._textElement.setPosition(position)
	}

	setLanguage(language) {
		const text = this._getRelevantText(language)
		if (this._text === text) {
			return
		}
		this._text = text
		this._createAndPositionTextElement()
	}

	_getRelevantText(language) {
		let { text } = this._resourceInfoArray[0]
		if (!this._resourceInfoArray || this._resourceInfoArray.length < 1) {
			return text
		}
		this._resourceInfoArray.forEach((textVersion) => {
			if (textVersion.language === language) {
				text = textVersion.text
			}
		})
		return text
	}

	destroy() {
		if (this._textElement) {
			this._textElement.destroy()
		}
		super.destroy()
	}

}