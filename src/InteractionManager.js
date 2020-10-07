import * as Hammer from "hammerjs"

import * as Utils from "./utils"
import * as constants from "./constants"

export default class InteractionManager {

	constructor(player, rootElement) {
		this._player = player // Useful only to get viewportRect below
		this._rootElement = rootElement

		// Create Hammer object to handle user gestures
		this._mc = new Hammer.Manager(rootElement)

		// Implement single and double tap detection
		const singleTap = new Hammer.Tap({ event: "singletap" })
		const doubleTap = new Hammer.Tap({ event: "doubletap", taps: 2 })
		this._mc.add([doubleTap, singleTap])
		singleTap.requireFailure(doubleTap)
		doubleTap.recognizeWith(singleTap)

		// Only finalize the implementation of single tap detection at this stage
		this._handleSingleTap = this._handleSingleTap.bind(this)
		this._mc.on("singletap", this._handleSingleTap)

		this._pageNavigator = null
		this._doOnCenterTap = null
		this._percentFunction = null // For (non-wheel scroll) viewport drags
		this._initialTouchPoint = null // For non-wheel scroll zoom
		this._lastScrollEvent = null // For non-wheel scroll in general
		this._wasLastEventPanend = false // For (non-wheel scroll) viewport drags
	}

	_handleSingleTap(e) {
		// If story not loaded yet, only allow a center tap
		if (!this._pageNavigator) {
			if (this._doOnCenterTap) {
				this._doOnCenterTap()
			}
			return
		}

		const { viewportRect } = this._player
		const {
			x, y, width, height,
		} = this._rootElement.getBoundingClientRect()

		// Get coordinates of the canvas' origin in _rootElement
		const topLeftCanvasPoint = {
			x: (width - viewportRect.width) / 2,
			y: (height - viewportRect.height) / 2,
		}

		// Compute the reference lengths used for checking what viewport zone a hit lies in
		const { referencePercent } = constants
		const referenceXLength = topLeftCanvasPoint.x + viewportRect.width * referencePercent
		const referenceYLength = topLeftCanvasPoint.y + viewportRect.height * referencePercent

		const hitPointer = e.center
		const hitX = hitPointer.x - x
		const hitY = hitPointer.y - y

		// Based on the PageNavigator's direction and where in the window the user tap lied in,
		// decide whether the tap was a forward, center or backward tap
		this._handleDiscontinuousGesture(true, (hitX >= width - referenceXLength),
			(hitX <= referenceXLength), (hitY >= height - referenceYLength),
			(hitY <= referenceYLength), this._doOnCenterTap)
	}

	_handleDiscontinuousGesture(expression, goRightIntentExpression, goLeftIntentExpression,
		goDownIntentExpression, goUpIntentExpression, doOtherwise = null) {
		if (!this._pageNavigator) {
			return
		}

		const { currentPage } = this._pageNavigator
		const { hitZoneToPrevious, hitZoneToNext } = currentPage || {}

		let { goForward, goBackward } = this._pageNavigator
		goForward = goForward.bind(this._pageNavigator)
		goBackward = goBackward.bind(this._pageNavigator)

		if ((expression === goRightIntentExpression && hitZoneToNext === "right")
			|| (expression === goLeftIntentExpression && hitZoneToNext === "left")
			|| (expression === goDownIntentExpression && hitZoneToNext === "bottom")
			|| (expression === goUpIntentExpression && hitZoneToNext === "top")) {
			goForward()
		} else if ((expression === goRightIntentExpression && hitZoneToPrevious === "right")
			|| (expression === goLeftIntentExpression && hitZoneToPrevious === "left")
			|| (expression === goDownIntentExpression && hitZoneToPrevious === "bottom")
			|| (expression === goUpIntentExpression && hitZoneToPrevious === "top")) {
			goBackward()
		} else if (doOtherwise) {
			doOtherwise()
		}
	}

	setStoryInteractions(options) {
		const {
			doOnCenterTap,
			allowsZoom,
			allowsSwipe,
			allowsWheelScroll,
			isPaginationSticky,
		} = options
		this._doOnCenterTap = doOnCenterTap
		this._allowsZoom = (allowsZoom === true || allowsZoom === false)
			? allowsZoom
			: constants.defaultAllowsZoom
		this._allowsSwipe = (allowsSwipe === true || allowsSwipe === false)
			? allowsSwipe
			: constants.defaultAllowsSwipe
		this._allowsWheelScroll = (allowsWheelScroll === true || allowsWheelScroll === false)
			? allowsWheelScroll
			: constants.defaultAllowsWheelScroll
		this._isPaginationSticky = (isPaginationSticky === true || isPaginationSticky === false)
			? isPaginationSticky
			: constants.defaultIsPaginationSticky
	}

