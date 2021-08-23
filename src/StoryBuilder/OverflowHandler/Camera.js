import * as Utils from "../../utils"
import * as constants from "../../constants"

export default class Camera {

	get isZoomed() { return (this._zoomFactor !== 1) }

	// When the scene is jumping between two snap points, isAutoScrolling === true
	get isAutoScrolling() {
		return (this._jumpData) ? this._jumpData.isAutoScrolling : false
	}

	// In a scene that is larger than the viewport, isAtStart = true on reaching it going forward
	// (while a scene that is not larger than the viewport is considered to be always at its start)
	get isAtStart() {
		return (this.isZoomed === false && (this._progress === null || this._progress === 0))
	}

	// In a scene larger than the viewport, isAtEnd = true before leaving the scene going forward
	// (while a scene that is not larger than the viewport is considered to be always at its end)
	get isAtEnd() {
		return (this.isZoomed === false && (this._progress === null || this._progress === 1))
	}

	get _hasSpaceToMove() {
		return (Math.abs(this._maxX - this._minX) + Math.abs(this._maxY - this._minY) > 0)
	}

	constructor(scene, overflow, hAlign, vAlign, player) {
		// A scene is just a layerPile (in the Divina case, can only be a page)
		this._scene = scene
		this._overflow = overflow
		this._hAlign = hAlign
		this._vAlign = vAlign

		// Useful for viewportRect and updateDisplayForZoomFactor (and options just below)
		this._player = player
		const { eventEmitter } = this._player
		this._eventEmitter = eventEmitter

		const { options } = player
		const {
			allowsPaginatedScroll,
			isPaginationSticky,
			isPaginationGridBased,
		} = options
		const shouldReturnDefaultValue = true
		this._allowsPaginatedScroll = Utils.returnValidValue("allowsPaginatedScroll", allowsPaginatedScroll,
			shouldReturnDefaultValue)
		this._isPaginationSticky = Utils.returnValidValue("isPaginationSticky", isPaginationSticky,
			shouldReturnDefaultValue)
		this._isPaginationGridBased = Utils.returnValidValue("isPaginationGridBased", isPaginationGridBased,
			shouldReturnDefaultValue)

		this._inScrollDirection = null
		this._relativeStart = null
		this._relativeEnd = null
		this._referenceDimension = null

		// The distance to cover can change on a resize (because of the change in viewportRect),
		// but it cannot not change with a change in zoomFactor (the value is the one that applies
		// when zoomFactor === 1; it is always positive)
		this._distanceToCover = 0

		// The below values can necessarily change on a resize, but also with a zoom change
		this._progress = null // However if null, progress remains null whatever the zoomFactor
		this._minX = 0 // Minimum value for the camera center's coordinate on the x axis
		this._maxX = 0
		this._minY = 0
		this._maxY = 0
		this._currentPosition = { x: 0, y: 0 } // Camera center in non-scaled/non-zoomed referential
		this._signedPercent = null // Signed % of currentPosition x or y over full scene width or height

		this._segmentsInfoArray = []

		this._snapPointsArray = []
		this._reset()
		this._possibleError = 0
		this._paginationProgressStep = null
		this._lastNonTemporaryProgress = null

		this._sliceAnimationsArray = null
		this._soundAnimationsArray = null

		this._zoomFactor = 1
		this._zoomTouchPoint = null
	}

	_reset() {
		this._jumpData = {
			isAutoScrolling: false,
			startDate: null,
			duration: 0,
			startProgress: null,
			targetProgress: null,
			shouldForceToEnd: false,
			endCallback: null,
		}
	}

	setInScrollDirection(inScrollDirection) {
		this._inScrollDirection = inScrollDirection
		this._setRelativeStartAndEnd(inScrollDirection)
		this._setReferenceDimension(inScrollDirection)
	}

	// Based on the page's inScrollDirection, express the viewport "start"
	// and "end" points in relative coordinates (from the top left corner)
	_setRelativeStartAndEnd(inScrollDirection) {
		this._relativeStart = null
		this._relativeEnd = null
		switch (inScrollDirection) {
		case "ltr":
			this._relativeStart = { x: 0, y: 0.5 } // Start is the middle left point
			this._relativeEnd = { x: 1, y: 0.5 } // End is the middle right point
			break
		case "rtl":
			this._relativeStart = { x: 1, y: 0.5 }
			this._relativeEnd = { x: 0, y: 0.5 }
			break
		case "ttb":
			this._relativeStart = { x: 0.5, y: 0 }
			this._relativeEnd = { x: 0.5, y: 1 }
			break
		case "btt":
			this._relativeStart = { x: 0.5, y: 1 }
			this._relativeEnd = { x: 0.5, y: 0 }
			break
		default:
			break
		}
	}

	_setReferenceDimension(inScrollDirection) {
		if (inScrollDirection === "ltr" || inScrollDirection === "rtl") {
			this._referenceDimension = "width"
		}
		if (inScrollDirection === "ttb" || inScrollDirection === "btt") {
			this._referenceDimension = "height"
		}
	}

	addSnapPoints(indexInLayerPile, snapPointsArray) {
		snapPointsArray.forEach((snapPoint) => {
			const fullSnapPoint = { ...snapPoint, pageSegmentIndex: indexInLayerPile }
			this._snapPointsArray.push(fullSnapPoint)
		})
	}

	addSliceAnimation(indexInLayerPile, slice, animation) {
		this._sliceAnimationsArray = this._sliceAnimationsArray || []

		const fullAnimation = { ...animation }
		const { type, keyframesArray } = animation
		if (type === "point") {
			keyframesArray.forEach((keyframe, i) => {
				fullAnimation.keyframesArray[i].key.pageSegmentIndex = indexInLayerPile
			})
		}
		this._sliceAnimationsArray.push({ slice, animation: fullAnimation })
	}

	addSoundAnimation(indexInLayerPile, animation) {
		this._soundAnimationsArray = this._soundAnimationsArray || []

		const fullAnimation = { ...animation }
		const { type } = animation
		if (type === "point") {
			fullAnimation.start.pageSegmentIndex = indexInLayerPile
			if (fullAnimation.end) {
				fullAnimation.end.pageSegmentIndex = indexInLayerPile
			}
		} else { // If type === "progress", rewrite start and end to unify notation
			fullAnimation.start = { progress: fullAnimation.start }
			if (fullAnimation.end !== undefined) {
				fullAnimation.end = { progress: fullAnimation.end }
			}
		}
		this._soundAnimationsArray.push(fullAnimation)
	}

