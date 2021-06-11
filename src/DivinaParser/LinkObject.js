import { Slice, TextSlice } from "../Slice"
import ResourceBuilder from "./ResourceBuilder"
import Transition from "./Transition"

import * as Utils from "../utils"

export default class LinkObject {

	get slice() { return this._slice }

	get hAlign() { return this._hAlign }

	get vAlign() { return this._vAlign }

	get transitionForward() { return this._transitionForward }

	get transitionBackward() { return this._transitionBackward }

	get snapPointsArray() { return this._snapPointsArray }

	get soundAnimationsArray() { return this._soundAnimationsArray }

	get childrenArray() { return this._childrenArray }

	get visualAnimationsArray() { return this._visualAnimationsArray }

	constructor(divinaObject, player, textOptions, parentInfo = null, forcedRole = null) {
		this._textOptions = textOptions

		this._slice = null

		this._hAlign = null
		this._vAlign = null

		this._transitionForward = null
		this._transitionBackward = null

		this._snapPointsArray = null

		this._soundAnimationsArray = null

		// For link object layers (will eventually result in the creation of a unique segment)
		this._childrenArray = null

		// For link object animations (the unique segment holding them may have states)
		this._visualAnimationsArray = null

		// Now build the slice associated to the link object (by default),
		// and also child link objects (and their slices) and transitions (and slices) as needed
		this._buildSlicesAndTransitions(divinaObject, player, parentInfo, forcedRole)
	}

	_buildSlicesAndTransitions(divinaObject, player, parentInfo = null, forcedRole = null) {
		const { properties } = divinaObject || {}
		const {
			fit,
			clipped,
			hAlign,
			vAlign,
			page,
			transitionForward,
			transitionBackward,
			snapPoints,
			sounds,
			layers,
			animations,
			backgroundColor,
			fillColor,
			fontFamily,
			fontSize,
			lineHeight,
			letterSpacing,
			rect,
		} = properties || {}

		let role = forcedRole || "standard"
		if (parentInfo) {
			role = "layersChild" // Will be positioned based on the parent's top left point
		} else if (layers) {
			role = "layersParent" // Will give its dimensions as reference (but won't be displayed)
		}

		const shouldReturnDefaultValue = false

		let sliceFit = null
		if (parentInfo) { // If a layersChild (i.e. the slice in a child layer)
			sliceFit = "pixel"
		} else {
			sliceFit = Utils.returnValidValue("fit", fit, shouldReturnDefaultValue)
		}

		const sliceClipped = Utils.returnValidValue("clipped", clipped, shouldReturnDefaultValue)

		const sliceHAlign = Utils.returnValidValue("hAlign", hAlign, shouldReturnDefaultValue)
		const sliceVAlign = Utils.returnValidValue("vAlign", vAlign, shouldReturnDefaultValue)
		if (sliceHAlign) {
			this._hAlign = sliceHAlign
		}
		if (sliceVAlign) {
			this._vAlign = sliceVAlign
		}

		const pageSide = Utils.returnValidValue("pageSide", page, shouldReturnDefaultValue)

		const sliceProperties = {
			role,
			fit: sliceFit,
			clipped: sliceClipped,
			hAlign: sliceHAlign,
			vAlign: sliceVAlign,
			pageSide,
		}

		let textOptions = {}
		const result = ResourceBuilder.createResourceInfoArray(divinaObject, player)
		if (result.type === "resource") {
			this._slice = new Slice(result.resourceInfoArray, sliceProperties, player, parentInfo)
		} else {
			textOptions = {
				backgroundColor: Utils.returnValidValue("backgroundColor", backgroundColor,
					shouldReturnDefaultValue) || this._textOptions.backgroundColor,
				fillColor: Utils.returnValidValue("fillColor", fillColor, shouldReturnDefaultValue)
					|| this._textOptions.fillColor,
				fontFamily: Utils.returnValidValue("fontFamily", fontFamily, shouldReturnDefaultValue)
					|| this._textOptions.fontFamily,
				fontSize: Utils.returnValidValue("fontSize", fontSize, shouldReturnDefaultValue)
					|| this._textOptions.fontSize,
				lineHeight: Utils.returnValidValue("lineHeight", lineHeight, shouldReturnDefaultValue)
					|| this._textOptions.lineHeight,
				letterSpacing: Utils.returnValidValue("letterSpacing", letterSpacing,
					shouldReturnDefaultValue) || this._textOptions.letterSpacing,
				hAlign: sliceHAlign || this._textOptions.hAlign,
				vAlign: sliceVAlign || this._textOptions.vAlign,
			}
			if (rect) {
				const actualRect = Utils.parseStringRect(rect)
				if (actualRect) {
					textOptions.rect = actualRect
				}
			}

			sliceProperties.width = result.width
			sliceProperties.height = result.height
			sliceProperties.type = "text"

			this._slice = new TextSlice(result.resourceInfoArray, textOptions, sliceProperties, player,
				parentInfo)
		}

		// Handle detailed transition data
		if (transitionForward) {
			const transition = Transition.createTransition(transitionForward, player, this._textOptions)
			if (transition) {
				this._transitionForward = transition
			}
		}
		if (transitionBackward) {
			const transition = Transition.createTransition(transitionBackward, player, this._textOptions)
			if (transition) { // An invalid transition has a type forced as null
				this._transitionBackward = transition
			}
		}

		// Handle snap points
		if (snapPoints && Array.isArray(snapPoints) === true) {
			this._snapPointsArray = []
			snapPoints.forEach((snapPoint) => {
				const validSnapPoint = LinkObject._getValidPoint(snapPoint)
				if (validSnapPoint !== null) {
					this._snapPointsArray.push(validSnapPoint)
				}
			})
		}

		// Handle sounds
		if (sounds) {
			this._soundAnimationsArray = []
			sounds.forEach((sound) => {
				const shouldConsiderStartAndEnd = true
				const soundAnimation = LinkObject.getValidSoundAnimation(sound, player,
					shouldConsiderStartAndEnd)
				if (soundAnimation) {
					this._soundAnimationsArray.push(soundAnimation)
				}
			})
		}

		// Handle layers (note that we do not consider layers for a child layer object)
		if (!parentInfo && layers && Array.isArray(layers) === true) {
			this._childrenArray = this._getChildrenArray(layers, this._slice, player)
		}

		// Handle animations
		if (animations) {
			this._visualAnimationsArray = LinkObject._getVisualAnimationsArray(animations)
		}
	}

