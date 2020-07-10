import { Loader } from "../Renderer"
import TextureResource from "./TextureResource"
import ResourceLoadTaskQueue from "./ResourceLoadTaskQueue"

import * as constants from "../constants"

export default class ResourceManager {

	get resourceTextures() { return this._textureResources }

	constructor(doWithLoadPercentChange, textureSource, player) {
		this._doWithLoadPercentChange = doWithLoadPercentChange
		this._textureSource = textureSource
		this._player = player

		const { options } = player
		const {
			allowsParallel = constants.defaultAllowsParallel,
			videoLoadTimeout = constants.defaultVideoLoadTimeout,
		} = options || {}

		this._allowsParallel = allowsParallel
		this._videoLoadTimeout = videoLoadTimeout

		this._textureResources = {}

		this._taskQueue = null
		this._nbOfCompletedTasks = 0

		if (this._doWithLoadPercentChange) {
			this._doWithLoadPercentChange(0)
		}
	}

	// Used in Player
	storeResourceInfo(resource = null, sliceId) {
		if (!resource || sliceId === undefined) {
			return
		}

		this._storeTextureInfo(resource, sliceId)

		const { alternate } = resource
		if (alternate) {
			Object.keys(alternate).forEach((tagName) => {
				Object.keys(alternate[tagName] || {}).forEach((tagValue) => {
					this._storeTextureInfo(alternate[tagName][tagValue], sliceId)
				})
			})
		}
	}

	_storeTextureInfo(textureInfo = null, sliceId) {
		const { path } = textureInfo || {}
		if (!path) {
			return
		}
		if (!this._textureResources[path]) {
			this._textureResources[path] = new TextureResource(textureInfo, sliceId)
		} else {
			this._textureResources[path].addTextureInfo(textureInfo, sliceId)
		}
	}

	// When setting (including changing) the page navigator (used in Player)
	reset(maxPriority, priorityFactor) {
		// Build async task queue if there is none...
		if (!this._taskQueue) {
			this._taskQueue = new ResourceLoadTaskQueue(maxPriority, priorityFactor,
				this._allowsParallel)
		// ...or stop all loading tasks otherwise
		} else {
			this._taskQueue.reset()
			this._nbOfCompletedTasks = 0
		}

		// Clear sliceIdsSets so they can be populated again for the considered reading mode
		Object.values(this._textureResources).forEach((textureResource) => {
			textureResource.resetSliceIdsSets()
		})
	}

	updateForTargetPageIndex(targetPageIndex) {
		// Update priorities for load tasks (if some tasks are still pending)
		this._taskQueue.updatePriorities(targetPageIndex)
	}

	// Used in Slice
	loadTexturesAtPaths(pathsArray, sliceId, pageIndex) {
		let taskId = null

		const pathsToLoadArray = []
		pathsArray.forEach((path) => {
			if (path && this._textureResources[path]) {
				const textureResource = this._textureResources[path]
				const { id, hasStartedLoading } = textureResource
				if (hasStartedLoading === false) {
					if (taskId === null) {
						taskId = id
					}
					pathsToLoadArray.push(path)
				}
			}
		})

		const callback = () => {
			const { slices } = this._player
			pathsArray.forEach((path) => {
				const textureResource = this._textureResources[path]
				if (textureResource) {
					textureResource.applyAllTextures(slices)
				}
			})
		}
		// Note that callback will ensure slice.loadStatus = 2 (or -1),
		// which will prevent re-triggering loadTexturesAtPaths for the slice

		if (pathsToLoadArray.length === 0) {
			callback()
			return
		}

		// If is already loading, still consider if priority order > that of when started loading!!!

		// Add resource load task to queue if not already in queue
		let task = this._taskQueue.getTaskWithId(taskId)
		if (!task) {
			const loader = new Loader()
			task = {
				id: taskId,
				data: { pageIndex },
				doAsync: () => this._loadResources(pathsToLoadArray, pageIndex, loader),
				doOnEnd: callback,
				kill: () => {
					// Cancel loading for resources not loaded yet
					const { slices } = this._player
					pathsToLoadArray.forEach((path) => {
						if (path && this._textureResources[path]) {
							const textureResource = this._textureResources[path]
							if (textureResource.hasLoaded === false) {
								textureResource.cancelLoad(slices)
							}
						}
					})
					loader.reset()
				},
			}
			this._taskQueue.addOrUpdateTask(task)

		// In serial mode, if task exists, add data to potentially update its priority
		} else if (this._allowsParallel === false) {
			task.data.pageIndex = pageIndex
			this._taskQueue.addOrUpdateTask(task)
		}
	}

	_loadResources(pathsToLoadArray, pageIndex, loader) {
		pathsToLoadArray.forEach((path) => {
			if (path && this._textureResources[path]) {
				const textureResource = this._textureResources[path]
				textureResource.notifyLoadStart()
			}
		})
		return new Promise((resolve) => {
			this._addResourcesToLoaderAndLoad(pathsToLoadArray, loader, resolve)
		})
	}