	setPageNavigator(pageNavigator) {
		if (!pageNavigator) {
			return
		}

		// If this is a pageNavigator change, no need to recreate gesture handlers
		if (this._pageNavigator) {
			this._pageNavigator = pageNavigator
			return
		}

		// The first time a pageNavigator is set however, gesture handlers neet to be set up

		this._pageNavigator = pageNavigator

		// Implement key press handling
		this._handleKeyUp = this._handleKeyUp.bind(this)
		window.addEventListener("keyup", this._handleKeyUp)

		// Implement zoom handling if relevant

		if (this._allowsZoom === true) {

			// Finalize the implementation of double tap detection
			this._handleDoubleTap = this._handleDoubleTap.bind(this)
			this._mc.on("doubletap", this._handleDoubleTap)

			// Implement pinch detection for touch devices
			const pinch = new Hammer.Pinch()
			this._mc.add(pinch)
			this._handlePinch = this._handlePinch.bind(this)
			this._mc.on("pinch", this._handlePinch)

			// Zooming will also be possible via ctrl/alt + scroll
		}

		// Implement swipe detection if relevant
		if (this._allowsSwipe === true) {
			const swipe = new Hammer.Swipe({
				direction: Hammer.DIRECTION_ALL,
				velocity: 0.3, // Default value is 0.3
			})
			this._mc.add(swipe)
			this._handleSwipe = this._handleSwipe.bind(this)
			this._mc.on("swipeleft swiperight swipeup swipedown", this._handleSwipe)
		}

		// Implement non-wheel (= pan) scroll detection

		const pan = new Hammer.Pan({ direction: Hammer.DIRECTION_ALL })
		this._mc.add(pan)
		this._onNonWheelScroll = this._onNonWheelScroll.bind(this)
		this._mc.on("panleft panright panup pandown panend", this._onNonWheelScroll)

		// Implement wheel scroll detection if relevant
		if (this._allowsWheelScroll === true) {
			this._onWheelScroll = this._onWheelScroll.bind(this)
			this._rootElement.addEventListener("wheel", this._onWheelScroll)
		}

		// Reset scroll (works for both wheel and non-wheel scroll)
		this._resetScroll()
	}

	// Double tap is used to trigger the "quick change" zoom (switching zoomFactor at once
	// between the values of 1 and maxZoomFactor - the value defined in constants.js)
	_handleDoubleTap(e) {
		if (!this._pageNavigator) {
			return
		}
		const touchPoint = e.center
		const zoomData = { isContinuous: false, touchPoint }
		this._pageNavigator.zoom(zoomData)
	}

	_handlePinch(e) {
		if (!this._pageNavigator) {
			return
		}
		if (e.type === "pinchend") {
			this._lastDistance = null
		} else {
			const { viewportRect } = this._player
			const pointers = [
				{ x: viewportRect.width / 2, y: viewportRect.height / 2 },
				{ x: e.center.x, y: e.center.y },
			]
			const distance = Utils.getDistance(pointers[0], pointers[1])
			if (!this._lastDistance) {
				this._lastDistance = distance
			} else if (this._lastDistance > 0) {
				const touchPoint = {
					x: (pointers[0].x + pointers[1].x) / 2,
					y: (pointers[0].y + pointers[1].y) / 2,
				}
				const zoomData = {
					isContinuous: true,
					touchPoint,
					multiplier: distance / this._lastDistance,
				}
				this._pageNavigator.zoom(zoomData)
				this._lastDistance = distance
			}
		}
	}

	_handleKeyUp(e) {
		this._handleDiscontinuousGesture(e.code, "ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp")
	}

	_handleSwipe(e) {
		this._handleDiscontinuousGesture(e.type, "swipeleft", "swiperight", "swipeup", "swipedown")
	}

