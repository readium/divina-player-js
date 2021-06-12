import { Application as PixiApplication, utils as PixiUtils } from "pixi.js-legacy"

import Container from "./Container"

import * as Utils from "../../utils"

export default class Renderer {

	// Used in Player

	get mainContainer() { return this._contentContainer }

	get size() {
		const { width, height } = this._app.renderer
		return { width: width / this._pixelRatio, height: height / this._pixelRatio }
	}

	constructor(rootElement, backgroundColor = null) {

		this._pixelRatio = (window.devicePixelRatio || 1)

		// Create the Pixi application with a default background color
		const options = {
			transparent: (backgroundColor === "transparent"),
			resolution: this._pixelRatio,
			autoDensity: true,
			antialias: true,
		}

		if (options.transparent !== true) {
			const shouldReturnDefaultValue = true
			const defaultBackgroundColor = Utils.returnValidValue("backgroundColor", backgroundColor,
				shouldReturnDefaultValue)
			const defaultColor = Utils.convertColorStringToNumber(defaultBackgroundColor)
			options.backgroundColor = backgroundColor || defaultColor
		}
		this._app = new PixiApplication(options)

		// Add the Pixi app's canvas to the DOM
		rootElement.appendChild(this._app.view)

		// Create the root container
		const parent = null
		this._rootContainer = new Container("root", "root", parent, this._app.stage)

		// Create the container that will hold content (i.e. the current pageNavigator's pages)
		this._contentContainer = new Container("content", "content", this._rootContainer)

		this._zoomFactor = 1
		this._viewportRect = {}
	}

	// Used in Player on a resize
	setSize(width, height) {
		if (width === this.size.width && height === this.size.height) {
			return
		}

		// Resize the canvas using Pixi's built-in function
		this._app.renderer.resize(width, height)
		this._app.render() // To avoid flickering
	}

	// Used in Player as a consequence of a zoomFactor change or on a resize
	updateDisplay(zoomFactor, viewportRect) {
		this._zoomFactor = zoomFactor
		this._viewportRect = viewportRect

		const {
			x, y, width, height,
		} = this._viewportRect

		// Update the pivot used to center containers by default
		this._contentContainer.setPivot({
			x: -x - width / 2,
			y: -y - height / 2,
		})

		const rendererWidth = this.size.width
		const rendererHeight = this.size.height
		const actualWidth = Math.min(viewportRect.width * zoomFactor, rendererWidth)
		const actualHeight = Math.min(viewportRect.height * zoomFactor, rendererHeight)
		const actualX = (rendererWidth - actualWidth) / 2
		const actualY = (rendererHeight - actualHeight) / 2
		this._maskRect = {
			x: actualX,
			y: actualY,
			width: actualWidth,
			height: actualHeight,
		}
		this.applyMask()
	}

	applyMask() {
		if (this._mask || !this._maskRect) {
			return
		}
		const {
			x, y, width, height,
		} = this._maskRect
		this._rootContainer.setMaskRect(x, y, width, height)
	}

	applyViewportConstraints() {
		// Add a global mask (used to express viewportRatio constraints if specified)
		this._rootContainer.addMask()
		// Apply mask
		this.applyMask()
	}

	// Used in Player
	destroy() {
		this._rootContainer = null
		this._contentContainer = null

		this._app.view.remove()

		const shouldRemoveView = true
		this._app.destroy(shouldRemoveView)
		this._app = null

		PixiUtils.clearTextureCache()
	}

}