	_addResourcesToLoaderAndLoad(pathsToLoadArray, loader, resolve) {
		const firstPath = pathsToLoadArray[0]
		const firstTextureResource = this._textureResources[firstPath]

		if (pathsToLoadArray.length === 1 && firstTextureResource
			&& firstTextureResource.type === "video") { // Only consider a video if it is alone

			const src = this._getSrc(firstPath)
			const doOnVideoLoadSuccess = (textureData) => {
				this._acknowledgeResourceHandling([textureData], resolve)
			}
			const doOnVideoLoadFail = (path, fallbackPath) => {
				this._addToLoaderAndLoad([{ path, fallbackPath }], loader, resolve)
			}
			firstTextureResource.attemptToLoadVideo(src, doOnVideoLoadSuccess, doOnVideoLoadFail,
				this._videoLoadTimeout, this._allowsParallel, resolve)

		} else {
			const pathsAndFallbackPathsArray = []
			pathsToLoadArray.forEach((path) => {
				if (path && this._textureResources[path]) {
					const { type } = this._textureResources[path]
					// Reminder: a sequence transition forces its resourcesArray
					// to only contain image types anyway
					if (type === "image") {
						pathsAndFallbackPathsArray.push({ path })
					}
				}
			})
			this._addToLoaderAndLoad(pathsAndFallbackPathsArray, loader, resolve)
		}
	}

	_getSrc(path, fallbackPath = null) {
		let src = fallbackPath || path
		const { folderPath, data } = this._textureSource
		if (folderPath) {
			src = `${folderPath}/${src}`
		// If the story was opened with data (i.e. not from a folder)
		// and the resource is a video, use the dataURI as src
		} else if (data && data.base64DataByHref) {
			src = data.base64DataByHref[path]
		}
		return src
	}

	_addToLoaderAndLoad(pathsAndFallbackPathsArray, loader, resolve) {
		pathsAndFallbackPathsArray.forEach(({ path, fallbackPath }) => {
			this._addToLoader(loader, path, fallbackPath)
		})
		this._load(loader, resolve)
	}

	_addToLoader(loader, path, fallbackPath = null) {
		const src = this._getSrc(path, fallbackPath)
		loader.add(path, src)
	}

	_load(loader, resolve) {
		if (loader.hasTasks === true) {
			loader.load()
			// If loading succeeds, move on
			loader.onComplete((textureDataArray) => {
				this._acknowledgeResourceHandling(textureDataArray, resolve)
			})
		} else {
			this._acknowledgeResourceHandling(null, resolve)
		}
	}

	_acknowledgeResourceHandling(textureDataArray, resolve) {
		if (textureDataArray) {
			textureDataArray.forEach((textureData) => {
				const { name, baseTexture, texture } = textureData || {}
				// Store the baseTexture (and compute clipped textures for media fragments as needed),
				// knowing that name = path
				if (name && this._textureResources[name]) {
					const textureResource = this._textureResources[name]
					textureResource.setBaseTexture(baseTexture, texture)
				}
			})
		}
		resolve()
	}

	// Used in Player
	addStoryOpenTaskAndLoad(doOnLoadEnd, maxPriority) {
		// Add a last task to trigger doOnLoadEnd
		const task = {
			id: -1,
			doOnEnd: doOnLoadEnd,
			forcedPriority: maxPriority,
		}
		this._taskQueue.addOrUpdateTask(task)

		// Start the async queue with a function to handle a change in load percent
		this._nbOfCompletedTasks = 0
		const { nbOfTasks } = this._taskQueue
		const doAfterEachInitialTask = () => {
			this._nbOfCompletedTasks += 1
			const percent = (nbOfTasks > 0) ? (this._nbOfCompletedTasks / nbOfTasks) : 1
			const loadPercent = Math.round(100 * percent)
			if (this._doWithLoadPercentChange) {
				this._doWithLoadPercentChange(loadPercent)
			}
		}
		this._taskQueue.start(doAfterEachInitialTask)
	}

	// Used in SequenceSlice
	getTextureWithPath(path, mediaFragment = null) {
		if (!path || !this._textureResources || !this._textureResources[path]) {
			return null
		}
		const textureResource = this._textureResources[path]
		const texture = textureResource.getTextureForMediaFragment(mediaFragment)
		return texture
	}

	// Used in Slice (and SequenceSlice)
	notifyTextureRemovalFromSlice(path) {
		const { slices } = this._player
		if (path && this._textureResources[path]) {
			const textureResource = this._textureResources[path]
			textureResource.destroyTexturesIfPossible(slices)
		}
	}

	// Used in PageNavigator
	forceDestroyTexturesForPath(path) {
		if (!path || !this._textureResources[path]) {
			return
		}
		const textureResource = this._textureResources[path]
		textureResource.forceDestroyTextures()
	}

	killPendingLoads() {
		this._taskQueue.reset()
		// Note that killing all tasks will call their respective textureResource.cancelLoad()
		this._nbOfCompletedTasks = 0
	}

	destroy() {
		this.killPendingLoads()
		Object.values(this._textureResources).forEach((textureResource) => {
			textureResource.forceDestroyTextures()
		})
		this._textureResources = null
	}

}