	// After an overflowHandler's _positionSegments() operation, so in particular after a resize:
	// - If the total length of all segments together is less than the relevant viewport dimension,
	// then the camera will not have space to move (but beware: this is only true if zoomFactor = 1),
	// so its start and end positions will be set to the center of the whole segment block (= scene)
	// - If not, _distanceToCover !== 0 (which will force _hasSpaceToMove = true) and the camera
	// respective to the first segment (e.g. if ltr: the camera's center is positioned so that the
	// camera's left side corresponds to the first segment's left side, where x = 0)
	// (Also, do note that small pixel errors are accounted for!)
	setBoundsAndUpdateOnResize() {
		const { viewportRect } = this._player
		const { width, height } = viewportRect
		const sceneSize = this._scene.size

		// In the below:
		// - startP is a start progress value - only used on a secondary axis
		// - p0 and p1 are camera center positions for progress = 0 and progress = 1,
		// in the non-zoomed referential (meaning they depend on viewportRect, and are therefore
		// impacted by a resize), while min and max are in the zoomed (i.e. scaled) referential
		this._camCenter = {
			x: {
				p0: 0, p1: 0, isPrimaryAxis: false, startP: 0.5,
			},
			y: {
				p0: 0, p1: 0, isPrimaryAxis: false, startP: 0.5,
			},
		}
		this._distanceToCover = 0

		let distanceToCover
		let signFactor

		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			this._camCenter.x.isPrimaryAxis = true

			distanceToCover = sceneSize.width - width
			signFactor = (this._inScrollDirection === "rtl") ? -1 : 1

			if (distanceToCover <= constants.POSSIBLE_PIXEL_ERROR) {
				distanceToCover = 0
				this._camCenter.x.p0 = signFactor * (sceneSize.width / 2)
			} else {
				this._distanceToCover = distanceToCover
				this._camCenter.x.p0 = signFactor * (width / 2)
			}
			this._camCenter.x.p1 = this._camCenter.x.p0 + signFactor * distanceToCover

			// There is no need for a direction on the secondary axis, so we'll define p0 as the
			// value for which y is min (top), and p1 as the value for which y is max (bottom)
			// Remember that, in Page, the height in case of ltr or rtl with more than 1 segment
			// is set to viewport height, so y.p0 and y.p1 are left at 0, and no vAlign applies
			// (meaning it is considered as "center" by default)
			if (sceneSize.height >= height - constants.POSSIBLE_PIXEL_ERROR) {
				this._camCenter.y.p0 = (height - sceneSize.height) / 2
				this._camCenter.y.p1 = (sceneSize.height - height) / 2
				if (this._vAlign === "top") {
					this._camCenter.y.startP = 0
				} else if (this._vAlign === "bottom") {
					this._camCenter.y.startP = 1
				}
			}

		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
			this._camCenter.y.isPrimaryAxis = true

			distanceToCover = sceneSize.height - height
			signFactor = (this._inScrollDirection === "btt") ? -1 : 1

			if (distanceToCover <= constants.POSSIBLE_PIXEL_ERROR) {
				distanceToCover = 0
				this._camCenter.y.p0 = signFactor * (sceneSize.height / 2)
			} else {
				this._distanceToCover = distanceToCover
				this._camCenter.y.p0 = signFactor * (height / 2)
			}
			this._camCenter.y.p1 = this._camCenter.y.p0 + signFactor * distanceToCover

			if (sceneSize.width >= width - constants.POSSIBLE_PIXEL_ERROR) {
				this._camCenter.x.p0 = (width - sceneSize.width) / 2
				this._camCenter.x.p1 = (sceneSize.width - width) / 2
				if (this._hAlign === "left") {
					this._camCenter.x.startP = 0
				} else if (this._hAlign === "right") {
					this._camCenter.x.startP = 1
				}
			}
		}

		const callback = () => {
			// Update snap point-related speeds based on inScrollDirection
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				this._snapJumpSpeed = width * constants.SNAP_JUMP_SPEED_FACTOR
				this._stickyMoveSpeed = width * constants.STICKY_MOVE_SPEED_FACTOR
			} else {
				this._snapJumpSpeed = height * constants.SNAP_JUMP_SPEED_FACTOR
				this._stickyMoveSpeed = height * constants.STICKY_MOVE_SPEED_FACTOR
			}

			// Force zoomFactor to 1 and recompute x and y bounds
			this._setZoomFactorAndUpdateBounds(1)

			// Recompute progress by segment
			this._updateSegmentInfoArray()

			// If the page is larger than the effective viewport...
			if (this._distanceToCover > 0) {

				// Compute the possible error for progress calculations
				this._possibleError = this._getProgressStepForLength(constants.POSSIBLE_PIXEL_ERROR)

				// Compute the progress delta corresponding to one pagination step forward
				this._paginationProgressStep = this._getPaginationProgressStep()

				this._computeProgressValuesForResourcePoints()
			}

