import CoreResource from "./CoreResource"
import { Texture } from "../Renderer"

export default class TextureResource extends CoreResource {

	constructor(coreResourceData, player) {
		super(coreResourceData, player)

		this._baseTexture = null
		this._textures = {} // Textures represent cropped versions of baseTexture, by fragment

		this.addOrUpdateFragment("full")
	}

	// Used above (in which case sliceId is undefined) and in ResourceManager
	addOrUpdateFragment(fragment = "full", sliceId) {
		if (!this._textures[fragment]) {
			this._textures[fragment] = {
				texture: null,
				sliceIdsSet: new Set(),
			}
		}

		// On a readingMode change, the baseTexture may already be present,
		// so adding new fragments implies that the corresponding textures be created
		if (this._baseTexture && this._textures.full && this._textures.full.texture
			&& !this._textures[fragment].texture) {
			const fullTexture = this._textures.full.texture
			const croppedTexture = Texture.cropToFragment(fullTexture, fragment)
			this._textures[fragment].texture = croppedTexture
		}

		if (sliceId !== undefined) {
			this._textures[fragment].sliceIdsSet.add(sliceId)
		}
	}

	resetSliceIdsSets() {
		Object.keys(this._textures).forEach((fragment) => {
			this._textures[fragment].sliceIdsSet = new Set()
		})
	}

	cancelLoad(slices) {
		Object.values(this._textures).forEach(({ sliceIdsSet }) => {
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId]
				slice.cancelTextureLoad()
			})
		})
		super.cancelLoad()
	}

	setActualTexture(textureData) { // textureData = { name, texture }
		if (this._loadStatus === 0 // If loading was cancelled
			|| !textureData || !textureData.texture
			|| !textureData.texture.base || !textureData.texture.full) {
			return
		}
		const { texture } = textureData
		const { base, full } = texture
		this._baseTexture = base

		// If loading has failed...
		if (this._loadStatus === -1) {

			// ...then if a fallback was defined, and it is to be cropped,
			// store the cropped (fragment) texture directly everywhere
			if (this._fallbackFragment) {
				const croppedTexture = Texture.cropToFragment(full, this._fallbackFragment)
				Object.keys(this._textures).forEach((fragment) => {
					this._textures[fragment].texture = croppedTexture
				})

			// ...otherwise do with the full texture
			} else {
				this._setFullTextureAndCreateFragmentsIfNeeded(full)
			}

		// ...otherwise loadStatus = 1 and loading has succeeded, so proceed with the full texture
		} else {
			this._setFullTextureAndCreateFragmentsIfNeeded(full)
			this._loadStatus = 2
		}
	}

	_setFullTextureAndCreateFragmentsIfNeeded(fullTexture) {
		this._textures.full.texture = fullTexture
		this._createFragmentsIfNeeded(fullTexture)
	}

	_createFragmentsIfNeeded(fullTexture) {
		Object.keys(this._textures).forEach((fragment) => {
			if (fragment !== "full") {
				const croppedTexture = Texture.cropToFragment(fullTexture, fragment)
				this._textures[fragment].texture = croppedTexture
			}
		})
	}

	applyAllTextures(slices) {
		const fullTexture = this._textures.full.texture
		Object.values(this._textures).forEach(({ texture, sliceIdsSet }) => {
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId]
				if (slice) {
					const sliceTexture = (this._loadStatus === -1) ? fullTexture : texture
					const isAFallback = (this._loadStatus === -1)
					slice.updateTextures(sliceTexture, isAFallback)
				}
			})
		})
	}

	// Used for a SequenceSlice only
	getTextureForFragment(fragment = null) {
		const actualFragment = (this._loadStatus !== -1 && fragment) ? fragment : "full"
		const { texture } = this._textures[actualFragment] || {}
		if (!texture) {
			return null
		}
		return texture
	}

	destroyIfPossible(forceDestroy = false, slices) {
		if (this._loadStatus === 0) {
			return
		}
		const canBeDestroyed = (forceDestroy === true)
			|| (this._checkIfCanBeDestroyed(slices) === true)
		if (canBeDestroyed === true) {
			this._forceDestroy(slices) // A different function for video and basic texture resources
		}
	}

	_checkIfCanBeDestroyed(slices) {
		let canBeDestroyed = true
		Object.values(this._textures).forEach((fragmentData) => {
			const { sliceIdsSet } = fragmentData
			sliceIdsSet.forEach((sliceId) => {
				const slice = slices[sliceId]
				if (slice) {
					const { isActive } = slice
					if (isActive === true) {
						canBeDestroyed = false
					}
				}
			})
		})
		return canBeDestroyed
	}

	_forceDestroy(slices) {
		this._forceDestroyTextures(slices)
	}

	// Used above and in VideoTextureResource
	_forceDestroyTextures(slices) {
		Object.entries(this._textures).forEach(([fragment, fragmentData]) => {
			const { texture, sliceIdsSet } = fragmentData
			if (texture) {
				sliceIdsSet.forEach((sliceId) => {
					const slice = slices[sliceId]
					if (slice) {
						slice.removeTexture()
					}
				})
				if (texture.destroy) {
					texture.destroy()
				}
				this._textures[fragment].texture = null
			}
		})
		if (this._baseTexture && this._baseTexture.destroy) {
			this._baseTexture.destroy()
		}
		this._baseTexture = null

		super.forceDestroy()
	}

}