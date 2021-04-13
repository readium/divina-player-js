import { Loader } from "../Renderer"
import TextureResource from "./TextureResource"
import VideoTextureResource from "./VideoTextureResource"
import AudioResource from "./AudioResource"
import ResourceLoadTaskQueue from "./ResourceLoadTaskQueue"
import Task from "./Task"

import * as Utils from "../utils"
import * as constants from "../constants"

export default class ResourceManager {

	// Used in PageNavigator

	get loadingMode() { return this._loadingMode }

	get allowsDestroy() { return this._allowsDestroy }

	get maxNbOfUnitsToLoadAfter() { return this._maxNbOfUnitsToLoadAfter }

	get maxNbOfUnitsToLoadBefore() { return this._maxNbOfUnitsToLoadBefore }

	// Used in Player

	get haveFirstResourcesLoaded() { return this._haveAllInitialTasksRun }

	constructor(player) {
		this._player = player

		this._doWithLoadPercentChange = null
		this._resourceSource = {}

		this._resources = {}

		this._taskQueue = null

		this._haveAllInitialTasksRun = false
		this._nbOfCompletedTasks = 0

		this._maxNbOfUnitsToLoadAfter = 0
		this._maxNbOfUnitsToLoadBefore = 0
	}

	getResourceId(coreResourceData) {
		const { type, path } = coreResourceData || {}
		if (!path || Utils.isAString(path) === false) {
			return null
		}

		// Check if a resource with the same path already exists, but consider it
		// only if it is an image (duplicates are allowed for video and audio resources)
		let resource = null
		let i = 0
		const resourcesArray = Object.values(this._resources)
		while (i < resourcesArray.length && !resource) {
			// Duplicates are not allowed for "image" and "audio" resources
			if (resourcesArray[i].path === path && type !== "video") {
				resource = resourcesArray[i]
			}
			i += 1
		}

		if (!resource) { // Create and store new resource
			switch (type) {
			case "image":
				resource = new TextureResource(coreResourceData, this._player)
				break
			case "video":
				resource = new VideoTextureResource(coreResourceData, this._player)
				break
			case "audio":
				resource = new AudioResource(coreResourceData, this._player)
				break
			default:
				return null
			}
			this._resources[resource.id] = resource
		}

		const { id } = resource
		return id
	}

	getResourceWithId(resourceId) {
		return this._resources[resourceId] || {}
	}

	// Used in Player to configure ResourceManager
	setResourceSourceAndOptions(resourceSource, options) {
		this._resourceSource = resourceSource

		const {
			loadingMode,
			allowsDestroy,
			allowsParallel,
			videoLoadTimeout = constants.DEFAULT_VIDEO_LOAD_TIMEOUT,
		} = options || {}

		const shouldReturnDefaultValue = true
		this._loadingMode = Utils.returnValidValue("loadingMode", loadingMode,
			shouldReturnDefaultValue)
		this._allowsDestroy = Utils.returnValidValue("allowsDestroy", allowsDestroy,
			shouldReturnDefaultValue)
		this._allowsParallel = Utils.returnValidValue("allowsParallel", allowsParallel,
			shouldReturnDefaultValue)
		this._videoLoadTimeout = videoLoadTimeout

		let priorityFactor = 1

		const { maxNbOfUnitsToLoadAfter } = options || {}

		if (maxNbOfUnitsToLoadAfter === null) { // If was explicitly set as null!
			this._maxNbOfUnitsToLoadAfter = null
			this._maxNbOfUnitsToLoadBefore = null
			priorityFactor = Math.max((1 / constants.MIN_SHARE_OF_UNITS_TO_LOAD_BEFORE) - 1, 1)

		} else {
			this._maxNbOfUnitsToLoadAfter = (Utils.isANumber(maxNbOfUnitsToLoadAfter) === true
				&& maxNbOfUnitsToLoadAfter >= 0)
				? maxNbOfUnitsToLoadAfter
				: constants.DEFAULT_MAX_NB_OF_UNITS_TO_LOAD_AFTER
			this._maxNbOfUnitsToLoadAfter = Math.ceil(this._maxNbOfUnitsToLoadAfter)

			this._maxNbOfUnitsToLoadBefore = this._maxNbOfUnitsToLoadAfter
			this._maxNbOfUnitsToLoadBefore *= constants.MIN_SHARE_OF_UNITS_TO_LOAD_BEFORE
			this._maxNbOfUnitsToLoadBefore = Math.ceil(this._maxNbOfUnitsToLoadBefore)

			priorityFactor = (this._maxNbOfUnitsToLoadAfter / this._maxNbOfUnitsToLoadBefore) || 1
		}

		this._buildAsyncTaskQueue(priorityFactor)
	}

	_buildAsyncTaskQueue(priorityFactor) {
		const { slices } = this._player
		const nbOfSlices = Object.keys(slices).length
		const maxPriority = this._maxNbOfUnitsToLoadAfter || nbOfSlices

		this._taskQueue = new ResourceLoadTaskQueue(maxPriority, this._allowsParallel, priorityFactor)
	}

