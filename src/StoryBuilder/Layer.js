export default class Layer {

	get type() { return this._type }

	get content() { return this._content } // A Container in any case

	get entryForward() { return this._entryForward }

	get exitForward() { return this._exitForward }

	get entryBackward() { return this._entryBackward }

	get exitBackward() { return this._exitBackward }

	get loadStatus() { return (this._content) ? this._content.loadStatus : 0 }

	get size() {
		if (!this._content) {
			return { width: 0, height: 0 }
		}
		return this._content.size
	}

	get resourcePath() {
		if (this._type !== "slice" || !this._content) {
			return null
		}
		return this._content.resourcePath
	}

	// Used in LayerPile: only a layer can be active, and it basically means that its content
	// could be displayed on screen right now (i.e. it is an on-screen page, an on-screen page's
	// on-screen or out-of-screen segment, or such a segment's slice - however slice transitions,
	// which never form the content of a layer, will not be concerned by this property)
	get isActive() { return this._isActive }

	constructor(type, content) {
		this._type = type
		this._content = content
		if (this._content.setParentLayer) {
			this._content.setParentLayer(this)
		}

		this._soundAnimationsArray = null

		this._isActive = false
	}

	setParent(parent) {
		if (!this._content) {
			return
		}
		this._content.setParent(parent)
	}

	// Used in StoryBuilder
	setHalfTransition(type, value) {
		switch (type) {
		case "entryForward":
			this._entryForward = value
			break
		case "exitForward":
			this._exitForward = value
			break
		case "entryBackward":
			this._entryBackward = value
			break
		case "exitBackward":
			this._exitBackward = value
			break
		default:
			break
		}
	}

	addSoundAnimations(soundAnimationsArray) {
		this._soundAnimationsArray = this._soundAnimationsArray || []
		this._soundAnimationsArray.push(...soundAnimationsArray)
	}

	attemptToGoForward(shouldCancelTransition, doIfIsUndergoingChanges) {
		if (!this._content || !this._content.attemptToGoForward) {
			return false
		}
		return this._content.attemptToGoForward(shouldCancelTransition, doIfIsUndergoingChanges)
	}

	attemptToGoBackward(shouldCancelTransition, doIfIsUndergoingChanges) {
		if (!this._content || !this._content.attemptToGoBackward) {
			return false
		}
		return this._content.attemptToGoBackward(shouldCancelTransition, doIfIsUndergoingChanges)
	}

	attemptToGoSideways(way) {
		if (!this._content || !this._content.attemptToGoSideways) {
			return false
		}
		return this._content.attemptToGoSideways(way)
	}

	setScale(scale) {
		if (!this._content) {
			return
		}
		this._content.setScale(scale)
	}

	// Recursive functions (used in LayerPile)

	resize() {
		if (!this._content) {
			return
		}
		this._content.resize()
	}

	setupForEntry(isGoingForward) {
		this._isActive = true
		if (!this._content) {
			return
		}
		this._content.setupForEntry(isGoingForward)
	}

	finalizeEntry() {
		if (!this._content) {
			return
		}
		this._content.finalizeEntry()
	}

	finalizeExit() {
		this._isActive = false
		if (!this._content) {
			return
		}
		this._content.finalizeExit()
	}

	// Used in PageNavigator
	getResourceIdsToLoad(recursive = true, force) {
		if (!this._content) {
			return []
		}

		const resourceIdsArray = []

		if (recursive === true) {
			const idsArray = this._content.getResourceIdsToLoad(recursive, force)
			resourceIdsArray.push(...idsArray)
		}

		if (this._entryForward) {
			const idsArray = Layer.getResourceIdsForLayerTransition(this._entryForward, force)
			resourceIdsArray.push(...idsArray)
		}
		if (this._exitForward) {
			const idsArray = Layer.getResourceIdsForLayerTransition(this._exitForward, force)
			resourceIdsArray.push(...idsArray)
		}
		if (this._entryBackward) {
			const idsArray = Layer.getResourceIdsForLayerTransition(this._entryBackward, force)
			resourceIdsArray.push(...idsArray)
		}
		if (this._exitBackward) {
			const idsArray = Layer.getResourceIdsForLayerTransition(this._exitBackward, force)
			resourceIdsArray.push(...idsArray)
		}

		if (this._soundAnimationsArray) {
			this._soundAnimationsArray.forEach((soundAnimation) => {
				const { resourceId } = soundAnimation || {}
				if (resourceId !== undefined) {
					resourceIdsArray.push([{ resourceId }])
				}
			})
		}

		return resourceIdsArray
	}

	static getResourceIdsForLayerTransition(layerTransition, force) {
		const { slice } = layerTransition
		if (!slice) {
			return []
		}
		return slice.getResourceIdsToLoad(force)
	}

	destroyResourcesIfPossible() {
		if (!this._content) {
			return
		}
		this._content.destroyResourcesIfPossible()

		if (this._entryForward) {
			Layer.destroyResourcesIfPossibleForHalfTransition(this._entryForward)
		}
		if (this._exitForward) {
			Layer.destroyResourcesIfPossibleForHalfTransition(this._exitForward)
		}
		if (this._entryBackward) {
			Layer.destroyResourcesIfPossibleForHalfTransition(this._entryBackward)
		}
		if (this._exitBackward) {
			Layer.destroyResourcesIfPossibleForHalfTransition(this._exitBackward)
		}
	}

	static destroyResourcesIfPossibleForHalfTransition(halfTransition) {
		const { slice } = halfTransition
		if (!slice) {
			return
		}
		slice.destroyResourcesIfPossible()
	}

	// Used in Camera for virtual points
	getHref() {
		if (!this._content || !this._content.getHref) {
			return null
		}
		return this._content.getHref()
	}

}