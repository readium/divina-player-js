import {
	autoDetectRenderer,
	Application as PixiApplication,
	Container as PixiContainer,
	utils as PixiUtils,
} from "pixi.js-legacy"

import Loop from "./Loop"
import Container from "./Container"

import * as Utils from "../../utils"

const RENDERING_MODE = "renderer" // Possibilities; "app" | renderer"

export default class Renderer {

	// Used in Player

	get mainContainer() { return this._contentContainer }

	get size() {
		const { width, height } = this._renderer
		return { width: width / this._pixelRatio, height: height / this._pixelRatio }
	}

	constructor(rootElement, backgroundColor = null, player) {
		this._player = player

		this._pixelRatio = (window.devicePixelRatio || 1)

		// Create the Pixi application with a default background color
		const options = {
			transparent: (backgroundColor === "transparent"), // The PixiJS documentation is wrong!
			resolution: this._pixelRatio,
			autoDensity: true,
			antialias: true,
		}

		if (backgroundColor !== "transparent") {
			const shouldReturnDefaultValue = true
			let color = Utils.returnValidValue("backgroundColor", backgroundColor,
				shouldReturnDefaultValue)
			color = Utils.convertColorStringToNumber(color)
			options.backgroundColor = color
		}
		if (RENDERING_MODE === "app") {
			this._app = new PixiApplication(options)
			this._renderer = this._app.renderer
			this._stage = this._app.stage
		} else {
			this._renderer = autoDetectRenderer(options)

			this._stage = new PixiContainer()
			this._stage.interactive = false
			this._stage.interactiveChildren = false

			// Create the renderer's loop
			this._renderFunction = () => {
				if (!this._renderer) {
					return
				}
				this._renderer.render(this._stage)
			}
			this._loop = new Loop(this._renderFunction)
		}

		// Add the Pixi app's canvas to the DOM
		rootElement.appendChild(this._renderer.view)

		// Create the root container
		const parent = null
		this._rootContainer = new Container("root", "root", parent, this._stage)

		// Create the container that will hold content (i.e. the current pageNavigator's pages)
		this._contentContainer = new Container("content", "content", this._rootContainer)

		this._zoomFactor = 1
		this._viewportRect = {}
	}

	refreshOnce() {
		if (!this._loop) {
			return
		}
		this._loop.setDirty(true)
	}

	// Used in Player on a resize
	setSize(width, height) {
		if (width === this.size.width && height === this.size.height) {
			return
		}

		// Resize the canvas using Pixi's built-in function
		this._renderer.resize(width, height)
		if (RENDERING_MODE === "app") {
			this._app.render() // To avoid flickering
		} else {
			this._renderFunction() // To avoid flickering (better than calling the Loop)
		}
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
		if (this._loop) {
			this._loop.destroy()
			this._loop = null
		}

		if (RENDERING_MODE === "app") {
			this._app.view.remove()

			const shouldRemoveView = true
			this._app.destroy(shouldRemoveView)
			this._app = null

		} else {
			this._stage.destroy(true)

			const shouldRemoveView = true
			this._renderer.destroy(shouldRemoveView)
			this._renderer = null
		}

		this._rootContainer = null
		this._contentContainer = null

		PixiUtils.clearTextureCache()
	}

}