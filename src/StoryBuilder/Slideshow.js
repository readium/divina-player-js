import PageNavigator from "./PageNavigator"

export default class Slideshow extends PageNavigator {

	constructor(type, metadata, pageLayersArray, player) {
		super(type, metadata, pageLayersArray, player)

		const { direction } = metadata || {}
		this._direction = direction

		this._pagesArray.forEach((page) => {
			page.setDirection(direction)
		})
	}

	go(way, shouldGoToTheMax) {
		if (!this._direction
			|| ((way === "right" || way === "left")
				&& (this._direction === "ttb" || this._direction === "btt"))
			|| ((way === "down" || way === "up")
				&& (this._direction === "rtl" || this._direction === "ltr"))) {
			return
		}

		if (shouldGoToTheMax === true) {
			let targetPageIndex = null
			if (way === "right" || way === "down") {
				targetPageIndex = (this._direction === "ltr"
					|| this._direction === "ttb")
					? this._pagesArray.length - 1
					: 0
			} else if (way === "left" || way === "up") {
				targetPageIndex = (this._direction === "rtl"
					|| this._direction === "btt")
					? this._pagesArray.length - 1
					: 0
			}
			if (targetPageIndex !== null) {
				const shouldCancelTransition = true
				if (targetPageIndex !== this.pageIndex) {
					this.goToPageWithIndex(targetPageIndex, null, shouldCancelTransition)
				} else {
					this.goToPageWithIndex(targetPageIndex, 0, shouldCancelTransition)
				}
			}
		} else {
			switch (way) {
			case "right":
				this._interactionManager.goRight()
				break
			case "left":
				this._interactionManager.goLeft()
				break
			case "down":
				this._interactionManager.goDown()
				break
			case "up":
				this._interactionManager.goUp()
				break
			default:
				break
			}
		}
	}

	goForward() {
		const doIfIsUndergoingChanges = () => { this.attemptToGoForward(true) }
		this.attemptToGoForward(false, doIfIsUndergoingChanges)
	}

	goBackward() {
		const doIfIsUndergoingChanges = () => { this.attemptToGoBackward(true) }
		this.attemptToGoBackward(false, doIfIsUndergoingChanges)
	}

}