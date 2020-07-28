import { Application as PIXIApplication } from "pixi.js-legacy"

import Container from "./Container"

export default class Renderer {

	// Used in Player

	get mainContainer() { return this._contentContainer }

	get size() {
		const { width, height } = this._app.renderer
		return { width, height }
	}

	constructor(rootElement, backgroundColor) {

		// Create the PIXI application with a default background color
		this._app = new PIXIApplication({
			backgroundColor,
			resolution: 1,
			autoDensity: true,
		})

		// Add the PIXI app's canvas to the DOM
		rootElement.appendChild(this._app.view)

		// Create root container
		const parent = null
		this._rootContainer = new Container("stage", parent, this._app.stage)

		// Create the container that will hold content (i.e. the current pageNavigator's pages)
		this._contentContainer = new Container("content", this._rootContainer)

		// Add a global mask (which will be used to express viewportRatio constraints)
		this._rootContainer.addMask()
	}

	// Used in Player on a resize
	setSize(width, height) {
		// Resize the canvas using PIXI's built-in function
		this._app.renderer.resize(width, height)
		this._app.render() // To avoid flickering
	}

	// Used in Player on a resize or as a consequence of a zoomFactor change
	updateDisplay(viewportRect, zoomFactor = 1) {
		const { width, height } = this.size
		const actualWidth = Math.min(Math.max(viewportRect.width * zoomFactor, 0), width)
		const actualHeight = Math.min(Math.max(viewportRect.height * zoomFactor, 0), height)
		const x = (width - actualWidth) / 2
		const y = (height - actualHeight) / 2
		this._rootContainer.setMaskRect(x, y, actualWidth, actualHeight)

		// Update the pivot used to center containers by default
		this._contentContainer.setPivot({
			x: -width / 2,
			y: -height / 2,
		})
	}

	// Used in Player
	destroy() {
		this._rootContainer = null
		this._contentContainer = null

		this._app.view.remove()

		const shouldRemoveView = true
		this._app.destroy(shouldRemoveView)
		this._app = null
	}

}