	// For touch-device and mouse click-and-drag scroll events
	_onNonWheelScroll(e) {
		requestAnimationFrame(() => {
			if (!this._pageNavigator) {
				return
			}
			const {
				srcEvent,
				type,
				center,
				deltaX,
				deltaY,
			} = e

			// For a zoom non-wheel scroll (i.e. ctrl/alt + non-wheel scroll)
			if ((srcEvent.ctrlKey || srcEvent.altKey) && this._allowsZoom === true) {

				// Store the coordinates of the first touch point of the gesture
				if (!this._initialTouchPoint) {
					this._initialTouchPoint = center
				}

				// If the gesture has finished, reset zoom handling information
				if (type === "panend") {
					this._resetScroll()
					this._initialTouchPoint = null

				// If the gesture is going on, send zoom data to the current page navigator
				} else {
					const zoomData = {
						isContinuous: true,
						touchPoint: this._initialTouchPoint,
						delta: deltaY - this._lastScrollEvent.deltaY,
					}
					this._pageNavigator.zoom(zoomData)
					this._lastScrollEvent = e
				}

			// When a non-zoom non-wheel scroll ends
			} else if (type === "panend") {
				// If this event immediately follows a panend, cancel it
				if (this._wasLastEventPanend === true) {
					return
				}

				// Attempt to end a controlled transition; if it fails (because none was currently
				// under way), attempt a sticky page change if possible; if it fails as well (if
				// viewportPercent was not enough), then only trigger a drag end (via _releaseScroll)
				let viewportPercent = this._percentFunction(e.deltaX, e.deltaY)
				viewportPercent = Math.min(Math.max(viewportPercent, -1), 1)

				if (this._pageNavigator.endControlledTransition(viewportPercent) === false
					&& (this._isPaginationSticky === false
					|| this._pageNavigator.attemptStickyStep() === false)) {
					this._releaseScroll(e)
				}

				this._resetScroll()
				this._wasLastEventPanend = true

			// For normal non-wheel scroll
			} else {
				const { currentPage } = this._pageNavigator
				const { inScrollDirection } = currentPage

				const { viewportRect } = this._player
				const { width, height } = viewportRect
				const { viewportDimensionPercent } = constants

				switch (inScrollDirection) {
				case "ltr":
					this._percentFunction = (dx) => (-dx / (width * viewportDimensionPercent))
					break
				case "rtl":
					this._percentFunction = (dx) => (dx / (width * viewportDimensionPercent))
					break
				case "ttb":
					this._percentFunction = (_, dy) => (-dy / (height * viewportDimensionPercent))
					break
				case "btt":
					this._percentFunction = (_, dy) => (dy / (height * viewportDimensionPercent))
					break
				default:
					break
				}

				const scrollEvent = {
					deltaX: deltaX - this._lastScrollEvent.deltaX,
					deltaY: deltaY - this._lastScrollEvent.deltaY,
					viewportPercent: Math.min(Math.max(this._percentFunction(deltaX, deltaY), -1), 1),
				}
				const isWheelScroll = false
				this._scroll(scrollEvent, isWheelScroll)
				this._lastScrollEvent = e
				this._wasLastEventPanend = false
			}
		})
	}

	_resetScroll() {
		this._lastScrollEvent = {
			deltaX: 0,
			deltaY: 0,
			viewportPercent: 0,
		}
	}

	// Record velocity and timestamp on drag end (i.e. on scroll release)
	_releaseScroll(e) {
		const velocity = {
			x: -e.velocityX * constants.velocityFactor,
			y: -e.velocityY * constants.velocityFactor,
		}
		const releaseDate = Date.now()
		this._autoScroll(velocity, releaseDate, e)
	}

	// Apply kinetic scrolling formula after drag end (i.e. on scroll release)
	_autoScroll(velocity, releaseDate) {
		const elapsedTime = Date.now() - releaseDate
		let deltaX = -velocity.x * Math.exp(-elapsedTime / constants.timeConstant)
		let deltaY = -velocity.y * Math.exp(-elapsedTime / constants.timeConstant)

		// Simple hack to allow for a smoother stop (using half pixels)
		if (Math.abs(deltaX) < 1 || Math.abs(deltaY) < 1) {
			deltaX = Math.round(deltaX * 2) / 2
			deltaY = Math.round(deltaY * 2) / 2
		} else {
			deltaX = Math.round(deltaX)
			deltaY = Math.round(deltaY)
		}
		if (Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5) {
			// On a drag end, viewportPercent information is useless
			this._scroll({ deltaX, deltaY })
			requestAnimationFrame(this._autoScroll.bind(this, velocity, releaseDate))
		}
	}

	// Apply scroll to the current page via the pageNavigator
	_scroll(e, isWheelScroll) {
		if (!this._pageNavigator) {
			return
		}
		const { deltaX, deltaY, viewportPercent } = e
		this._pageNavigator.handleScroll({ deltaX, deltaY, viewportPercent }, isWheelScroll)
	}

	// For mouse and trackpad scroll events
	_onWheelScroll(e) {
		e.preventDefault()
		requestAnimationFrame(() => {
			if (!this._pageNavigator) {
				return
			}
			if (e.ctrlKey || e.altKey) {
				const zoomData = {
					isContinuous: true,
					touchPoint: { x: e.x, y: e.y },
					delta: e.deltaY,
				}
				this._pageNavigator.zoom(zoomData)
			} else {
				// There is no end to a wheel event, so no viewportPercent information
				// can be constructed to attempt a sticky page change
				const isWheelScroll = true
				this._scroll({ deltaX: -e.deltaX, deltaY: -e.deltaY }, isWheelScroll)
			}
		})
	}

	// For button hits

	goRight() {
		this._handleDiscontinuousGesture(true, true, false, false, false)
	}

	goLeft() {
		this._handleDiscontinuousGesture(true, false, true, false, false)
	}

	goDown() {
		this._handleDiscontinuousGesture(true, false, false, true, false)
	}

	goUp() {
		this._handleDiscontinuousGesture(true, false, false, false, true)
	}

	// Remove all event listeners on destroy
	destroy() {
		this._mc.off("singletap", this._handleSingleTap)
		this._mc.off("doubletap", this._handleDoubleTap)
		this._mc.off("pinch", this._handlePinch)
		this._mc.off("swipeleft swiperight swipeup swipedown", this._handleSwipe)
		this._mc.off("panleft panright panup pandown panend", this._onNonWheelScroll)
		this._rootElement.removeEventListener("wheel", this._onWheelScroll)
		window.removeEventListener("keyup", this._handleKeyUp)
	}

}