	setDoWithLoadPercentChange(doWithLoadPercentChange) {
		if (!doWithLoadPercentChange) {
			return
		}
		this._doWithLoadPercentChange = doWithLoadPercentChange
		this._doWithLoadPercentChange(0)
	}

	// Stop all loading tasks when setting (including changing) the page navigator (used in Player)
	killPendingLoads() {
		if (!this._taskQueue) {
			return
		}
		this._taskQueue.reset()
		// Note that killing all tasks will call their respective resource.cancelLoad()
		this._nbOfCompletedTasks = 0
	}

	// Used in PageNavigator (way to update priorities for load tasks if some are still pending))
	updateForTargetSegmentIndex(targetSegmentIndex) { // Which is an absolute segment index
		// Update priorities for load tasks (if some tasks are still pending)
		this._taskQueue.updatePriorities(targetSegmentIndex)
	}

	// Used in PageNavigator (idsArray.length=1 except for a sequence)
	loadResources(sliceResourceDataArray, segmentIndex) {
		let taskId = null

		const resourceIdsToLoadArray = []
		sliceResourceDataArray.forEach(({ resourceId, fragment, sliceId }) => {
			if (this._resources[resourceId]) {
				const resource = this._resources[resourceId] || {}
				if (resource.type !== "audio") { // addOrUpdateFragment is only defined for a TextureResource
					resource.addOrUpdateFragment(fragment, sliceId)
				}

				// If has not started loading, start preparing the loading task
				if (resource.hasNotStartedLoading === true) {
					if (taskId === null) {
						taskId = String(resourceId)
					} else { // For a sequence, all images are loaded together as just one task
						taskId += String(resourceId)
					}
					resourceIdsToLoadArray.push(resourceId)
					resource.notifyLoadStart()

				// Otherwise if a texture has been loaded, ensure it is applied
				} else if (resource.hasLoadedSomething === true && resource.type !== "audio") {
					const { slices } = this._player
					resource.applyAllTextures(slices)
				}
			}
		})

		const callback = () => {
			const { slices } = this._player
			resourceIdsToLoadArray.forEach((resourceId) => {
				const resource = this._resources[resourceId]
				if (resource && resource.type !== "audio") {
					resource.applyAllTextures(slices)
				}
			})
		}
		// Note that callback will ensure slice.loadStatus=2 (or -1),
		// which will prevent re-triggering loadResourcesWithIds for the slice
		if (resourceIdsToLoadArray.length === 0) {
			callback()
			return
		}

		let task = this._taskQueue.getTaskWithId(taskId)
		const data = { segmentIndex }

		// Add resource load task to queue if not already in queue
		if (!task) {
			const loader = new Loader()
			const doAsync = () => this._loadResources(resourceIdsToLoadArray, loader)
			const doOnEnd = callback
			const doOnKill = () => {
				// Cancel loading for resources not loaded yet (and thus change their load status)
				loader.reset()
				const { slices } = this._player
				resourceIdsToLoadArray.forEach((resourceId) => {
					if (this._resources[resourceId]) {
						const resource = this._resources[resourceId]
						if (resource.hasLoadedSomething === false) {
							resource.cancelLoad(slices)
						}
					}
				})
			}
			task = new Task(taskId, data, doAsync, doOnEnd, doOnKill)
			this._taskQueue.addTask(task)

		// In serial mode, if task exists, update data to potentially update its priority
		} else if (this._allowsParallel === false) {
			this._taskQueue.updateTaskWithData(data)
		}
	}

	_loadResources(resourceIdsArray, loader) {
		return new Promise((resolve, reject) => {
			this._addResourcesToLoaderAndLoad(resourceIdsArray, loader, resolve, reject)
		})
	}

	_addResourcesToLoaderAndLoad(resourceIdsArray, loader, resolve, reject) {
		const firstResourceId = resourceIdsArray[0]
		const firstResource = this._resources[firstResourceId]
		if (!firstResource) {
			reject()
			return
		}

		if (firstResource.type === "audio" || firstResource.type === "video") {

			// Only consider a video if it is alone, i.e. not in a sequence
			// (more constraining than what the type itself allows)
			if (resourceIdsArray.length !== 1) {
				reject()
				return
			}

			const { path } = firstResource
			const src = this._getSrc(path)

			if (firstResource.type === "audio") {
				const doOnAudioLoadSuccess = (data) => {
					this._acknowledgeResourceHandling([data], resolve)
				}
				const doOnAudioLoadFail = null
				firstResource.attemptToLoadAudio(src, doOnAudioLoadSuccess, doOnAudioLoadFail,
					this._videoLoadTimeout, this._allowsParallel, resolve)

			} else if (firstResource.type === "video") {
				const doOnVideoLoadSuccess = (resolve2, textureData) => {
					this._acknowledgeResourceHandling([textureData], resolve2)
				}
				const doOnVideoLoadFail = (resolve2, fallbackPath = null) => {
					if (fallbackPath) {
						const resourceData = { resourceId: firstResourceId, path, fallbackPath }
						this._addToLoaderAndLoad([resourceData], loader, resolve2)

					} else {
						const { slices } = this._player
						firstResource.cancelLoad(slices)
						resolve2()
					}
				}

				firstResource.attemptToLoadVideo(src, doOnVideoLoadSuccess, doOnVideoLoadFail,
					this._videoLoadTimeout, this._allowsParallel, resolve)
			}

		} else {
			const resourceDataArray = []
			resourceIdsArray.forEach((resourceId) => {
				if (this._resources[resourceId]) {
					const { type, path } = this._resources[resourceId]
					// Reminder: a sequence transition forces its resourcesArray
					// to only contain image types anyway
					if (type === "image") {
						resourceDataArray.push({ resourceId, path })
					}
				}
			})
			this._addToLoaderAndLoad(resourceDataArray, loader, resolve)
		}
	}