	// Used above and in Transition
	static buildArrayOfResourceInfoArray(sequenceImagesArray, player) {
		const result = { arrayOfResourceInfoArray: [] }

		if (!sequenceImagesArray || Array.isArray(sequenceImagesArray) === false
			|| sequenceImagesArray.length === 0) {
			return result
		}

		sequenceImagesArray.forEach((sequenceImage, i) => {
			if (sequenceImage && Utils.isAnObject(sequenceImage) === true) {

				// We allow fit and clipped information to be gathered from first file
				// (note that if the first file was empty, too bad, i=0 has passed!)
				if (i === 0 && sequenceImage.properties) {
					const shouldReturnDefaultValue = false

					let fileFit = sequenceImage.properties.fit
					fileFit = Utils.returnValidValue("fit", fileFit,
						shouldReturnDefaultValue)
					if (fileFit !== null) {
						result.fit = fileFit
					}

					let fileClipped = sequenceImage.properties.clipped
					fileClipped = Utils.returnValidValue("clipped", fileClipped,
						shouldReturnDefaultValue)
					if (fileClipped !== null) {
						result.clipped = fileClipped
					}
				}

				const fullObject = { ...sequenceImage, type: "image" }
				const {
					isValid, resourceInfoArray,
				} = ResourceBuilder.createResourceInfoArray(fullObject, player)
				if (isValid === true) {
					result.arrayOfResourceInfoArray.push(resourceInfoArray)
				}
			}
		})
		return result
	}

	static _getValidPoint(point) {
		let validPoint = null

		const { viewport, x, y } = point || {}
		const shouldReturnDefaultValue = false
		const actualViewport = Utils.returnValidValue("viewport", viewport,
			shouldReturnDefaultValue)
		if (actualViewport === null
			|| (Utils.isAString(x) === false && Utils.isAString(y) === false)) {
			return validPoint
		}

		validPoint = { viewport: actualViewport }

		if (x !== undefined && x.length > 0) {
			const validValueAndUnit = Utils.getValidValueAndUnit(x)
			if (validValueAndUnit) {
				const { value, unit } = validValueAndUnit
				validPoint.x = value
				validPoint.unit = unit
			}
		}
		if (y !== undefined && y.length > 0) {
			const validValueAndUnit = Utils.getValidValueAndUnit(y)
			if (validValueAndUnit) {
				const { value, unit } = validValueAndUnit
				validPoint.y = value
				validPoint.unit = unit
			}
		}

		if (validPoint.unit) { // Note that x and y cannot cannot have different units
			return validPoint
		}
		return null
	}

