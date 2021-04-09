import { Container } from "../Renderer"
import StateHandler from "./StateHandler"
import OverflowHandler from "./OverflowHandler"

export default class LayerPile extends Container {

	// Used in PageNavigator and below
	get layersArray() { return this._layersArray }

	// Used below

	get activeLayersArray() {
		return this._layersArray.filter((layer) => (layer.isActive === true))
	}

	get isAtStart() { return (this._handler) ? this._handler.isAtStart : true }

	get isAtEnd() { return (this._handler) ? this._handler.isAtEnd : true }

	get isUndergoingChanges() { return (this._handler) ? this._handler.isUndergoingChanges : false }

	// Note that isAtStart, isAtEnd and isUndergoingChanges are not recursive!

	get resourcePath() { // Return the resourcePath of the first slice if there is one
		if (this._layersArray.length === 0 || !this._layersArray[0]) {
			return null
		}
		return this._layersArray[0].resourcePath
	}

	get size() { // Note that Page overrides this function

		// If a Segment with multiple layers
		if (this._parentSlice) {
			return this._parentSlice.size
		}

		if (this._layersArray.length > 0) {
			return this._layersArray[0].size
		}

		// All cases must have been covered already, but just in case
		return { width: 0, height: 0 }
	}

	// Used in Layer
	get loadStatus() { return this._loadStatus }

	constructor(type, name, parent = null, layersArray = [], isFirstSliceAParentSlice = false) {
		super(type, name, parent)

		this._name = name
		this._parent = parent

		// Build layers
		this._layersArray = []
		// Note that the parent slice is added too, although its texture will be hidden
		if (layersArray) {
			layersArray.forEach((layer) => {
				this._addLayer(layer)
				layer.setParent(this)
			})
		}

		const parentSliceLayer = (isFirstSliceAParentSlice === true && layersArray.length > 0)
			? layersArray[0]
			: null
		this._parentSlice = (parentSliceLayer) ? parentSliceLayer.content : null

		this._loadStatus = 0

		this._handler = null
	}

	_addLayer(layer) {
		this._layersArray.push(layer)
	}

	getDepthOfNewLayer() {
		return this._depth
	}

	_addStateHandler(shouldStateLayersCoexistOutsideTransitions, player) {
		this._handler = new StateHandler(this, shouldStateLayersCoexistOutsideTransitions,
			player)
	}

	_addOverflowHandler(overflow, hAlign, vAlign, player) {
		this._handler = new OverflowHandler(this, overflow, hAlign, vAlign, player)
	}

	getLayerAtIndex(layerIndex) {
		if (this._layersArray.length === 0
			|| layerIndex < 0 || layerIndex >= this._layersArray.length) {
			return null
		}
		const layer = this._layersArray[layerIndex]
		return layer
	}

	// Following a discontinuous gesture

	attemptToGoForward(shouldSkipTransition = false, doIfIsUndergoingChanges = null) {
		// If a change is under way, end it
		if (this._handler && this.isUndergoingChanges === true) {
			return (this._handler.attemptToGoForward(shouldSkipTransition,
				doIfIsUndergoingChanges) === true)
		}
		// If not, try to go forward in the first layer (child)
		if (this.activeLayersArray.length > 0) {
			const layer = this.activeLayersArray[0]
			if (layer.attemptToGoForward(shouldSkipTransition, doIfIsUndergoingChanges) === true) {
				return true
			}
		}
		// Otherwise try go forward via the handler if there is one
		return (this._handler
			&& this._handler.attemptToGoForward(shouldSkipTransition, doIfIsUndergoingChanges) === true)
	}

	attemptToGoBackward(shouldSkipTransition = false, doIfIsUndergoingChanges = null) {
		// If a change is under way, end it then go backward
		if (this._handler && this.isUndergoingChanges === true) {
			return (this._handler.attemptToGoBackward(shouldSkipTransition,
				doIfIsUndergoingChanges) === true)
		}
		// If not, try to go backward in the last layer (child)
		if (this.activeLayersArray.length > 0) {
			const layer = this.activeLayersArray[this.activeLayersArray.length - 1]
			if (layer.attemptToGoBackward(shouldSkipTransition, doIfIsUndergoingChanges) === true) {
				return true
			}
		}
		// Otherwise try go backward via the handler if there is one
		return (this._handler
			&& this._handler.attemptToGoBackward(shouldSkipTransition,
				doIfIsUndergoingChanges) === true)
	}

	attemptToGoSideways(way) {
		if (this.isUndergoingChanges === true) {
			return true
		}
		if (this.activeLayersArray.length > 0) {
			const layer = this.activeLayersArray[this.activeLayersArray.length - 1]
			if (layer.attemptToGoSideways(way) === true) {
				return true
			}
		}
		return (this._handler && this._handler.attemptToGoSideways
			&& this._handler.attemptToGoSideways(way) === true)
	}