			// Now reposition the camera and update progress (if not null)
			this._updatePositionAndProgressOnResize()
		}

		// If we were actually jumping between snap points, force jump to end
		if (this.isAutoScrolling === true) {
			this._jumpData.shouldForceToEnd = true
			this._jumpData.endCallback = callback
		} else {
			callback()
		}
	}

	_getPaginationProgressStep() {
		const { viewportRect } = this._player
		const { width, height } = viewportRect
		let progressStep = 0
		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			progressStep = this._getProgressStepForLength(width)
		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
			progressStep = this._getProgressStepForLength(height)
		}
		return progressStep
	}

	_getProgressStepForLength(length) {
		const progressStep = Math.min(Math.max(length / this._distanceToCover, 0), 1)
		return progressStep
	}

	// Build all relevant points (for snap points and animations)
	// by adding a progress value to their raw information
	// (ensuring that progress always increases in arrays of snap points and keyframes)
	_computeProgressValuesForResourcePoints() {
		// For snap points
		let lastProgress = 0
		this._snapPointsArray.forEach((point, i) => {
			let progress = this._getProgressForPoint(point)
			progress = Math.max(progress, lastProgress)
			this._snapPointsArray[i].progress = progress
			lastProgress = progress
		})

		// For point-based animations
		if (this._sliceAnimationsArray) {
			this._sliceAnimationsArray.forEach(({ animation }, i) => {
				lastProgress = 0
				const { type, keyframesArray } = animation
				keyframesArray.forEach(({ key }, j) => {
					let progress = (type === "point") ? this._getProgressForPoint(key) : key
					progress = Math.max(progress, lastProgress)
					this._sliceAnimationsArray[i].animation.keyframesArray[j].progress = progress
					lastProgress = progress
				})
			})
		}
		if (this._soundAnimationsArray) {
			this._soundAnimationsArray.forEach(({ type, start, end }, i) => {
				if (type === "point") {
					let progress = this._getProgressForPoint(start)
					this._soundAnimationsArray[i].start.progress = progress
					if (end) {
						progress = this._getProgressForPoint(end)
						this._soundAnimationsArray[i].end.progress = progress
					}
				}
			})
		}
	}

	_getProgressForPoint(point) {
		const {
			pageSegmentIndex,
			viewport,
			x,
			y,
			unit,
		} = point
		if (pageSegmentIndex >= this._segmentsInfoArray.length) {
			return null
		}

		const segmentInfo = this._segmentsInfoArray[pageSegmentIndex]
		const { size, unscaledSize, positionInSegmentLine } = segmentInfo

		// Get the center position of the camera for the snap point alignment
		const position = this._getCameraPositionInSegmentForAlignment(viewport, { x, y }, unit, size,
			unscaledSize)
		if (!position) {
			return null
		}

		let progress = null

		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {

			// Update the position based on the segment's position in the scene

			if (this._inScrollDirection === "ltr") {
				position.x += positionInSegmentLine
			} else {
				position.x += -positionInSegmentLine
			}

			// Compute the distance from the scene container's start point to that new point

			const xDistance = Math.abs(position.x - this._camCenter.x.p0)

			if (xDistance < constants.POSSIBLE_PIXEL_ERROR) {
				progress = 0
			} else if (Math.abs(this._distanceToCover - xDistance) <= constants.POSSIBLE_PIXEL_ERROR) {
				progress = 1
			} else {
				progress = Math.min(Math.max(xDistance / this._distanceToCover, 0), 1)
			}

		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {

			if (this._inScrollDirection === "ttb") {
				position.y += positionInSegmentLine
			} else {
				position.y += -positionInSegmentLine
			}

			const yDistance = Math.abs(position.y - this._camCenter.y.p0)

			if (yDistance < constants.POSSIBLE_PIXEL_ERROR) {
				progress = 0
			} else if (Math.abs(this._distanceToCover - yDistance) <= constants.POSSIBLE_PIXEL_ERROR) {
				progress = 1
			} else {
				progress = Math.min(Math.max(yDistance / this._distanceToCover, 0), 1)
			}
		}

		return progress
	}

	// Get the position of the camera's center point corresponding to a given point alignment
	_getCameraPositionInSegmentForAlignment(viewport, coords, unit, segmentSize,
		unscaledSegmentSize) {
		const sign = (this._inScrollDirection === "rtl" || this._inScrollDirection === "btt") ? -1 : 1
		let x = null
		if (coords.x !== undefined) {
			if (unit === "%") {
				x = Math.min(Math.max(0, (coords.x * segmentSize.width) / 100), segmentSize.width)
			} else if (unit === "px") {
				const percent = Math.min(Math.max(0, coords.x / unscaledSegmentSize.width), 1)
				x = Math.min(Math.max(0, percent * segmentSize.width), segmentSize.width)
			}
		} else {
			x = 0
		}
		let y = null
		if (coords.y !== undefined) {
			if (unit === "%") {
				y = Math.min(Math.max(0, (coords.y * segmentSize.height) / 100), segmentSize.height)
			} else if (unit === "px") {
				const percent = Math.min(Math.max(0, coords.y / unscaledSegmentSize.height), 1)
				y = Math.min(Math.max(0, percent * segmentSize.height), segmentSize.height)
			}
		} else {
			y = 0
		}
		if (x === null && y === null) {
			return null
		}

		const { viewportRect } = this._player
		const { width, height } = viewportRect
		const position = {
			x: sign * x,
			y: sign * y,
		}
		switch (viewport) {
		case "start":
			position.x -= (this._relativeStart.x - 0.5) * width
			position.y -= (this._relativeStart.y - 0.5) * height
			break
		case "end":
			position.x -= (this._relativeEnd.x - 0.5) * width
			position.y -= (this._relativeEnd.y - 0.5) * height
			break
		default: // "center"
			break
		}

		return position
	}

	// Called by a resize or zoom change
	_setZoomFactorAndUpdateBounds(zoomFactor) {
		this._zoomFactor = Math.min(Math.max(zoomFactor, 1), constants.MAX_ZOOM)
		this._scene.setScale(this._zoomFactor) // Reminder: this._scene is a Container

		this._player.updateDisplayForZoomFactor(zoomFactor)

		this._updateMinAndMaxX()
		this._updateMinAndMaxY()
		this._updateOffsetInScaledReferential()
	}

	_updateMinAndMaxX() {
		const { viewportRect, viewportBoundingRect } = this._player

		if (this._inScrollDirection === "ltr") {
			// If the scene overflows from the start...
			if (this._scene.size.width > viewportRect.width) {
				this._minX = Math.min((viewportRect.width / 2) * this._zoomFactor,
					viewportBoundingRect.width / 2)
				this._maxX = -this._minX + this._scene.size.width * this._zoomFactor

			// ... otherwise if the zoom makes the scene overflow
			} else if (this._scene.size.width * this._zoomFactor > viewportBoundingRect.width) {
				this._minX = viewportBoundingRect.width / 2
				this._maxX = -this._minX + this._scene.size.width * this._zoomFactor

			// ... otherwise
			} else {
				this._minX = (this._scene.size.width / 2) * this._zoomFactor
				this._maxX = this._minX
			}

		} else if (this._inScrollDirection === "rtl") {
			if (this._scene.size.width > viewportRect.width) {
				this._maxX = -Math.min((viewportRect.width / 2) * this._zoomFactor,
					viewportBoundingRect.width / 2)
				this._minX = -this._maxX - this._scene.size.width * this._zoomFactor

			} else if (this._scene.size.width * this._zoomFactor > viewportBoundingRect.width) {
				this._maxX = -viewportBoundingRect.width / 2
				this._minX = -this._maxX - this._scene.size.width * this._zoomFactor

			} else {
				this._maxX = -(this._scene.size.width / 2) * this._zoomFactor
				this._minX = this._maxX
			}

		} else {
			const { p0, p1 } = this._camCenter.x

			// Compute a delta depending on whether the segment line is scrollable on its secondary x axis
			const sizeDiff = (p0 === p1) // p0===p1 <=> not scrollable on secondary y axis
				? this._scene.size.width * this._zoomFactor - viewportBoundingRect.width
				: viewportRect.width * this._zoomFactor - viewportBoundingRect.width
			const delta = (sizeDiff > 0) ? (sizeDiff / 2) : 0

			this._minX = p0 * this._zoomFactor - delta
			this._maxX = p1 * this._zoomFactor + delta
		}
	}

	_updateMinAndMaxY() {
		const { viewportRect, viewportBoundingRect } = this._player

		if (this._inScrollDirection === "ttb") {
			if (this._scene.size.height > viewportRect.height) {
				this._minY = Math.min((viewportRect.height / 2) * this._zoomFactor,
					viewportBoundingRect.height / 2)
				this._maxY = -this._minY + this._scene.size.height * this._zoomFactor

			} else if (this._scene.size.height * this._zoomFactor > viewportBoundingRect.height) {
				this._minY = viewportBoundingRect.height / 2
				this._maxY = -this._minY + this._scene.size.height * this._zoomFactor

			} else {
				this._minY = (this._scene.size.height / 2) * this._zoomFactor
				this._maxY = this._minY
			}

		} else if (this._inScrollDirection === "btt") {
			if (this._scene.size.height > viewportRect.height) {
				this._maxY = -Math.min((viewportRect.height / 2) * this._zoomFactor,
					viewportBoundingRect.height / 2)
				this._minY = -this._maxY - this._scene.size.height * this._zoomFactor

			} else if (this._scene.size.height * this._zoomFactor > viewportBoundingRect.height) {
				this._maxY = -viewportBoundingRect.height / 2
				this._minY = -this._maxY - this._scene.size.height * this._zoomFactor

			} else {
				this._maxY = -(this._scene.size.height / 2) * this._zoomFactor
				this._minY = this._maxY
			}

		} else {
			const { p0, p1 } = this._camCenter.y

			const sizeDiff = (p0 === p1)
				? this._scene.size.height * this._zoomFactor - viewportBoundingRect.height
				: viewportRect.height * this._zoomFactor - viewportBoundingRect.height
			const delta = (sizeDiff > 0) ? (sizeDiff / 2) : 0

			this._minY = p0 * this._zoomFactor - delta
			this._maxY = p1 * this._zoomFactor + delta
		}
	}

	_updateOffsetInScaledReferential() {
		let distanceInScaledReferential = null
		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			distanceInScaledReferential = this._maxX - this._minX
		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
			distanceInScaledReferential = this._maxY - this._minY
		}
		if (!distanceInScaledReferential) {
			return
		}
		this._offsetInScaledReferential = distanceInScaledReferential
		this._offsetInScaledReferential -= this._distanceToCover * this._zoomFactor
		this._offsetInScaledReferential /= 2
	}

	_updateSegmentInfoArray() {
		if (!this._referenceDimension) {
			return
		}
		const { viewportRect } = this._player

		this._segmentsInfoArray = []

		let positionInSegmentLine = 0
		this._scene.layersArray.forEach((segmentLayer) => {
			const segment = segmentLayer.content
			const { segmentIndex, unscaledSize } = segment

			const { href, type } = segmentLayer.getInfo()
			let segmentInfo = {
				segmentIndex,
				href,
				type,
				unscaledSize,
				segment,
			}

			if (this._distanceToCover) {
				const coveredDistance = positionInSegmentLine - viewportRect[this._referenceDimension] / 2
				const progress = coveredDistance / this._distanceToCover
				// Note that we don't bound progress between 0 and 1 to allow for correct virtual points
				const { size } = segmentLayer
				const referenceLength = size[this._referenceDimension]
				segmentInfo = {
					...segmentInfo,
					progress, // Progress when the image touches the center of the viewport (going forward)
					size,
					length: referenceLength,
					positionInSegmentLine, // In non-scaled/zoomed referential
				}

				positionInSegmentLine += referenceLength
			}

			this._segmentsInfoArray.push(segmentInfo)
		})
	}

	_updatePositionAndProgressOnResize() { // Reminder: this._zoomFactor necessarily is 1

		// If the scene can now entirely fit within the viewport
		if (this._distanceToCover === 0) {
			const startPosition = this._getStartPosition()
			this._setPosition(startPosition)
			const shouldUpdatePosition = true
			this.setProgress(null, shouldUpdatePosition)

		} else {
			// Keep virtual point fixed (if there is one, otherwise progress was null before)
			const progress = (this._virtualPoint)
				? this._getProgressForVirtualPoint(this._virtualPoint)
				: 0

			if (this._overflow === "paginated" && this.isAutoScrolling === false) {
				const shouldUpdatePosition = false
				this.setProgress(progress, shouldUpdatePosition)
				const isTheResultOfADragEnd = false
				this._moveToClosestSnapPoint(isTheResultOfADragEnd)

			} else {
				const shouldUpdatePosition = true
				this.setProgress(progress, shouldUpdatePosition)
			}
		}
	}

	_getProgressForVirtualPoint(virtualPoint) {
		if (!virtualPoint) {
			return 0
		}
		const { pageSegmentIndex, percent } = virtualPoint
		const point = {
			pageSegmentIndex,
			viewport: "center",
			x: 0,
			y: 0,
			unit: "%",
		}
		const coord = percent * 100
		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			point.x = coord
		} else {
			point.y = coord
		}
		const progress = this._getProgressForPoint(point)
		return progress
	}

	_getStartPosition() {
		const { x, y } = this._camCenter
		const startPosition = {}
		if (x.isPrimaryAxis === true) {
			const { p0, p1, startP } = y
			const startY = p0 + startP * (p1 - p0)
			startPosition.x = x.p0
			startPosition.y = startY
		} else {
			const { p0, p1, startP } = x
			const startX = p0 + startP * (p1 - p0)
			startPosition.x = startX
			startPosition.y = y.p0
		}
		return startPosition
	}

	_setPosition({ x, y }) { // Note that x and y correspond to the camera's center position
		this._currentPosition = { x, y }
		this._scene.setPosition({ x: -x, y: -y }) // this._scene is still a Container
		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			this._signedPercent = x / (this._scene.size.width * this._zoomFactor)
		} else {
			this._signedPercent = y / (this._scene.size.height * this._zoomFactor)
		}
	}

	_updateProgressForPosition(position = this._currentPosition,
		shouldStoreLastNonTemporaryProgress = false) {
		if (this._progress === null) {
			return
		}
		if (shouldStoreLastNonTemporaryProgress === true
			&& this._lastNonTemporaryProgress === null) {
			this._lastNonTemporaryProgress = this._progress // Useful for a sticky drag
		}
		const progress = this._getProgressForPosition(position)
		const shouldUpdatePosition = false
		this.setProgress(progress, shouldUpdatePosition)
	}

	_getProgressForPosition(position) {
		let progress = null
		if (this._inScrollDirection === "ltr") {
			progress = (position.x - this._minX - this._offsetInScaledReferential)
			progress /= (this._maxX - this._minX - 2 * this._offsetInScaledReferential)
		} else if (this._inScrollDirection === "rtl") {
			progress = (this._maxX - position.x - this._offsetInScaledReferential)
			progress /= (this._maxX - this._minX - 2 * this._offsetInScaledReferential)
		} else if (this._inScrollDirection === "ttb") {
			progress = (position.y - this._minY - this._offsetInScaledReferential)
			progress /= (this._maxY - this._minY - 2 * this._offsetInScaledReferential)
		} else if (this._inScrollDirection === "btt") {
			progress = (this._maxY - position.y - this._offsetInScaledReferential)
			progress /= (this._maxY - this._minY - 2 * this._offsetInScaledReferential)
		}
		progress = Math.min(Math.max(progress, 0), 1)
		return progress
	}

	// Position the scene container to conform to the specified progress value
	setProgress(p = null, shouldUpdatePosition = true) {
		const hasProgressChanged = (p !== this._progress)
		this._progress = p

		if (p !== null) {
			this._virtualPoint = this._getVirtualPoint()

			const { pageNavigator } = this._player
			if (pageNavigator.loadingMode === "segment" && pageNavigator.isInAGoTo === false) {
				const forceUpdate = false
				if (this._virtualPoint) {
					const { segmentIndex } = this._virtualPoint
					pageNavigator.updateSegmentLoadTasks(segmentIndex, forceUpdate)
				} else if (this._segmentsInfoArray.length > 0 && this._segmentsInfoArray[0]) {
					pageNavigator.updateSegmentLoadTasks(this._segmentsInfoArray[0].segmentIndex,
						forceUpdate)
				}
			}

			// Process progress animations
			if (this._sliceAnimationsArray) {
				this._sliceAnimationsArray.forEach((animationData) => {
					this._playSliceAnimation(animationData)
				})
			}
			if (this._soundAnimationsArray) {
				this._soundAnimationsArray.forEach((soundAnimation) => {
					this._playSoundAnimation(soundAnimation)
				})
			}
		} else {
			this._virtualPoint = null
		}

		if (hasProgressChanged === true) {
			const { pageNavigator } = this._player
			const { pageIndex, nbOfSegments, pageNavType } = pageNavigator
			let locator = null
			if (this._virtualPoint) {
				const {
					href, type, segmentIndex = 0, percent,
				} = this._virtualPoint || {}
				const totalProgression = Math.min((segmentIndex + 1 + percent) / nbOfSegments, 1)
				const locations = {
					position: pageIndex || 0,
					progression: this._progress,
					totalProgression,
				}
				locator = {
					href, type, locations, text: pageNavType,
				}
			} else {
				locator = pageNavigator.getLocator()
			}
			const data = { locator }
			this._eventEmitter.emit("inpagescroll", data)
		}

		if (shouldUpdatePosition === false) {
			if (hasProgressChanged === true) {
				this._player.refreshOnce()
			}
			return
		}

		if (p === null) {
			const startPosition = this._getStartPosition()
			this._setPosition(startPosition)
			this._player.refreshOnce()

		} else if (hasProgressChanged === true || this._progress === 0 || this._progress === 1) {
			let position = this._currentPosition
			if (this._inScrollDirection === "ltr") {
				position = {
					x: this._minX + p * (this._camCenter.x.p1 - this._camCenter.x.p0) * this._zoomFactor,
					y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
				}
			} else if (this._inScrollDirection === "rtl") {
				position = {
					x: this._maxX + p * (this._camCenter.x.p1 - this._camCenter.x.p0) * this._zoomFactor,
					y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
				}
			} else if (this._inScrollDirection === "ttb") {
				position = {
					x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
					y: this._minY + p * (this._camCenter.y.p1 - this._camCenter.y.p0) * this._zoomFactor,
				}
			} else if (this._inScrollDirection === "btt") {
				position = {
					x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
					y: this._maxY + p * (this._camCenter.y.p1 - this._camCenter.y.p0) * this._zoomFactor,
				}
			}
			this._setPosition(position)
			this._player.refreshOnce()
		}
	}

	_playSliceAnimation(animationData) {
		const { slice, animation } = animationData

		const { variable, keyframesArray } = animation
		if (!keyframesArray || keyframesArray.length === 0) {
			return
		}
		let i = keyframesArray.length - 1
		let { progress } = keyframesArray[i]
		while (i >= 0 && progress >= this._progress) {
			i -= 1
			if (i >= 0) {
				progress = keyframesArray[i].progress
			}
		}
		i = Math.max(i, 0)

		const previousProgress = keyframesArray[i].progress
		const previousValue = keyframesArray[i].value

		if (i === keyframesArray.length - 1) {
			const value = previousValue
			slice.setVariable(variable, value)

		} else if (keyframesArray[i + 1].progress !== null) {
			const nextProgress = keyframesArray[i + 1].progress
			const nextValue = keyframesArray[i + 1].value
			if (nextValue !== previousValue) {
				let value = nextValue
				if (nextProgress !== previousProgress) { // Linear easing is assumed
					value = (this._progress - previousProgress) / (nextProgress - previousProgress)
					value *= (nextValue - previousValue)
					value += previousValue
				}
				slice.setVariable(variable, value)
			}

		}
	}

	_playSoundAnimation(animation) {
		const { resourceId, start, end } = animation
		const { resourceManager } = this._player
		const resource = resourceManager.getResourceWithId(resourceId)
		if (!resource) {
			return
		}
		if (!end) {
			if (this._progress >= start) {
				resource.playIfNeeded()
			}
		} else if (this._progress >= start.progress && this._progress < end.progress) {
			resource.playIfNeeded()
		} else {
			resource.stopIfNeeded()
		}
	}

	_getVirtualPoint() {
		if (this._progress === null || this._segmentsInfoArray.length < 1
			|| !this._referenceDimension) {
			return null
		}

		let indexOfFirstSegmentInViewport = null
		let indexOfSegmentAtCenterOfViewport = null
		let indexOfLastSegmentInViewport = 1
		let segmentInfo = this._segmentsInfoArray[1]
		const halfViewportProgress = this._paginationProgressStep / 2

		while (indexOfLastSegmentInViewport < this._segmentsInfoArray.length
			&& segmentInfo.progress <= this._progress + halfViewportProgress) {
			// Note that this._possibleError is not taken into account here
			if (indexOfFirstSegmentInViewport === null
				&& segmentInfo.progress > this._progress - halfViewportProgress) {
				indexOfFirstSegmentInViewport = indexOfLastSegmentInViewport
			}
			if (indexOfSegmentAtCenterOfViewport === null
				&& segmentInfo.progress > this._progress) {
				indexOfSegmentAtCenterOfViewport = indexOfLastSegmentInViewport
			}
			indexOfLastSegmentInViewport += 1
			segmentInfo = this._segmentsInfoArray[indexOfLastSegmentInViewport]
		}
		indexOfLastSegmentInViewport -= 1
		indexOfSegmentAtCenterOfViewport = (indexOfSegmentAtCenterOfViewport === null)
			? indexOfLastSegmentInViewport
			: indexOfSegmentAtCenterOfViewport - 1
		indexOfFirstSegmentInViewport = (indexOfFirstSegmentInViewport === null)
			? indexOfLastSegmentInViewport
			: indexOfFirstSegmentInViewport - 1

		const {
			positionInSegmentLine, length, href, type,
		} = this._segmentsInfoArray[indexOfSegmentAtCenterOfViewport]
		const { viewportRect } = this._player
		const viewportLength = viewportRect[this._referenceDimension]

		const coveredDistance = this._progress * this._distanceToCover
		let percent = (coveredDistance - positionInSegmentLine + viewportLength / 2) / length
		percent = Math.min(Math.max(percent, 0), 1)

		const { segmentIndex } = this._segmentsInfoArray[indexOfSegmentAtCenterOfViewport]
		const virtualPoint = {
			segmentIndex,
			pageSegmentIndex: indexOfSegmentAtCenterOfViewport,
			href,
			type,
			percent, // percent in segment (not in page!)
			indexOfFirstSegmentInViewport,
			indexOfLastSegmentInViewport,
		}

		this._segmentsInfoArray.forEach(({ segment }, k) => {
			const isVisible = (k >= indexOfFirstSegmentInViewport && k <= indexOfLastSegmentInViewport)
			segment.setIsInViewport(isVisible)
		})

		return virtualPoint
	}

	setPercent(percent) {
		if (this._progress === null || percent < 0 || percent > 1) {
			return
		}
		const shouldUpdatePosition = true
		this.setProgress(percent, shouldUpdatePosition)
	}

	_moveToClosestSnapPoint(isTheResultOfADragEnd = true) {
		let nextProgress = this._lastNonTemporaryProgress
		let previousProgress = this._lastNonTemporaryProgress

		let allowsSameProgress = false
		// For a sticky drag...
		if (isTheResultOfADragEnd === true) {
			if (this._lastNonTemporaryProgress === null) {
				return
			}
			if (this._progress >= this._lastNonTemporaryProgress) {
				nextProgress = this._getNextSnapPointProgress(allowsSameProgress,
					this._lastNonTemporaryProgress)
			} else {
				previousProgress = this._getPreviousSnapPointProgress(allowsSameProgress,
					this._lastNonTemporaryProgress)
			}

		// ...whereas after a resize or dezoom
		} else {
			allowsSameProgress = true
			const lastNonTemporaryProgress = null
			nextProgress = this._getNextSnapPointProgress(allowsSameProgress,
				lastNonTemporaryProgress)
			previousProgress = this._getPreviousSnapPointProgress(allowsSameProgress,
				lastNonTemporaryProgress)
		}

		const progressDifferenceToNext = nextProgress - this._progress
		const progressDifferenceToPrevious = this._progress - previousProgress
		let targetProgress = this._progress
		if (progressDifferenceToNext <= progressDifferenceToPrevious) {
			targetProgress = nextProgress
		} else if (progressDifferenceToNext > progressDifferenceToPrevious) {
			targetProgress = previousProgress
		}

		if (isTheResultOfADragEnd === true) {
			const isUpdate = false
			this._startSnapPointJump(targetProgress, isUpdate)

		} else { // Move instantly
			const shouldUpdatePosition = true
			this.setProgress(targetProgress, shouldUpdatePosition)
		}
		this._lastNonTemporaryProgress = null
	}

	// Get the progress value of the next snap point in the list (1 if there is none)
	_getNextSnapPointProgress(allowsSameProgress = false, lastNonTemporaryProgress) {

		// If lastNonTemporaryProgress is defined, then a step forward
		// (via a discontinuous gesture or a sticky drag) is under way
		const referenceProgress = (lastNonTemporaryProgress !== null)
			? lastNonTemporaryProgress
			: this._progress

		let i = 0
		while (i < this._snapPointsArray.length
			&& this._isSnapProgressInferior(allowsSameProgress, referenceProgress, i) === true) {
			i += 1
		}

		let nextProgress = 1 // Will ensure a jump to the end of the page at least
		if (i < this._snapPointsArray.length) {
			nextProgress = this._snapPointsArray[i].progress
		}

		// Select the closest value between that one and the one corresponding to one pagination away
		if (this._paginationProgressStep && this._allowsPaginatedScroll === true) {
			let nextPaginatedProgress = nextProgress

			if (lastNonTemporaryProgress !== null && this._isPaginationGridBased === false) {
				nextPaginatedProgress = lastNonTemporaryProgress + this._paginationProgressStep

			} else {
				nextPaginatedProgress = (allowsSameProgress === true)
					? Math.ceil((this._progress - this._possibleError) / this._paginationProgressStep)
					: Math.floor((this._progress + this._possibleError) / this._paginationProgressStep + 1)
				nextPaginatedProgress *= this._paginationProgressStep
			}
			nextPaginatedProgress = Math.min(Math.max(nextPaginatedProgress, 0), 1)

			nextProgress = Math.min(nextProgress, nextPaginatedProgress)
		}

		return nextProgress
	}

	_isSnapProgressInferior(allowsSameProgress, referenceProgress, i) {
		if (allowsSameProgress === true) { // A kind of "isSnapProgressStrictlyInferior"
			return (this._snapPointsArray[i].progress < referenceProgress - this._possibleError)
		}
		return (this._snapPointsArray[i].progress <= referenceProgress + this._possibleError)
	}

	// Get the progress value of the previous snap point in the list (0 if there is none)
	_getPreviousSnapPointProgress(allowsSameProgress = false, lastNonTemporaryProgress) {

		// If lastNonTemporaryProgress is defined, then a step backward
		// (via a discontinuous gesture or a sticky drag) is under way
		const referenceProgress = (lastNonTemporaryProgress !== null)
			? lastNonTemporaryProgress
			: this._progress

		let i = this._snapPointsArray.length - 1
		while (i >= 0
			&& this._isSnapProgressSuperior(allowsSameProgress, referenceProgress, i) === true) {
			i -= 1
		}

		let previousProgress = 0 // Will ensure a jump to the start of the page at least
		if (i >= 0) {
			previousProgress = this._snapPointsArray[i].progress
		}

		// Select the closest value between that one and the one corresponding to one pagination away
		if (this._paginationProgressStep && this._allowsPaginatedScroll === true) {
			let previousPaginatedProgress = previousProgress

			if (lastNonTemporaryProgress !== null && this._isPaginationGridBased === false) {
				previousPaginatedProgress = lastNonTemporaryProgress - this._paginationProgressStep
			} else {
				previousPaginatedProgress = (allowsSameProgress === true)
					? Math.floor((this._progress + this._possibleError) / this._paginationProgressStep)
					: Math.ceil((this._progress - this._possibleError) / this._paginationProgressStep - 1)
				previousPaginatedProgress *= this._paginationProgressStep
			}
			previousPaginatedProgress = Math.min(Math.max(previousPaginatedProgress, 0), 1)

			previousProgress = Math.max(previousProgress, previousPaginatedProgress)
		}
		return previousProgress
	}

	_isSnapProgressSuperior(allowsSameProgress, referenceProgress, i) {
		if (allowsSameProgress === true) { // A kind of "isSnapProgressStrictlySuperior"
			return (this._snapPointsArray[i].progress > referenceProgress + this._possibleError)
		}
		return (this._snapPointsArray[i].progress >= referenceProgress - this._possibleError)
	}

	zoom(zoomData) {
		// Prevent camera from zooming if is undergoing changes (i.e. jumping between points)
		if (this.isAutoScrolling === true) {
			return
		}

		const {
			isContinuous,
			touchPoint,
			delta,
			multiplier,
		} = zoomData
		if (!touchPoint) {
			return
		}
		const { viewportRect } = this._player

		let zoomFactor = this._zoomFactor
		let zoomFixedPoint = this._currentPosition

		// For a "quick change" (toggle between min = 1 and maxZoomFactor value)
		if (isContinuous === false) {

			// Compute zoom factor
			zoomFactor = (this._zoomFactor !== 1) ? 1 : constants.MAX_ZOOM

			// Compute camera's fixed point
			zoomFixedPoint = this._computeFixedPoint(touchPoint, viewportRect)

		} else {
			if (!delta && !multiplier) {
				return
			}

			// Compute zoom factor
			if (delta) {
				const { height } = viewportRect
				const zoomSensitivity = constants.ZOOM_SENSITIVITY / height
				zoomFactor = Math.min(Math.max(this._zoomFactor - delta * zoomSensitivity, 1),
					constants.MAX_ZOOM)
			} else {
				zoomFactor = this._zoomFactor * multiplier
			}

			// Compute camera's fixed point (only update it if the touch point has changed)
			zoomFixedPoint = (touchPoint !== this._zoomTouchPoint)
				? this._computeFixedPoint(touchPoint, viewportRect)
				: this._currentPosition

			this._zoomTouchPoint = touchPoint
		}

		// Compute zoomChange difference now, before setting the new zoomFactor
		const zoomChange = zoomFactor - this._zoomFactor

		this._setZoomFactorAndUpdateBounds(zoomFactor, zoomFixedPoint)

		this._updatePositionAndProgressOnZoomChange(zoomChange, zoomFixedPoint)
	}

	_computeFixedPoint(point, viewportRect) {
		const {
			x, y, width, height,
		} = viewportRect

		// Express the point's coordinates in the non-scaled (i.e. non-zoomed) referential
		// centered on the scene container's center (from which resources are positioned)
		const topLeftCameraPointInSceneReferential = {
			x: this._currentPosition.x - width / 2,
			y: this._currentPosition.y - height / 2,
		} // Reminder: this._currentPosition is the opposite of the position of the scene's container

		const fixedPoint = {
			x: (topLeftCameraPointInSceneReferential.x + point.x - x) / this._zoomFactor,
			y: (topLeftCameraPointInSceneReferential.y + point.y - y) / this._zoomFactor,
		}

		return fixedPoint
	}

	_updatePositionAndProgressOnZoomChange(zoomChange, zoomFixedPoint) {
		// Change currentPosition so that zoomFixedPoint remains visually fixed
		const position = {
			x: Math.min(Math.max(this._currentPosition.x + zoomChange * zoomFixedPoint.x,
				this._minX), this._maxX),
			y: Math.min(Math.max(this._currentPosition.y + zoomChange * zoomFixedPoint.y,
				this._minY), this._maxY),
		}
		this._setPosition(position)

		// Update progress to conform to that new position
		const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
			&& this._isPaginationSticky === true)
		this._updateProgressForPosition(this._currentPosition, shouldStoreLastNonTemporaryProgress)

		// If reverting to normal zoomFactor=1 value when overflow=paginated, snap to closest snap point
		if (this._hasSpaceToMove === true
			&& this._zoomFactor === 1 && this._overflow === "paginated") {
			const isTheResultOfADragEnd = false
			this._moveToClosestSnapPoint(isTheResultOfADragEnd)
		}
	}

	moveToNextSnapPoint() {
		if (this.isAutoScrolling === true) {
			const { startProgress, targetProgress } = this._jumpData
			const isJumpGoingForward = (targetProgress - startProgress >= 0)
			if (isJumpGoingForward === true) {
				this._jumpData.shouldForceToEnd = true
				return
			}
		}
		const allowsSameProgress = false
		const targetProgress = this._getNextSnapPointProgress(allowsSameProgress, this._progress)
		if (targetProgress === null) {
			return
		}
		const isUpdate = false
		this._startSnapPointJump(targetProgress, isUpdate)
	}

	moveToPreviousSnapPoint() {
		if (this.isAutoScrolling === true) {
			const { startProgress, targetProgress } = this._jumpData
			const isJumpGoingForward = (targetProgress - startProgress >= 0)
			if (isJumpGoingForward === false) {
				this._jumpData.shouldForceToEnd = true
				return
			}
		}
		const allowsSameProgress = false
		const targetProgress = this._getPreviousSnapPointProgress(allowsSameProgress, this._progress)
		if (targetProgress === null) {
			return
		}
		const isUpdate = false
		this._startSnapPointJump(targetProgress, isUpdate)
	}

	_startSnapPointJump(targetProgress, isUpdate = false) {
		this._jumpData.isAutoScrolling = true
		this._jumpData.startDate = Date.now()
		this._jumpData.duration = this._getJumpDuration(this._progress, targetProgress)
		this._jumpData.startProgress = this._progress
		this._jumpData.targetProgress = targetProgress

		// If a jump was not under way, start one
		if (isUpdate === false) {
			requestAnimationFrame(this._autoProgress.bind(this))
		}
	}

	_getJumpDuration(startProgress, targetProgress) {
		if (this._distanceToCover === 0) {
			return 0
		}
		const distance = Math.abs((targetProgress - startProgress) * this._distanceToCover)
		const duration = (this._isPaginationSticky === true)
			? distance / this._stickyMoveSpeed
			: distance / this._snapJumpSpeed
		return duration
	}

	_autoProgress() {
		if (this.isAutoScrolling === false) {
			return
		}

		const {
			startDate,
			duration,
			startProgress,
			targetProgress,
			shouldForceToEnd,
			endCallback,
		} = this._jumpData

		const percent = (Date.now() - startDate) / (duration || 1)

		const shouldUpdatePosition = true

		if (duration === 0 || percent >= 1 || shouldForceToEnd === true) {
			this.setProgress(targetProgress, shouldUpdatePosition)
			this._reset()
			if (endCallback) {
				endCallback()
			}

		} else {
			let forcedProgress = startProgress + (targetProgress - startProgress) * percent
			forcedProgress = Math.min(Math.max(forcedProgress, 0), 1)
			this.setProgress(forcedProgress, shouldUpdatePosition)
			requestAnimationFrame(this._autoProgress.bind(this))
		}
	}

	attemptStickyStep() {
		if (this._hasSpaceToMove === false || this.isZoomed === true) {
			return false
		}
		const isTheResultOfADragEnd = true
		this._moveToClosestSnapPoint(isTheResultOfADragEnd)
		return true
	}

	attemptToMoveSideways(way) {
		if (this._allowsPaginatedScroll === false && this._overflow === "scrolled") {
			return false
		}
		const { viewportRect } = this._player
		const { width, height } = viewportRect
		const currentPosition = { ...this._currentPosition }
		switch (way) {
		case "left":
			if (currentPosition.x > this._camCenter.x.p0 + constants.POSSIBLE_PIXEL_ERROR) {
				currentPosition.x = Math.max(this._camCenter.x.p0, currentPosition.x - width)
			}
			break
		case "right":
			if (currentPosition.x < this._camCenter.x.p1 - constants.POSSIBLE_PIXEL_ERROR) {
				currentPosition.x = Math.min(this._camCenter.x.p1, currentPosition.x + width)
			}
			break
		case "up":
			if (currentPosition.y > this._camCenter.y.p0 + constants.POSSIBLE_PIXEL_ERROR) {
				currentPosition.y = Math.max(this._camCenter.y.p0, currentPosition.y - height)
			}
			break
		case "down":
			if (currentPosition.y < this._camCenter.y.p1 - constants.POSSIBLE_PIXEL_ERROR) {
				currentPosition.y = Math.min(this._camCenter.y.p1, currentPosition.y + height)
			}
			break
		default:
			return false
		}
		if (currentPosition.x !== this._currentPosition.x
			|| currentPosition.y !== this._currentPosition.y) {
			this._setPosition(currentPosition)
			return true
		}
		return false
	}

	// Apply the amount of user scrolling to the scene container's position via the camera
	// by computing what new progress value the delta corresponds to
	handleScroll(scrollData, isWheelScroll) {
		if (this._hasSpaceToMove === false
			|| (this.isZoomed === false && (this._overflow === "paginated"
				&& (this._isPaginationSticky === false || isWheelScroll === true)))) {
			return false
		}

		const { deltaX, deltaY } = scrollData
		const currentPosition = { ...this._currentPosition }

		// Entirely disallow sideways scroll for a sideways gesture when pagination should be sticky
		if (this.isZoomed === false && this._overflow === "paginated"
			&& this._isPaginationSticky === true) {
			if (this._camCenter.x.isPrimaryAxis === true) {
				currentPosition.x -= deltaX
			} else {
				currentPosition.y -= deltaY
			}
		} else {
			currentPosition.x -= deltaX
			currentPosition.y -= deltaY
		}

		currentPosition.x = Math.min(Math.max(currentPosition.x, this._minX), this._maxX)
		currentPosition.y = Math.min(Math.max(currentPosition.y, this._minY), this._maxY)
		this._setPosition(currentPosition)

		const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
			&& this._isPaginationSticky === true)
		this._updateProgressForPosition(this._currentPosition, shouldStoreLastNonTemporaryProgress)

		// What images are visible?

		return true
	}

	// Used in a goTo
	moveToSegmentIndex(pageSegmentIndex, isGoingForward) {
		// If the scene is not larger than the viewport, just display it
		if (this._hasSpaceToMove === false) {
			return
		}

		// If a pageSegmentIndex is specified and progress is defined,
		// then get the progress value to which the segment corresponds
		if (pageSegmentIndex !== null && this._progress !== null) {
			const progress = this._getProgressForSegmentIndex(pageSegmentIndex)
			const shouldUpdatePosition = true
			this.setProgress(progress, shouldUpdatePosition)

		// Otherwise just go to the start or end of the scene
		} else {
			this.moveToStartOrEnd(isGoingForward)
		}
	}

	_getProgressForSegmentIndex(pageSegmentIndex) {
		// The progress value is computed for the "start" viewport point in the case
		// the inScrollDirection is ltr or btt, and for the "end" point otherwise
		const point = {
			pageSegmentIndex,
			viewport: "start",
			x: 0,
			y: 0,
			unit: "%",
		}
		const progress = this._getProgressForPoint(point)
		return progress
	}

	moveToStartOrEnd(isGoingForward = true) {
		if (this._distanceToCover === 0) {
			return
		}

		this._reset()
		const progress = (isGoingForward === true) ? 0 : 1
		const shouldUpdatePosition = true
		this.setProgress(progress, shouldUpdatePosition)

		if (isGoingForward === true) {
			this._signedPercent = 0
		} else {
			this._signedPercent = (this._inScrollDirection === "rtl"
				|| this._inScrollDirection === "btt")
				? -1
				: 1
		}
	}

	getCurrentHref() {
		if (this._virtualPoint) {
			return this._virtualPoint.href
		}
		if (this._segmentsInfoArray.length > 0 && this._segmentsInfoArray[0]) {
			return this._segmentsInfoArray[0].href
		}
		return null
	}

}