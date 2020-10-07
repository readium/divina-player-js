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

	// Used in StoryLoader and below
	get segmentsArray() { return this._layersArray.map(({ content }) => (content)) }

	// Used in InteractionManager

	get hitZoneToPrevious() { return this._hitZoneToPrevious }

	get hitZoneToNext() { return this._hitZoneToNext }

	get inScrollDirection() { return this._inScrollDirection }

	get size() {
		let width = 0
		let height = 0
		// The size is derived from the sizes of all segments
		this.segmentsArray.forEach((segment) => {
			const { size } = segment
			const { viewportRect } = this._player
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				width += size.width
				if (this._isADoublePage === true) {
					height = Math.max(height, size.height)
				} else {
					height = viewportRect.height
				}
			} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
				height += size.height
				width = viewportRect.width
			}
		})
		return { width, height }
	}

	constructor(pageIndex, isADoublePage, overflow, player) {
		const name = `page${pageIndex}`
		super(name)

		this._pageIndex = pageIndex
		this._isADoublePage = isADoublePage
		this._player = player

		this._hitZoneToPrevious = null
		this._hitZoneToNext = null
		this._inScrollDirection = null

		this._addOverflowHandler(overflow, player)

		const { options } = player
		const { doOnPageLoadStatusUpdate } = options
		if (doOnPageLoadStatusUpdate) {
			this._doOnPageLoadStatusUpdate = doOnPageLoadStatusUpdate
		}
	}

	// Used in Slideshow
	setDirection(direction) {
		this._setInScrollDirection(direction)

		switch (direction) {
		case "ltr":
			this._setHitZoneToPrevious("left")
			this._setHitZoneToNext("right")
			break
		case "rtl":
			this._setHitZoneToPrevious("right")
			this._setHitZoneToNext("left")
			break
		case "ttb":
			this._setHitZoneToPrevious("top")
			this._setHitZoneToNext("bottom")
			break
		case "btt":
			this._setHitZoneToPrevious("bottom")
			this._setHitZoneToNext("top")
			// Ditto
			break
		default:
			break
		}
	}

	_setHitZoneToPrevious(quadrant) {
		this._hitZoneToPrevious = quadrant
	}

	_setHitZoneToNext(quadrant) {
		this._hitZoneToNext = quadrant
	}

	_setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.setInScrollDirection(inScrollDirection)
	}

	addSegment(segment, shouldAddSegmentAtStart = false) {
		// Add the segment to the layer pile
		const segmentLayer = new Layer("segment", segment)
		this._addLayer(segmentLayer, shouldAddSegmentAtStart)
	}

	addSnapPointsForLastSegment(snapPointsArray) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.addSnapPointsForLastSegment(snapPointsArray)
	}

	// Used in PageNavigator
	goToSegmentIndex(segmentIndex, isGoingForward = true) {
		if (!this._handler || this._handler.type !== "overflowHandler") {
			return
		}
		this._handler.goToSegmentIndex(segmentIndex, isGoingForward)
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

	resizePage() {
		const storyNavigator = this._parent
		if (storyNavigator) {
			storyNavigator.layersArray.forEach((layer) => {
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

		if (this._loadStatus !== oldStatus && this._doOnPageLoadStatusUpdate) {
			this._doOnPageLoadStatusUpdate(this._pageIndex, this._loadStatus)
		}
	}

}