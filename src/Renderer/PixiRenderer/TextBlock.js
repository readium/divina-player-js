import { TextStyle as PixiTextStyle, Text as PixiTextContainer } from "pixi.js-legacy"

import Container from "./Container"

export default class TextBlock extends Container {

	constructor(name, parent, text, textStyle, rect, lineWidth, boundingRect) {
		const finalStyle = new PixiTextStyle(textStyle)
		const pixiTextContainer = new PixiTextContainer("", finalStyle)
		pixiTextContainer.anchor.set(0.5)
		pixiTextContainer.text = text
		super("text", name, parent, pixiTextContainer)

		this._rect = rect
		this._lineWidth = lineWidth
		this._boundingRect = boundingRect

		const { align } = textStyle
		this._hAlign = align
	}

	setReferencePosition(position) {
		const actualPosition = { // "left"
			x: position.x - this._boundingRect.width / 2 + this._rect.x + this._rect.width / 2,
			y: position.y - this._boundingRect.height / 2 + this._rect.y + this._rect.height / 2,
		}

		if (this._hAlign === "center" && this._lineWidth < this._boundingRect.width) {
			actualPosition.x += (this._boundingRect.width - this._lineWidth) / 2
		} else if (this._hAlign === "right" && this._lineWidth < this._boundingRect.width) {
			actualPosition.x += this._boundingRect.width - this._lineWidth
		}

		this.setPosition(actualPosition)
	}

	destroy() {
		this.pixiContainer.destroy({ children: true, texture: true, baseTexture: true })
		this.removeFromParent()
	}

}