import PageNavigator from "./PageNavigator"

export default class Slideshow extends PageNavigator {

	constructor(pageNavType, metadata, pageLayersArray, player) {
		super(pageNavType, metadata, pageLayersArray, player)

		const { direction } = metadata || {}
		if (direction) {
			this._setDirection(direction)
		}
	}

	_setDirection(direction) {
		this._direction = direction

		this.layersArray.forEach((layer) => {
			const page = layer.content
			page.setInScrollDirection(direction)

			switch (direction) {
			case "ltr":
				page.setHitZoneToPrevious("left")
				page.setHitZoneToNext("right")
				page.setSecondaryAxis("y")
				break
			case "rtl":
				page.setHitZoneToPrevious("right")
				page.setHitZoneToNext("left")
				page.setSecondaryAxis("y")
				break
			case "ttb":
				page.setHitZoneToPrevious("top")
				page.setHitZoneToNext("bottom")
				page.setSecondaryAxis("x")
				break
			case "btt":
				page.setHitZoneToPrevious("bottom")
				page.setHitZoneToNext("top")
				page.setSecondaryAxis("x")
				break
			default:
				break
			}
		})
	}

	go(way, shouldGoToMax) {
		if (!this._direction
			|| ((way === "right" || way === "left")
				&& (this._direction === "ttb" || this._direction === "btt"))
			|| ((way === "down" || way === "up")
				&& (this._direction === "rtl" || this._direction === "ltr"))) {
			return
		}

		if (shouldGoToMax === true) {
			let targetPageIndex = 0
			let targetPageSegmentIndex = 0
			if (((way === "right" || way === "down")
				&& (this._direction === "ltr" || this._direction === "ttb"))
				|| ((way === "left" || way === "up")
					&& (this._direction === "rtl" || this._direction === "btt"))) {
				targetPageIndex = this.nbOfPages - 1
				targetPageSegmentIndex = this.getLastPageSegmentIndexForPage(targetPageIndex)
			}
			if (targetPageIndex >= 0) {
				let targetSegmentIndex = this.getIndexOfFirstSegmentInPage(targetPageIndex)
				targetSegmentIndex += targetPageSegmentIndex
				this.updateLoadTasks(targetPageIndex, targetSegmentIndex)

				const shouldSkipTransition = true
				const progress = ((way === "right" && this._direction === "ltr")
					|| (way === "left" && this._direction === "rtl")
					|| (way === "down" && this._direction === "ttb")
					|| (way === "up" && this._direction === "btt"))
					? 1
					: 0
				this.goToPageWithIndex(targetPageIndex, targetPageSegmentIndex, progress,
					shouldSkipTransition)
			}

		} else {
			switch (way) {
			case "right":
				this.interactionManager.goRight()
				break
			case "left":
				this.interactionManager.goLeft()
				break
			case "down":
				this.interactionManager.goDown()
				break
			case "up":
				this.interactionManager.goUp()
				break
			default:
				break
			}
		}
	}

	goForward() {
		const shouldSkipTransition = false
		this.attemptToGoForward(shouldSkipTransition)
	}

	goBackward() {
		const shouldSkipTransition = false
		this.attemptToGoBackward(shouldSkipTransition)
	}

	goSidewaysIfPossible(way) {
		return this.attemptToGoSideways(way) // A return is needed here (see InteractionManager)
	}

}