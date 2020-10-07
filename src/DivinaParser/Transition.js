import { SequenceSlice } from "../Slice"
import LinkObject from "./LinkObject"
import SliceResource from "./SliceResource"

import * as constants from "../constants"

export default class Transition {

	get type() { return this._type }

	get controlled() { return this._controlled }

	get duration() { return this._duration }

	get direction() { return this._direction }

	get sliceType() { return this._sliceType }

	get slice() { return this._slice }

	constructor(transition, player) {
		const {
			type, controlled, duration, direction, file, sequence,
		} = transition || {}

		this._type = type
		this._controlled = controlled
		this._duration = duration

		this._direction = direction
		this._sliceType = null
		this._slice = null

		if (type === "animation") {

			if (file) {
				this._sliceType = "video"

				const fullObject = {
					...file,
					type: "video",
				}
				const parentInfo = null
				const forcedRole = "transition"
				this._linkObject = new LinkObject(fullObject, parentInfo, player, forcedRole)
				const { slice } = this._linkObject
				this._slice = slice

			} else if (sequence) {
				this._sliceType = "sequence"

				const role = "transition"

				const resourcesArray = []
				let fit = null
				sequence.forEach((object, i) => {
					if (i === 0 && object.properties && object.properties.fit) {
						fit = object.properties.fit
					}
					const fullObject = {
						...object,
						type: "image",
					}
					const sliceResource = new SliceResource(fullObject, role, fit)
					resourcesArray.push(sliceResource)
				})

				const resourcesInfo = {
					role,
					resourcesArray,
					fit,
					duration,
				}
				this._slice = new SequenceSlice(resourcesInfo, player)

				this._duration = duration || constants.defaultDuration
			}
		}
	}

	// Used in StoryBuilder to split each page transition into two layer transitions
	getEntryAndExitTransitions(isForward) {
		let entry = {
			type: this._type,
			controlled: this._controlled,
			duration: this._duration, // Duration may remain undefined
			isDiscontinuous: true,
		}
		let exit = {
			type: this._type,
			controlled: this._controlled,
			duration: this._duration, // Duration may remain undefined
			isDiscontinuous: true,
		}

		switch (this._type) {
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
			entry.direction = this._direction
			exit.type = "show"
			break
		case "slide-out":
			entry.type = "show"
			exit.direction = this._direction
			break
		case "push":
			entry.type = "slide-in"
			entry.direction = this._direction
			exit.type = "slide-out"
			exit.direction = this._direction
			break
		case "animation":
			entry.sliceType = this._sliceType
			entry.slice = this._slice
			exit.type = "hide"
			exit.duration = 0
			break
		default:
			break
		}

		return { entry, exit }
	}

}