	_getSrc(path, fallbackPath = null) {
		let src = fallbackPath || path

		const { folderPath, data } = this._resourceSource

		// If src has a scheme, use the address as is, otherwise add folderPath as prefix
		if (folderPath && Utils.hasAScheme(src) === false) {
			src = `${folderPath}/${src}`

		// If the story was opened with data (i.e. not from a folder)
		// and the resource is a video, use the dataURI as src
		} else if (data && data.base64DataByHref) {
			src = data.base64DataByHref[path]
		}

		return src
	}

	_addToLoaderAndLoad(resourceDataArray, loader, resolve) {
		resourceDataArray.forEach(({ resourceId, path, fallbackPath }) => {
			this._addToLoader(loader, resourceId, path, fallbackPath)
		})
		this._load(loader, resolve)
	}

	_addToLoader(loader, resourceId, path, fallbackPath = null) {
		const src = this._getSrc(path, fallbackPath)
		loader.add(resourceId, src)
	}

	_load(loader, resolve) {
		if (loader.hasTasks === true) {
			// If loading succeeds, move on
			loader.onComplete((dataArray) => {
				this._acknowledgeResourceHandling(dataArray, resolve)
			})
			loader.load()
		} else {
			this._acknowledgeResourceHandling(null, resolve)
		}
	}

	_acknowledgeResourceHandling(dataArray, resolve) {
		if (dataArray) {
			dataArray.forEach((textureData) => {
				const { resourceId } = textureData || {}
				if (resourceId !== undefined && this._resources[resourceId]
					&& this._resources[resourceId].type !== "audio") {
					const textureResource = this._resources[resourceId]
					textureResource.setActualTexture(textureData)
				}
			})
		}
		resolve()
	}

	// Used in Player
	runInitialTasks(doAfterRunningInitialTasks, forcedNb = null) {
		// Start the async queue with a function to handle a change in load percent
		this._nbOfCompletedTasks = 0
		const nbOfTasks = forcedNb || this._taskQueue.nbOfTasks

		const doAfterEachInitialTask = () => {
			this._nbOfCompletedTasks += 1
			if (this._doWithLoadPercentChange) {
				const percent = (nbOfTasks > 0) ? (this._nbOfCompletedTasks / nbOfTasks) : 1
				const loadPercent = Math.round(100 * percent)
				this._doWithLoadPercentChange(loadPercent)
			}

			if (this._nbOfCompletedTasks === nbOfTasks && doAfterRunningInitialTasks) {
				this._taskQueue.setDoAfterEachInitialTask(null)
				this._haveAllInitialTasksRun = true
				doAfterRunningInitialTasks()
			}
		}
		this._taskQueue.setDoAfterEachInitialTask(doAfterEachInitialTask)
		this._taskQueue.start()
	}

	// Used in SequenceSlice
	getTextureWithId(resourceId, fragment = null) {
		if (!this._resources[resourceId] || this._resources[resourceId].type === "audio") {
			return null
		}
		const resource = this._resources[resourceId]
		const texture = resource.getTextureForFragment(fragment)
		return texture
	}

	// Used in Slice (and SequenceSlice)
	destroyResourceForSliceIfPossible(resourceId) {
		if (!this._resources[resourceId] || this._resources[resourceId].type === "audio") {
			return
		}
		const textureResource = this._resources[resourceId]
		const forceDestroy = false
		const { slices } = this._player
		textureResource.destroyIfPossible(forceDestroy, slices)
	}

	// Used in PageNavigator (after a change in reading mode or tag)
	forceDestroyAllResourcesExceptIds(resourceIdsArray) {
		Object.values(this._resources).forEach((resource) => {
			const { id, hasLoadedSomething } = resource
			if (hasLoadedSomething === true && resourceIdsArray.includes(id) === false) {
				const forceDestroy = true
				const { slices } = this._player
				resource.destroyIfPossible(forceDestroy, slices)
			}
		})

	}

	// Used in Player (on app destroy)
	destroy() {
		this.killPendingLoads()
		Object.values(this._resources).forEach((resource) => {
			if (resource.type !== "audio") {
				const forceDestroy = true
				const { slices } = this._player
				resource.destroyIfPossible(forceDestroy, slices)
			}
		})
		this._resources = null
		this._taskQueue = null
	}

}