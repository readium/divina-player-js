import LayerPile from "./LayerPile"
import Layer from "./Layer"

export default class Page extends LayerPile {

	get isAtStart() {
		return (this._handler && this._handler.type === "overflowHandler"
			&& this._handler.isAtStart === true)
	}

	get isAtEnd() {
		return (this._handler && this._handler.type === "overflowHandler"
			&& this._handler.isAtEnd === true)
	}

	// Used in Segment
	get pageIndex() { return this._pageIndex }

	// Used in InteractionManager

	get inScrollDirection() { return this._inScrollDirection }

	get hitZoneToPrevious() { return this._hitZoneToPrevious }

	get hitZoneToNext() { return this._hitZoneToNext }

	get secondaryAxis() { return this._secondaryAxis }

	get size() {
		let width = 0
		let height = 0
		// The size is derived from the sizes of all segments
		this._layersArray.forEach((layer) => {
			const segment = layer.content
			const { size } = segment
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				width += size.width
				height = Math.max(height, size.height)
			} else {
				height += size.height
				width = Math.max(width, size.width)
			}
		})
		if (this._layersArray.length > 1) {
			const { viewportRect } = this._player
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				height = Math.min(height, viewportRect.height)
			} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
				width = Math.min(width, viewportRect.width)
			}
			// Note that the above will prevent scrolling on the secondary axis
			// in a page that has more than one segment
		}
		return { width, height }
	}

	constructor(pageIndex, isADoublePage, overflow, hAlign, vAlign, player) {
		const name = `page${pageIndex}`
		super("page", name)

		this._pageIndex = pageIndex
		this._isADoublePage = isADoublePage
		this._player = player

		this._hitZoneToPrevious = null
		this._hitZoneToNext = null
		this._inScrollDirection = null

		this._addOverflowHandler(overflow, hAlign, vAlign, player)

		this._timeAnimationsArray = []
	}

	// Used in Slideshow
	setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.setInScrollDirection(inScrollDirection)
	}

	// Used in Slideshow
	setHitZoneToPrevious(quadrant) {
		this._hitZoneToPrevious = quadrant
	}

	// Used in Slideshow
	setHitZoneToNext(quadrant) {
		this._hitZoneToNext = quadrant
	}

	// Used in Slideshow
	setSecondaryAxis(axis) {
		this._secondaryAxis = axis
	}

	addSegment(segment) {
		// Add the segment to the layer pile
		const segmentLayer = new Layer("segment", segment)
		this._addLayer(segmentLayer)
	}

	addSnapPoints(pageSegmentIndex, snapPointsArray) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.addSnapPoints(pageSegmentIndex, snapPointsArray)
	}

	addSliceAnimation(pageSegmentIndex, slice, animation) {
		if (this._handler && this._handler.type === "overflowHandler") {
			this._handler.addSliceAnimation(pageSegmentIndex, slice, animation)
		}
	}

	addSoundAnimation(pageSegmentIndex, animation) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.addSoundAnimation(pageSegmentIndex, animation)
	}

	// Used in PageNavigator
	goToSegmentIndex(pageSegmentIndex, isGoingForward = true) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.goToSegmentIndex(pageSegmentIndex, isGoingForward)
	}

	// Used in PageNavigator
	getLastPageSegmentIndex() {
		return (this._layersArray.length - 1)
	}

	attemptStickyStep() {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return false
		}
		return this._handler.attemptStickyStep()
	}

	zoom(zoomData) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.zoom(zoomData)
	}

	setPercent(percent) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.setPercent(percent)
	}

	// Used in PageNavigator
	getCurrentHref() {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return null
		}
		return this._handler.getCurrentHref()
	}

	resizePage() {
		const pageNavigator = this._parent
		if (pageNavigator) {
			pageNavigator.layersArray.forEach((layer) => {
				const { content, isActive } = layer // content is a Page
				if (content === this && isActive === true) {
					this.resize()
				}
			})
		}
	}

	updateLoadStatus() {
		const oldStatus = this._loadStatus

		super.updateLoadStatus()

		if (this._loadStatus !== oldStatus) {
			const { eventEmitter } = this._player
			const data = { pageIndex: this._pageIndex, loadStatus: this._loadStatus }
			eventEmitter.emit("pageloadstatusupdate", data)
		}
	}

}