import LayerPile from "./LayerPile"
import Layer from "./Layer"

export default class Page extends LayerPile {

	get isAtStart() {
		return (this.handler && this.handler.type === "overflowHandler"
			&& this.handler.isAtStart === true)
	}

	get isAtEnd() {
		return (this.handler && this.handler.type === "overflowHandler"
			&& this.handler.isAtEnd === true)
	}

	// Used in PageNavigator
	get doesOverflow() { return (this.isAtStart === false || this.isAtEnd === false) }

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
		this.layersArray.forEach((layer) => {
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

	constructor(pageIndex, overflow, hAlign, vAlign, player) {
		const name = `page${pageIndex}`
		super("page", name)

		this._pageIndex = pageIndex
		this._player = player

		this._hitZoneToPrevious = null
		this._hitZoneToNext = null
		this._inScrollDirection = null

		this._addOverflowHandler(overflow, hAlign, vAlign, player)

		this._timeAnimationsArray = []
	}

	setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.setInScrollDirection(inScrollDirection)
	}

	setHitZoneToPrevious(quadrant) {
		this._hitZoneToPrevious = quadrant
	}

	setHitZoneToNext(quadrant) {
		this._hitZoneToNext = quadrant
	}

	setSecondaryAxis(axis) {
		this._secondaryAxis = axis
	}

	addSegment(segment) {
		// Add the segment to the layer pile
		const segmentLayer = new Layer("segment", segment)
		this.addLayer(segmentLayer)
	}

	addSnapPoints(pageSegmentIndex, snapPointsArray) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.addSnapPoints(pageSegmentIndex, snapPointsArray)
	}

	addSliceAnimation(pageSegmentIndex, slice, animation) {
		if (this.handler && this.handler.type === "overflowHandler") {
			this.handler.addSliceAnimation(pageSegmentIndex, slice, animation)
		}
	}

	addSoundAnimation(pageSegmentIndex, animation) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.addSoundAnimation(pageSegmentIndex, animation)
	}

	// Used in PageNavigator
	goToSegmentIndex(pageSegmentIndex, isGoingForward = true) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.goToSegmentIndex(pageSegmentIndex, isGoingForward)
	}

	// Used in PageNavigator
	getLastPageSegmentIndex() {
		return (this.layersArray.length - 1)
	}

	attemptStickyStep() {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return false
		}
		return this.handler.attemptStickyStep()
	}

	zoom(zoomData) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.zoom(zoomData)
	}

	setPercent(percent) {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return
		}
		this.handler.setPercent(percent)
	}

	// Used in PageNavigator
	getCurrentHref() {
		if (!this.handler || this.handler.type !== "overflowHandler") {
			return null
		}
		return this.handler.getCurrentHref()
	}

	resizePage() {
		const pageNavigator = this.parent
		if (!pageNavigator) {
			return
		}
		pageNavigator.layersArray.forEach((layer) => {
			const { content, isActive } = layer // content is a Page
			if (content === this && isActive === true) {
				this.resize()
			}
		})
	}

	updateLoadStatus() {
		const oldStatus = this.loadStatus

		super.updateLoadStatus()

		if (this.loadStatus !== oldStatus) {
			const { eventEmitter } = this._player
			const data = { pageIndex: this._pageIndex, loadStatus: this.loadStatus }
			eventEmitter.emit("pageloadstatusupdate", data)
		}
	}

	getInfo() {
		const pageNavigator = this.parent
		if (!pageNavigator) {
			return {}
		}
		const { pageNavType } = pageNavigator
		if (pageNavType !== "double") {
			return super.getInfo()
		}
		// For a double page, if the first (half) page is empty, then the second one may be considered
		const result = this.layersArray[0].getInfo()
		if (result.href === "" && this.layersArray.length === 2) {
			return this.layersArray[1].getInfo()
		}
		return result
	}

}