	// Following a continuous gesture

	handleScroll(scrollData, isWheelScroll) {
		if (!this._handler) {
			return false
		}
		if (this._handler.type === "overflowHandler"
			&& this._handler.handleScroll(scrollData, isWheelScroll) === true) {
			return true
		}
		if (this._handler.type === "stateHandler"
			&& this._handler.handleScroll(scrollData, isWheelScroll) === true) {
			return true
		}
		return false
	}

	endControlledTransition(viewportPercent, shouldBeAnimated = true) {
		if (!this._handler) {
			return false
		}

		if (this._handler.type === "overflowHandler") {
			if (this._layersArray.length === 1) {
				const layer = this._layersArray[0] // Check only the first Segment in a Page
				const { content } = layer
				if (content.endControlledTransition(viewportPercent, shouldBeAnimated) === true) {
					return true
				}
			}
		}

		return (this._handler.type === "stateHandler"
			&& this._handler.endControlledTransition(viewportPercent, shouldBeAnimated) === true)
	}

	resize() {
		this.activeLayersArray.forEach((layer) => layer.resize())
		this._resizeMyself()
	}

	_resizeMyself() {
		if (this._parentSlice) { // If this is a Segment with multiple layers
			this._parentSlice.resize()
			this._layersArray.forEach((layer) => { layer.setScale(this._parentSlice.scale) })
		}
		if (this._handler && this._handler.resize) {
			this._handler.resize()
		}
	}

	setupForEntry(isGoingForward = true) {
		this._layersArray.forEach((layer) => {
			// If the LayerPile is a Segment with a unique Slice (or a basic LayerPile)
			if (!this._handler) {
				const slice = layer.content
				this.addChild(slice)
			}
			layer.setupForEntry(isGoingForward)
		})

		this._resizeMyself()

		// If the LayerPile has a StateHandler (i.e. it is a PageNavigator or a multi-layered
		// Segment with layer transitions) or an OverflowHandler (i.e. it is a Page)
		if (this._handler) {
			this._handler.setupForEntry(isGoingForward)
		}
	}

	finalizeEntry() {
		this.activeLayersArray.forEach((layer) => { layer.finalizeEntry() })
	}

	finalizeExit() {
		this.activeLayersArray.forEach((layer) => { layer.finalizeExit() })

		// If a Segment with multiple states
		if (this._handler && this._handler.type === "stateHandler") {
			this._handler.finalizeExit()
		}
	}

	getResourceIdsToLoad(recursive, force) {
		const resourceIdsArray = []
		this._layersArray.forEach((layer) => {
			const idsArray = layer.getResourceIdsToLoad(recursive, force)
			resourceIdsArray.push(...idsArray)
		})
		return resourceIdsArray
	}

	destroyResourcesIfPossible() {
		this._layersArray.forEach((layer) => { layer.destroyResourcesIfPossible() })
	}

	// Used in Layer (in a Segment, the first layer only will be considered)
	getHref() {
		if (this._layersArray.length < 1 || !this._layersArray[0].getHref) {
			return null
		}
		return this._layersArray[0].getHref()
	}

	// Slice functions

	resizePage() {
		if (!this._parent || !this._parent.resizePage) {
			return
		}
		this._parent.resizePage()
	}

	updateLoadStatus() {
		const oldLoadStatus = this._loadStatus

		let nbOfLoadedLayers = 0
		let hasAtLeastOneLoadingLayer = false
		let hasAtLeastOnePartiallyLoadedLayer = false

		this._layersArray.forEach((layer) => {
			if (hasAtLeastOneLoadingLayer === false
				&& hasAtLeastOnePartiallyLoadedLayer === false) {
				const { loadStatus } = layer
				switch (loadStatus) {
				case 2:
					nbOfLoadedLayers += 1
					break
				case 1:
					hasAtLeastOneLoadingLayer = true
					break
				case -1:
					hasAtLeastOnePartiallyLoadedLayer = true
					break
				default:
					break
				}
			}
		})
		if (hasAtLeastOnePartiallyLoadedLayer === true
			|| (nbOfLoadedLayers > 0 && nbOfLoadedLayers < this._layersArray.length)) {
			this._loadStatus = -1
		} else if (hasAtLeastOneLoadingLayer === true) {
			this._loadStatus = 1
		} else if (nbOfLoadedLayers > 0 && nbOfLoadedLayers === this._layersArray.length) {
			this._loadStatus = 2
		} else {
			this._loadStatus = 0
		}

		if (this._loadStatus !== oldLoadStatus && this._parent
			&& this._parent.updateLoadStatus) {
			this._parent.updateLoadStatus()
		}
	}

}