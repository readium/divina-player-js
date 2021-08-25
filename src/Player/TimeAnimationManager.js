export default class TimeAnimationManager {

	constructor(player) {
		this._player = player
		this._animations = {}

		this._oldPageIndex = null
	}

	// Used in StoryBuilder

	addSoundAnimations(soundAnimations, pageIndex) {
		if (pageIndex === null) { // Global sound animations
			this._animations.global = { isActive: false, soundAnimations }
		} else { // Page sound animations
			if (!this._animations[pageIndex]) {
				this._animations[pageIndex] = { isActive: false }
			}
			this._animations[pageIndex].soundAnimations = soundAnimations
		}
	}

	addSliceAnimation(slice, animation, pageIndex) {
		if (!this._animations[pageIndex]) {
			this._animations[pageIndex] = { isActive: false }
		}
		if (!this._animations[pageIndex].sliceAnimations) {
			this._animations[pageIndex].sliceAnimations = []
		}
		this._animations[pageIndex].sliceAnimations.push({ slice, animation })
	}

	// Used in PageNavigator (on finalizeEntry, i.e. at the end of a page transition)
	initializeAnimations(pageIndex) {
		// Ensure global sound animations are playing
		if (this._animations.global && this._animations.global.isActive === false) {
			this._animations.global.soundAnimations.forEach(({ resourceId }) => {
				const { resourceManager } = this._player
				const resource = resourceManager.getResourceWithId(resourceId)
				if (resource) {
					resource.playIfNeeded()
				}
			})
			this._animations.global.isActive = true
		}

		const audioResourcesToStopSet = this._stopAnimationsAndReturnAudioResources(this._oldPageIndex)

		const { resourceManager } = this._player

		// Now deal with new page animations

		if (this._animations[pageIndex]) {
			this._animations[pageIndex].isActive = true

			const initialDate = Date.now()

			const { soundAnimations, sliceAnimations } = this._animations[pageIndex]

			// Initiate all sound animations
			if (soundAnimations) {
				soundAnimations.forEach((animation) => {
					const { resourceId, start } = animation
					if (audioResourcesToStopSet.has(resourceId) === true && start === 0) {
						audioResourcesToStopSet.delete(resourceId)
					}
					this._runSoundAnimation(pageIndex, animation, initialDate)
				})
			}

			// Initiate all slice animations
			if (sliceAnimations) {
				sliceAnimations.forEach(({ slice, animation }) => {
					this._runSliceAnimation(pageIndex, animation, initialDate, slice)
				})
			}
		}

		// Stop all remaining old sounds
		audioResourcesToStopSet.forEach((resourceId) => {
			const audioResource = resourceManager.getResourceWithId(resourceId)
			if (audioResource) {
				audioResource.resetForPlay()
			}
		})

		this._oldPageIndex = pageIndex
	}

	_stopAnimationsAndReturnAudioResources(pageIndex) {
		const audioResourcesToStopSet = new Set()

		if (pageIndex === null || pageIndex === undefined || !this._animations[pageIndex]) {
			return audioResourcesToStopSet
		}

		this._animations[pageIndex].isActive = false

		const { soundAnimations, sliceAnimations } = this._animations[pageIndex]

		if (soundAnimations) {
			soundAnimations.forEach((animation) => {
				const { raf, resourceId } = animation
				cancelAnimationFrame(raf)
				audioResourcesToStopSet.add(resourceId)
			})
		}

		if (sliceAnimations) {
			sliceAnimations.forEach(({ slice, animation }) => {
				// If the initial value is not defined, then no change has been applied to the slice
				const { raf, variable, initialValue } = animation
				cancelAnimationFrame(raf)
				if (initialValue !== undefined) {
					slice.setVariable(variable, initialValue)
				}
			})
		}

		return audioResourcesToStopSet
	}

	_runSoundAnimation(pageIndex, animation, initialDate) {
		let isFirstPlayInPage = true

		const { resourceId, start, end } = animation
		const { resourceManager } = this._player
		const resource = resourceManager.getResourceWithId(resourceId)
		if (!resource) {
			return
		}

		const loop = () => {
			const { isActive } = this._animations[pageIndex]
			if (isActive === false) {
				return
			}
			const date = Date.now()
			if (date < initialDate + start) { // Before start
				animation.raf = requestAnimationFrame(loop)
			} else if (!end) {
				if (isFirstPlayInPage === true) {
					resource.playIfNeeded()
					isFirstPlayInPage = false
				}
				animation.raf = requestAnimationFrame(loop)
			} else if (date < initialDate + end) {
				if (isFirstPlayInPage === true) {
					resource.playIfNeeded()
					isFirstPlayInPage = false
				}
				animation.raf = requestAnimationFrame(loop)
			} else {
				resource.stopIfNeeded()
			}
		}

		animation.raf = requestAnimationFrame(loop)
	}

	_runSliceAnimation(pageIndex, animation, initialDate, slice) {
		const { variable, keyframesArray } = animation
		if (!keyframesArray || keyframesArray.length <= 1) {
			return
		}
		let lastKeyframe = null // Then: { key, value }
		let keyframeIndex = 0
		let keyframe = keyframesArray[keyframeIndex]
		let { key, value } = keyframe

		const initialValue = slice.getVariable(variable) // Get current value for desired variable
		animation.initialValue = initialValue

		const loop = () => {
			const { isActive } = this._animations[pageIndex]
			if (isActive === false) {
				return
			}
			const date = Date.now()

			if (date < initialDate + key) {

				// Before start (i.e. before first keyframe)
				if (!lastKeyframe) {
					animation.raf = requestAnimationFrame(loop)

				// Between two keyframes (linear easing is assumed)
				} else {
					const duration = key - lastKeyframe.key
					if (duration > 0) {
						const multiplier = (date - lastKeyframe.key - initialDate) / duration
						const currentValue = lastKeyframe.value + (value - lastKeyframe.value) * multiplier
						slice.setVariable(variable, currentValue)
					} else {
						slice.setVariable(variable, value)
					}
					this._player.refreshOnce()
					animation.raf = requestAnimationFrame(loop)
				}

			} else { // Go to next keyframe (if possible)
				slice.setVariable(variable, value)
				this._player.refreshOnce()

				keyframeIndex += 1
				if (keyframeIndex >= keyframesArray.length) {
					return
				}
				lastKeyframe = keyframe
				keyframe = keyframesArray[keyframeIndex]
				key = keyframe.key
				value = keyframe.value

				animation.raf = requestAnimationFrame(loop)
			}
		}

		if (initialValue !== null) {
			animation.raf = requestAnimationFrame(loop)
		}
	}

	// Used in Player, on destroying the player
	destroy() {
		this._stopAnimationsAndReturnAudioResources(this._oldPageIndex)
		this._animations = {}
	}

}