	// Used above and in DivinaParser
	static getValidSoundAnimation(sound, player, shouldConsiderStartAndEnd = false) {
		const { href, properties } = sound || {}
		const { looping, animation } = properties || {}
		if (!href) {
			return null
		}

		const { path } = Utils.getPathAndMediaFragment(href)
		const coreResourceData = {
			type: "audio",
			path,
		}
		const shouldReturnDefaultValue = true
		coreResourceData.looping = Utils.returnValidValue("looping", looping,
			shouldReturnDefaultValue)

		const resourceId = ResourceBuilder.getResourceId(coreResourceData, player)
		if (resourceId === null) {
			return null
		}

		if (shouldConsiderStartAndEnd === false) {
			return { resourceId }
		}

		let soundAnimation = null
		if (!animation) {
			return {
				resourceId,
				type: "time",
				start: 0,
			}
		}

		const { type, start, end } = animation
		const actualType = Utils.returnValidValue("animationType", type, shouldReturnDefaultValue)
		const actualStart = LinkObject._processSoundStartOrEnd(actualType, start)
		if (!actualStart) {
			return null
		}
		soundAnimation = {
			resourceId,
			type: actualType,
			start: actualStart,
		}
		if (end) {
			const actualEnd = LinkObject._processSoundStartOrEnd(actualType, end)
			if (actualEnd) {
				soundAnimation.end = actualEnd
			}
		}

		return soundAnimation
	}

	static _processSoundStartOrEnd(type, value) { // value is that for start or end
		const shouldReturnDefaultValue = false
		let actualValue = null
		switch (type) {
		case "time":
			actualValue = Utils.returnValidValue("positive", value, shouldReturnDefaultValue)
			break
		case "progress":
			actualValue = Utils.returnValidValue("positive", value, shouldReturnDefaultValue)
			if (actualValue !== null && actualValue > 1) {
				actualValue = null
			}
			break
		case "point":
			actualValue = LinkObject._getValidPoint(value)
			break
		default:
			break
		}
		return actualValue
	}

	_getChildrenArray(layers, slice, player) {
		const childrenArray = []
		layers.forEach((layerObject) => {
			if (layerObject) {
				const layerProperties = layerObject.properties || {}
				const {
					entryForward, exitBackward, exitForward, entryBackward,
				} = layerProperties

				// Create a new link object, using this link object's slice as the parent slice
				const parentInformation = {
					slice,
					layerIndex: childrenArray.length,
				}
				const linkObject = new LinkObject(layerObject, player, this._textOptions,
					parentInformation)

				const child = { linkObject }
				let actualHalfTransition = null

				// Handle half transitions
				actualHalfTransition = Transition.getValidHalfTransition(entryForward)
				if (actualHalfTransition) {
					child.entryForward = actualHalfTransition
				}
				actualHalfTransition = Transition.getValidHalfTransition(entryBackward)
				if (actualHalfTransition) {
					child.entryBackward = actualHalfTransition
				}
				actualHalfTransition = Transition.getValidHalfTransition(exitForward)
				if (actualHalfTransition) {
					child.exitForward = actualHalfTransition
				}
				actualHalfTransition = Transition.getValidHalfTransition(exitBackward)
				if (actualHalfTransition) {
					child.exitBackward = actualHalfTransition
				}

				// Handle transitions - which shall take precedence over half transitions
				if (layerProperties.transitionForward) {
					const transition = Transition.createTransition(layerProperties.transitionForward,
						player, this._textOptions)
					if (transition) {
						child.transitionForward = transition
					}
				}
				if (layerProperties.transitionBackward) {
					const transition = Transition.createTransition(layerProperties.transitionBackward,
						player, this._textOptions)
					if (transition) {
						child.transitionBackward = transition
					}
				}

				childrenArray.push(child)
			}
		})
		return childrenArray
	}

	static _getVisualAnimationsArray(animations) {
		const animationsArray = []
		animations.forEach((animation) => {
			const { type, variable, keyframes } = animation || {}

			let shouldReturnDefaultValue = true
			const animationType = Utils.returnValidValue("animationType", type,
				shouldReturnDefaultValue)

			shouldReturnDefaultValue = false // No default value for an animation variable
			const animationVariable = Utils.returnValidValue("animationVariable", variable,
				shouldReturnDefaultValue)

			if (animationVariable !== null && keyframes && Array.isArray(keyframes)
				&& keyframes.length > 0) {

				const keyframesArray = []
				keyframes.forEach((keyframe) => {
					const { key, value } = keyframe || {}
					const actualKeyframe = { key }

					let isKeyValid = (Utils.isANumber(key) === true && key >= 0)
					if (animationType === "point") {
						const validPoint = LinkObject._getValidPoint(key)
						if (validPoint) {
							actualKeyframe.key = validPoint
							isKeyValid = true
						} else {
							isKeyValid = false
						}
					}

					// Note that only numbers are accepted as animation values
					if (isKeyValid === true && Utils.isANumber(value) === true) {
						actualKeyframe.value = value
						keyframesArray.push(actualKeyframe)
					}
				})

				if (keyframesArray.length > 0) {
					animationsArray.push({ type: animationType, variable, keyframesArray })
				}
			}
		})
		return animationsArray
	}

}