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

	constructor(scene, overflow, player) {
		// A scene is just a layerPile (in the divina case, can only be a page)
		this._scene = scene
		this._overflow = overflow
		// Useful for viewportRect and updateDisplayForZoomFactor (and options just below)
		this._player = player

		const { options } = player
		const {
			allowsPaginatedScroll,
			isPaginationSticky,
			isPaginationGridBased,
			doOnScroll,
		} = options
		this._allowsPaginatedScroll = (allowsPaginatedScroll === true
			|| allowsPaginatedScroll === false)
			? allowsPaginatedScroll
			: constants.defaultAllowsPaginatedScroll
		this._isPaginationSticky = (isPaginationSticky === true || isPaginationSticky === false)
			? isPaginationSticky
			: constants.defaultIsPaginationSticky
		this._isPaginationGridBased = (isPaginationGridBased === true
			|| isPaginationGridBased === false)
			? isPaginationGridBased
			: constants.defaultIsPaginationGridBased
		this._doOnScroll = doOnScroll

		this._inScrollDirection = null
		this._relativeStart = null
		this._relativeEnd = null

		// Those values can change on a resize (because of the change in viewportRect) but not with zoom
		// (i.e. the values are those that apply when zoomFactor === 1)
		this._distanceToCover = 0
		this._startPosition = { x: 0, y: 0 } // Camera center position for progress = 0 (or null)
		this._progressVector = { x: 0, y: 0 } // Cam center endPosition = startPosition + progressVector

		// The below values can necessarily change on a resize, but also with a zoom change
		this._progress = null // However if null, progress remains null whatever the zoomFactor
		this._minX = 0 // Minimum value for the camera center's coordinate on the x axis
		this._maxX = 0
		this._minY = 0
		this._maxY = 0
		this._currentPosition = { x: 0, y: 0 } // Camera center in non-scaled/non-zoomed referential
		this._signedPercent = null // Signed % of currentPosition x or y over full scene width or height

		// Add an empty _rawSnapPointsArray to hold the values specified in the original linkObject
		// A real _snapPointsArray with progress values will later be computed if needed
		// (i.e. if the scene is larger than the viewport, which should be checked after each resize)
		this._rawSnapPointsArray = []
		this._snapPointsArray = null
		this._reset()
		this._possibleError = 0
		this._paginationProgressStep = null
		this._lastNonTemporaryProgress = null
		this._virtualPointInfo = {}

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
		this._setVirtualPointInfo(inScrollDirection)
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

	_setVirtualPointInfo(inScrollDirection) {
		let getPercent = null
		let referenceDimension = null
		let coord = null
		let worksBackward = false

		switch (inScrollDirection) {
		case "ltr":
			getPercent = () => (
				(this._currentPosition.x - this._minX) / (this._maxX - this._minX)
			)
			referenceDimension = "width"
			coord = "x"
			worksBackward = false
			break
		case "rtl":
			getPercent = () => (
				(this._maxX - this._currentPosition.x) / (this._maxX - this._minX)
			)
			referenceDimension = "width"
			coord = "x"
			worksBackward = true
			break
		case "ttb":
			getPercent = () => (
				(this._currentPosition.y - this._minY) / (this._maxY - this._minY)
			)
			referenceDimension = "height"
			coord = "y"
			worksBackward = false
			break
		case "btt":
			getPercent = () => (
				(this._maxY - this._currentPosition.y) / (this._maxY - this._minY)
			)
			referenceDimension = "height"
			coord = "y"
			worksBackward = true
			break
		default:
			break
		}

		this._virtualPointInfo = {
			getPercent, referenceDimension, coord, worksBackward,
		}
	}

	addSnapPoints(snapPointsArray, lastSegmentIndex) {
		snapPointsArray.forEach((snapPointInfo) => {
			const { viewport, x, y } = snapPointInfo
			if ((viewport === "start" || viewport === "center" || viewport === "end")
				&& (x !== null || y !== null)) {
				const snapPoint = {
					segmentIndex: lastSegmentIndex,
					viewport,
					x,
					y,
				}
				this._rawSnapPointsArray.push(snapPoint)
			}
		})
	}

	// After an overflowHandler's _positionSegments() operation, so in particular after a resize:
	// - If the total length of all segments together is less than the viewport dimension,
	// then the camera will not have space to move (but beware: only if zoomFactor = 1),
	// so the camera's start and end positions will be set to the center of the whole segment block
	// - If not, _hasSpaceToMove = true and there is no need to move the camera initially,
	// since it is already well positioned respective to the first segment
	// (Also, do note that small pixel errors are accounted for!)
	setBoundsAndUpdateOnResize() {
		let distanceToCover = 0
		let startCenter = null

		const { viewportRect } = this._player
		const { width, height } = viewportRect
		this._startPosition = { x: 0, y: 0 }
		this._progressVector = { x: 0, y: 0 }

		this._referenceSceneSize = {
			width: this._scene.size.width,
			height: this._scene.size.height,
		}

		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			const sceneContainerWidth = this._scene.size.width
			distanceToCover = sceneContainerWidth - width
			const signFactor = (this._inScrollDirection === "rtl") ? -1 : 1
			if (distanceToCover <= constants.possiblePixelError) {
				distanceToCover = 0
				startCenter = signFactor * (sceneContainerWidth / 2)
			} else {
				startCenter = signFactor * (width / 2)
			}
			this._startPosition.x = startCenter
			this._progressVector.x = signFactor * distanceToCover

		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
			const sceneContainerHeight = this._scene.size.height
			distanceToCover = sceneContainerHeight - height
			const signFactor = (this._inScrollDirection === "btt") ? -1 : 1
			if (distanceToCover <= constants.possiblePixelError) {
				distanceToCover = 0
				startCenter = signFactor * (sceneContainerHeight / 2)
			} else {
				startCenter = signFactor * (height / 2)
			}
			this._startPosition.y = startCenter
			this._progressVector.y = signFactor * distanceToCover
		}
		this._distanceToCover = Math.max(distanceToCover, 0)

		// Now if the page is larger than the effective viewport...
		if (this._distanceToCover > 0) {

			// Compute the possible error for progress calculations
			this._possibleError = this._getProgressStepForLength(constants.possiblePixelError)

			// Compute the progress delta corresponding to one pagination step forward
			this._paginationProgressStep = this._getPaginationProgressStep()

			// Build snap points (i.e. define their progress values), if relevant
			this._buildRelevantSnapPoints()
		}

		const callback = () => {
			// Force zoomFactor to 1 and recompute x and y bounds
			this._setZoomFactorAndUpdateBounds(1)

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

	// Build relevant snap points by adding a progress value to their raw information
	_buildRelevantSnapPoints() {
		const snapPointsArray = []
		let lastProgress = -1
		this._rawSnapPointsArray.forEach((rawSnapPoint) => {
			const progress = this._getProgressForSnapPoint(rawSnapPoint)
			if (progress !== null && progress > lastProgress) {
				const snapPoint = { ...rawSnapPoint, progress }
				snapPointsArray.push(snapPoint)
				lastProgress = progress
			}
		})
		this._snapPointsArray = snapPointsArray
	}

	_getProgressForSnapPoint(rawSnapPoint) {
		const {
			segmentIndex,
			viewport,
			x,
			y,
		} = rawSnapPoint
		const segment = this._scene.layersArray[segmentIndex].content
		const { size, positionInSegmentLine } = segment

		// Get the top left position of the camera for the snap point alignment
		const position = this._getCameraPositionInSegmentForAlignment(viewport, { x, y }, size)
		if (!position) {
			return null
		}
		// Update the position based on the segment's position in the scene
		position.x += positionInSegmentLine.x
		position.y += positionInSegmentLine.y

		// Compute the distance from the scene container's start point to that new point
		const distanceToCenter = Utils.getDistance(this._startPosition, position)
		// Convert that value into an acceptable progress value (between 0 and 1)
		let progress = null
		if (distanceToCenter < constants.possiblePixelError) {
			progress = 0
		} else if (Math.abs(this._distanceToCover - distanceToCenter) < constants.possiblePixelError) {
			progress = 1
		} else {
			progress = Math.min(Math.max(distanceToCenter / this._distanceToCover, 0), 1)
		}

		return progress
	}

	// Get the position of the camera's top left point corresponding to a given snap point alignment
	_getCameraPositionInSegmentForAlignment(viewportPoint, coords, segmentSize) {
		const sign = (this._inScrollDirection === "rtl" || this._inScrollDirection === "btt") ? -1 : 1
		const x = Utils.parseCoordinate(coords.x, segmentSize.width)
		const y = Utils.parseCoordinate(coords.y, segmentSize.height)
		if (x === null || y === null) {
			return null
		}

		const { viewportRect } = this._player
		const { width, height } = viewportRect
		const position = {
			x: sign * x,
			y: sign * y,
		}
		switch (viewportPoint) {
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
		this._zoomFactor = Math.min(Math.max(zoomFactor, 1), constants.maxZoomFactor)
		this._scene.setScale(this._zoomFactor) // Reminder: this._scene is a Container

		this._player.updateDisplayForZoomFactor(zoomFactor)

		this._updateMinAndMaxX()
		this._updateMinAndMaxY()
		this._updateOffsetInScaledReferential()
	}

	_updateMinAndMaxX() {
		const { rootSize, viewportRect } = this._player
		const { width } = viewportRect

		const tippingZoomFactorValue = width / this._referenceSceneSize.width

		if (this._inScrollDirection === "ltr") {
			// Reminder: this._startPosition.x does not change
			// And = this._referenceSceneSize.width / 2 if this._referenceSceneSize.width < width
			if (this._zoomFactor < tippingZoomFactorValue) {
				const k = (this._zoomFactor - 1) / (tippingZoomFactorValue - 1)
				this._minX = this._startPosition.x + k * (width / 2 - this._startPosition.x)
				this._maxX = this._minX
			} else {
				this._minX = width / 2
				this._maxX = this._minX + this._referenceSceneSize.width * this._zoomFactor - width
			}
		} else if (this._inScrollDirection === "rtl") {
			if (this._zoomFactor < tippingZoomFactorValue) {
				const k = (this._zoomFactor - 1) / (tippingZoomFactorValue - 1)
				this._maxX = this._startPosition.x - k * (width / 2 + this._startPosition.x)
				this._minX = this._maxX
			} else {
				this._maxX = -width / 2
				this._minX = this._maxX - this._referenceSceneSize.width * this._zoomFactor + width
			}
		} else {
			const sizeDiff = this._referenceSceneSize.width * this._zoomFactor - rootSize.width
			const delta = (sizeDiff > 0) ? sizeDiff / 2 : 0
			this._minX = this._startPosition.x - delta
			this._maxX = this._startPosition.x + delta
		}
	}

	_updateMinAndMaxY() {
		const { rootSize, viewportRect } = this._player
		const { height } = viewportRect

		const tippingZoomFactorValue = height / this._referenceSceneSize.height

		if (this._inScrollDirection === "ttb") {
			if (this._zoomFactor < tippingZoomFactorValue) {
				const k = (this._zoomFactor - 1) / (tippingZoomFactorValue - 1)
				this._minY = this._startPosition.y + k * (height / 2 - this._startPosition.y)
				this._maxY = this._minY
			} else {
				this._minY = height / 2
				this._maxY = this._minY + this._referenceSceneSize.height * this._zoomFactor - height
			}
		} else if (this._inScrollDirection === "btt") {
			if (this._zoomFactor < tippingZoomFactorValue) {
				const k = (this._zoomFactor - 1) / (tippingZoomFactorValue - 1)
				this._maxY = this._startPosition.y - k * (height / 2 + this._startPosition.y)
				this._minY = this._maxY
			} else {
				this._maxY = -height / 2
				this._minY = this._maxY - this._referenceSceneSize.height * this._zoomFactor + height
			}
		} else {
			const sizeDiff = this._referenceSceneSize.height * this._zoomFactor - rootSize.height
			const delta = (sizeDiff > 0) ? sizeDiff / 2 : 0
			this._minY = this._startPosition.y - delta
			this._maxY = this._startPosition.y + delta
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

	_updatePositionAndProgressOnResize() { // Reminder: this._zoomFactor necessarily is 1
		// If the scene can now entirely fit within the viewport
		if (this._distanceToCover === 0) {

			this._setPosition(this._startPosition)
			this.setProgress(null)

		} else { // Note that progress may have been null before

			// Keep center of camera fixed

			const { width, height } = this._scene.size
			const newPosition = {
				x: Math.min(Math.max(this._signedPercent * width,
					this._minX), this._maxX),
				y: Math.min(Math.max(this._signedPercent * height,
					this._minY), this._maxY),
			}

			if (this._overflow === "scrolled") {
				this._setPosition(newPosition)
			}

			const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
				&& this._isPaginationSticky === true)
			this._updateProgressForPosition(newPosition, shouldStoreLastNonTemporaryProgress)

			if (this._overflow === "paginated" && this.isAutoScrolling === false) {
				const isTheResultOfADragEnd = false
				this._moveToClosestSnapPoint(isTheResultOfADragEnd)
			}

			// Update snap point-related speeds based on inScrollDirection
			if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
				this._snapJumpSpeed = width * constants.snapJumpSpeedFactor
				this._stickyMoveSpeed = width * constants.stickyMoveSpeedFactor
			} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
				this._snapJumpSpeed = height * constants.snapJumpSpeedFactor
				this._stickyMoveSpeed = height * constants.stickyMoveSpeedFactor
			}
		}
	}

	_setPosition({ x, y }) { // Note that x and y correspond to the camera's center position
		this._currentPosition = { x, y }
		this._scene.setPosition({ x: -x, y: -y }) // this._scene is still a Container

		if (this._inScrollDirection === "ltr" || this._inScrollDirection === "rtl") {
			this._signedPercent = x / (this._scene.size.width * this._zoomFactor)
		} else if (this._inScrollDirection === "ttb" || this._inScrollDirection === "btt") {
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
			this._lastNonTemporaryProgress = this._progress
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
		this._progress = p
		this._virtualPoint = this._getVirtualPoint()
		if (this._doOnScroll) {
			this._doOnScroll(this._virtualPoint)
		}
		if (shouldUpdatePosition === false) {
			return
		}
		if (p === null) {
			this._setPosition(this._startPosition)
		} else if (this._inScrollDirection === "ltr") {
			this._setPosition({
				x: this._minX + p * this._progressVector.x * this._zoomFactor,
				y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
			})
		} else if (this._inScrollDirection === "rtl") {
			this._setPosition({
				x: this._maxX + p * this._progressVector.x * this._zoomFactor,
				y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
			})
		} else if (this._inScrollDirection === "ttb") {
			this._setPosition({
				x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
				y: this._minY + p * this._progressVector.y * this._zoomFactor,
			})
		} else if (this._inScrollDirection === "btt") {
			this._setPosition({
				x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
				y: this._maxY + p * this._progressVector.y * this._zoomFactor,
			})
		}
	}

	_getVirtualPoint() {
		if (this._progress === null) {
			return null
		}

		const { viewportRect } = this._player
		const { getPercent, referenceDimension, coord } = this._virtualPointInfo

		const percent = getPercent()

		let i = 0
		let virtualPoint = null
		let remainingDistance = viewportRect[referenceDimension] / 2
		remainingDistance += (coord === "x")
			? (percent * (this._maxX - this._minX))
			: (percent * (this._maxY - this._minY))
		remainingDistance /= this._zoomFactor

		while (i < this._scene.layersArray.length && virtualPoint === null) {
			const segmentLayer = this._scene.layersArray[i]
			const { size } = segmentLayer
			const referenceDistance = size[referenceDimension]
			remainingDistance -= referenceDistance

			if (remainingDistance <= constants.possiblePixelError && referenceDistance > 0) {
				let percentInSegment = (remainingDistance + referenceDistance) / referenceDistance
				percentInSegment = Math.min(Math.max(percentInSegment, 0), 1)
				const { worksBackward } = this._virtualPointInfo
				virtualPoint = {
					segmentIndex: i,
					href: segmentLayer.getFirstHref(),
					[coord]: (worksBackward === true) ? (1 - percentInSegment) : percentInSegment,
					percent,
				}
			}
			i += 1
		}

		return virtualPoint
	}

	setPercent(percent) {
		switch (this._inScrollDirection) {
		case "ltr":
			this._setPosition({
				x: this._minX + percent * (this._maxX - this._minX),
				y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
			})
			break
		case "rtl":
			this._setPosition({
				x: this._maxX - percent * (this._maxX - this._minX),
				y: Math.min(Math.max(this._currentPosition.y, this._minY), this._maxY),
			})
			break
		case "ttb":
			this._setPosition({
				x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
				y: this._minY + percent * (this._maxY - this._minY),
			})
			break
		case "btt":
			this._setPosition({
				x: Math.min(Math.max(this._currentPosition.x, this._minX), this._maxX),
				y: this._maxY - percent * (this._maxY - this._minY),
			})
			break
		default:
			break
		}
		this._updateProgressForPosition()
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
			nextProgress = this._getNextSnapPointProgress(allowsSameProgress)
			previousProgress = this._getPreviousSnapPointProgress(allowsSameProgress)
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
	_getNextSnapPointProgress(allowsSameProgress = false, lastNonTemporaryProgress = null) {
		if (!this._snapPointsArray
			|| (this._overflow === "scrolled" && this._allowsPaginatedScroll === false)) {
			return null
		}

		// If lastNonTemporaryProgress is defined, then a step forward
		// (via a discontinuous gesture or a sticky drag) is under way
		const referenceProgress = (lastNonTemporaryProgress !== null)
			? lastNonTemporaryProgress
			: this._progress
		let i = 0
		while (i < this._snapPointsArray.length
			&& ((allowsSameProgress === true)
				? this._snapPointsArray[i].progress <= referenceProgress + this._possibleError
				: this._snapPointsArray[i].progress < referenceProgress - this._possibleError)) {
			i += 1
		}

		let nextProgress = 1
		if (i < this._snapPointsArray.length) {
			nextProgress = this._snapPointsArray[i].progress
		}

		// Select the closest value between that one and the one corresponding to one pagination away
		if (this._paginationProgressStep) {
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

	// Get the progress value of the previous snap point in the list (0 if there is none)
	_getPreviousSnapPointProgress(allowsSameProgress = false, lastNonTemporaryProgress = null) {
		if (!this._snapPointsArray
			|| (this._overflow === "scrolled" && this._allowsPaginatedScroll === false)) {
			return null
		}

		// If lastNonTemporaryProgress is defined, then a step backward
		// (via a discontinuous gesture or a sticky drag) is under way
		const referenceProgress = (lastNonTemporaryProgress !== null)
			? lastNonTemporaryProgress
			: this._progress
		let i = this._snapPointsArray.length - 1
		while (i >= 0
			&& ((allowsSameProgress === true)
				? this._snapPointsArray[i].progress >= referenceProgress - this._possibleError
				: this._snapPointsArray[i].progress > referenceProgress + this._possibleError)) {
			i -= 1
		}

		let previousProgress = 0
		if (i >= 0) {
			previousProgress = this._snapPointsArray[i].progress
		}

		// Select the closest value between that one and the one corresponding to one pagination away
		if (this._paginationProgressStep) {
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
			zoomFactor = (this._zoomFactor !== 1) ? 1 : constants.maxZoomFactor

			// Compute camera's fixed point
			zoomFixedPoint = this._computeFixedPoint(touchPoint, viewportRect)

		} else {
			if (!delta && !multiplier) {
				return
			}

			// Compute zoom factor
			if (delta) {
				const { height } = viewportRect
				const zoomSensitivity = constants.zoomSensitivityConstant / height
				zoomFactor = Math.min(Math.max(this._zoomFactor - delta * zoomSensitivity, 1),
					constants.maxZoomFactor)
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
		this._setPosition({
			x: Math.min(Math.max(this._currentPosition.x + zoomChange * zoomFixedPoint.x,
				this._minX), this._maxX),
			y: Math.min(Math.max(this._currentPosition.y + zoomChange * zoomFixedPoint.y,
				this._minY), this._maxY),
		})

		// Update progress to conform to that new position
		const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
			&& this._isPaginationSticky === true)
		this._updateProgressForPosition(this._currentPosition, shouldStoreLastNonTemporaryProgress)

		// If reverting to normal zoomFactor=1 value when overflow=paginated, snap to closest snap point
		if (this._zoomFactor === 1 && this._overflow === "paginated") {
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

		const percent = (Date.now() - startDate) / duration

		if (duration === 0 || percent >= 1 || shouldForceToEnd === true) {
			this.setProgress(targetProgress)
			this._reset()
			if (endCallback) {
				endCallback()
			}
		} else {
			let forcedProgress = startProgress + (targetProgress - startProgress) * percent
			forcedProgress = Math.min(Math.max(forcedProgress, 0), 1)
			this.setProgress(forcedProgress)
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

	// Apply the amount of user scrolling to the scene container's position via the camera
	// by computing what new progress value the delta corresponds to
	handleScroll(scrollData, isWheelScroll) {
		if (this._hasSpaceToMove === false
			|| (this.isZoomed === false && (this._overflow === "paginated"
				&& (this._isPaginationSticky === false || isWheelScroll === true)))) {
			return false
		}
		const { deltaX, deltaY } = scrollData
		this._setPosition({
			x: Math.min(Math.max(this._currentPosition.x - deltaX, this._minX), this._maxX),
			y: Math.min(Math.max(this._currentPosition.y - deltaY, this._minY), this._maxY),
		})
		const shouldStoreLastNonTemporaryProgress = (this._overflow === "paginated"
			&& this._isPaginationSticky === true)
		this._updateProgressForPosition(this._currentPosition, shouldStoreLastNonTemporaryProgress)
		return true
	}

	moveToSegmentIndex(segmentIndex, isGoingForward) {
		// If the scene is not larger than the viewport, just display it
		if (this._hasSpaceToMove === false) {
			return
		}
		// If a segmentIndex is specified and progress is defined,
		// then get the progress value to which the segment corresponds
		if (segmentIndex !== null && this._progress !== null) {
			const progress = this._getProgressForSegmentIndex(segmentIndex)
			this.setProgress(progress || 0)
		// Otherwise just go to the start or end of the scene
		} else {
			this.moveToStartOrEnd(isGoingForward)
		}
	}

	_getProgressForSegmentIndex(segmentIndex) {
		// The progress value is computed for the "start" viewport point in the case
		// the inScrollDirection is ltr or btt, and for the "end" point otherwise
		const snapPoint = {
			segmentIndex,
			viewport: "start",
			x: "0%",
			y: "0%",
		}
		const progress = this._getProgressForSnapPoint(snapPoint)
		return progress
	}

	moveToStartOrEnd(isGoingForward = true) {
		if (this._distanceToCover === 0) {
			return
		}

		this._reset()
		this.setProgress((isGoingForward === true) ? 0 : 1)

		if (isGoingForward === true) {
			this._signedPercent = 0
		} else {
			this._signedPercent = (this._inScrollDirection === "rtl"
				|| this._inScrollDirection === "btt")
				? -1
				: 1
		}
	}

}