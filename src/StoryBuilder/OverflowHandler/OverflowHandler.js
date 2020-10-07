import Camera from "./Camera"

export default class OverflowHandler {

	get type() { return this._type }

	// Used in LayerPile

	get activeLayersArray() { return (this._layerPile) ? this._layerPile.layersArray : [] }

	get isAtStart() { return (this._camera) ? this._camera.isAtStart : true }

	get isAtEnd() { return (this._camera) ? this._camera.isAtEnd : true }

	get isUndergoingChanges() { return (this._camera.isAutoScrolling === true) }

	get inScrollDirection() { return this._inScrollDirection }

	// Constructor

	constructor(layerPile, overflow, player) {
		this._layerPile = layerPile

		// An overflowHandler necessarily has a camera
		this._camera = new Camera(layerPile, overflow, player)

		this._type = "overflowHandler"

		this._inScrollDirection = null
	}

	setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection
		this._camera.setInScrollDirection(inScrollDirection)
		this.resize() // Will reposition segments
	}

	// Functions linked to segments

	// Add snap points to the last segment - since we are still in the process of adding segments
	addSnapPointsForLastSegment(snapPointsArray) {
		const segmentsArray = this._layerPile.layersArray.map((layer) => (layer.content))
		if (segmentsArray.length === 0) {
			return
		}
		const lastSegmentIndex = segmentsArray.length - 1
		this._camera.addSnapPoints(snapPointsArray, lastSegmentIndex)
	}

	goToSegmentIndex(segmentIndex, isGoingForward) {
		this._camera.moveToSegmentIndex(segmentIndex, isGoingForward)
	}

	setupForEntry(isGoingForward) {
		if (this._camera.isZoomed === true) { // Should never hapen
			return
		}
		this._camera.moveToStartOrEnd(isGoingForward)
	}

	// Functions linked to LayerPile

	attemptToGoForward(shouldGoInstantly = false) { // Step forward
		if (this._camera.isZoomed === true) { // Block all interactions
			return true
		}
		if (this._camera.isAtEnd === true) {
			return false
		}

		this._camera.moveToNextSnapPoint(shouldGoInstantly)
		return true
	}

	attemptToGoBackward(shouldGoInstantly = false) { // Step backward
		if (this._camera.isZoomed === true) { // Block all interactions
			return true
		}
		if (this._camera.isAtStart === true) {
			return false
		}
		this._camera.moveToPreviousSnapPoint(shouldGoInstantly)
		return true
	}

	// Functions to deal with continuous gestures and zoom

	handleScroll(scrollData, isWheelScroll) {
		if (this.activeLayersArray.length === 1) {
			const layer = this.activeLayersArray[0] // Check only the first Segment in a Page
			const { content } = layer
			if (content.handleScroll(scrollData, isWheelScroll) === true) {
				return true
			}
		}
		if (this.isUndergoingChanges === true) {
			return true
		}
		return this._camera.handleScroll(scrollData, isWheelScroll)
	}

	attemptStickyStep() {
		return (this.isUndergoingChanges === false && this._camera.attemptStickyStep())
	}

	zoom(zoomData) {
		if (this.isUndergoingChanges === true) {
			return
		}
		this._camera.zoom(zoomData)
	}

	setPercent(percent) {
		if (this.isUndergoingChanges === true) {
			return
		}
		this._camera.setPercent(percent)
	}

	// Functions to deal with inner changes (jumps) and resize

	resize() {
		// After all segments have been resized, (re)position them
		this._positionSegments()

		// Update camera and possible snap points (note that zoomFactor will be forced to 1)
		this._camera.setBoundsAndUpdateOnResize()
	}

	_positionSegments() {
		let sumOfPreviousSegmentDimensions = 0

		// Translate all segment containers in the page by half their size plus the sum
		// of all previous segment dimensions (so that the first one is translated only
		// half its size and all others are then glued next to it, one after the other)
		this._layerPile.layersArray.forEach((layer) => {
			const segment = layer.content
			const { size } = segment
			const { width, height } = size
			if (!width || !height) {
				return
			}

			switch (this._inScrollDirection) {
			case "ltr":
				segment.setPositionInSegmentLine({ x: sumOfPreviousSegmentDimensions, y: 0 })
				segment.setPosition({
					x: sumOfPreviousSegmentDimensions + width / 2,
					y: 0,
				})
				sumOfPreviousSegmentDimensions += width
				break
			case "rtl":
				segment.setPositionInSegmentLine({ x: -sumOfPreviousSegmentDimensions, y: 0 })
				segment.setPosition({
					x: -sumOfPreviousSegmentDimensions - width / 2,
					y: 0,
				})
				sumOfPreviousSegmentDimensions += width
				break
			case "ttb":
				segment.setPositionInSegmentLine({ x: 0, y: sumOfPreviousSegmentDimensions })
				segment.setPosition({
					x: 0,
					y: sumOfPreviousSegmentDimensions + height / 2,
				})
				sumOfPreviousSegmentDimensions += height
				break
			case "btt":
				segment.setPositionInSegmentLine({ x: 0, y: -sumOfPreviousSegmentDimensions })
				segment.setPosition({
					x: 0,
					y: -sumOfPreviousSegmentDimensions - height / 2,
				})
				sumOfPreviousSegmentDimensions += height
				break
			default:
				break
			}
		})
	}

}