import { SequenceSlice } from "../Slice"
import LinkObject from "./LinkObject"

import * as Utils from "../utils"
import * as constants from "../constants"

export default class Transition {

	static createTransition(transition, player) {
		const {
			type, duration, direction, file, sequence,
		} = transition || {}

		let shouldReturnDefaultValue = false

		const actualType = Utils.returnValidValue("transitionType", type, shouldReturnDefaultValue)
		if (!actualType) {
			return null
		}

		const actualTransition = { type: actualType }

		const actualDuration = Utils.returnValidValue("positive", duration, shouldReturnDefaultValue)
		if (actualDuration) {
			actualTransition.duration = actualDuration
		}

		if (actualType === "slide-in" || actualType === "slide-out" || actualType === "push") {
			shouldReturnDefaultValue = false
			const actualDirection = Utils.returnValidValue("direction", direction,
				shouldReturnDefaultValue)
			if (!direction) {
				return null
			}
			actualTransition.direction = actualDirection
		}

		if (actualType === "animation") {
			if (file && Utils.isAnObject(file) === true) {
				actualTransition.sliceType = "video"

				const fullObject = {
					...file,
					type: "video",
				}
				const parentInfo = null
				const forcedRole = "transition"
				const linkObject = new LinkObject(fullObject, player, parentInfo, forcedRole)
				const { slice } = linkObject
				actualTransition.slice = slice

			} else if (sequence) {
				actualTransition.sliceType = "sequence"

				const sliceProperties = {
					role: "transition",
					clipped: true,
					duration: actualDuration || constants.DEFAULT_DURATION,
				}

				const {
					arrayOfResourceInfoArray, fit,
				} = LinkObject.buildArrayOfResourceInfoArray(sequence, player)
				if (fit) {
					sliceProperties.fit = fit
				}

				shouldReturnDefaultValue = true
				sliceProperties.duration = Utils.returnValidValue("positive", duration,
					shouldReturnDefaultValue)

				const slice = new SequenceSlice(arrayOfResourceInfoArray, sliceProperties, player)
				actualTransition.slice = slice
			} else {
				return null
			}
		}

		return actualTransition
	}

	// Used in DivinaParser to split each page transition into two layer half transitions
	static getEntryAndExitTransitions(transition, isForward) {
		const {
			type, duration, direction, sliceType, slice,
		} = transition
		let entry = {
			type,
			duration, // Duration may remain undefined
			isDiscontinuous: true,
		}
		let exit = {
			type,
			duration, // Duration may remain undefined
			isDiscontinuous: true,
		}

		switch (type) {
		case "cut": // Duration is not taken into account, i.e. the cut occurs at once
			entry = null
			exit = null
			break
		case "dissolve":
			if (isForward === true) {
				entry.type = "fade-in"
				exit.type = "show"
			} else {
				exit.type = "fade-out"
				entry.type = "show"
			}
			break
		case "slide-in":
			entry.direction = direction
			exit.type = "show"
			break
		case "slide-out":
			entry.type = "show"
			exit.direction = direction
			break
		case "push":
			entry.type = "slide-in"
			entry.direction = direction
			exit.type = "slide-out"
			exit.direction = direction
			break
		case "animation":
			entry.sliceType = sliceType
			entry.slice = slice
			exit.type = "hide"
			exit.duration = 0
			break
		default:
			break
		}

		return { entry, exit }
	}

	static getValidHalfTransition(entryOrExit) {
		const { type, duration, direction } = entryOrExit || {}

		const shouldReturnDefaultValue = false
		const actualType = Utils.returnValidValue("halfTransitionType", type, shouldReturnDefaultValue)
		if (!actualType) {
			return null
		}

		const actualDuration = Utils.returnValidValue("positive", duration, shouldReturnDefaultValue)

		const actualEntryOrExit = {
			type: actualType,
			isDiscontinuous: false,
		}

		if (!actualDuration && actualDuration !== 0) {
			actualEntryOrExit.duration = actualDuration
		}

		if (actualType === "slide-in" || actualType === "slide-out") {
			if (!direction) {
				return null
			}
			const actualDirection = Utils.returnValidValue("direction", direction, shouldReturnDefaultValue)
			if (actualDirection) {
				actualEntryOrExit.direction = actualDirection
			}
		}

		return actualEntryOrExit
	}

}