import AsyncTaskQueue from "./AsyncTaskQueue"

export default class ResourceLoadTaskQueue extends AsyncTaskQueue {

	constructor(maxPriority, allowsParallel, priorityFactor) {

		// Task priorities will be evaluated based on segment differences (absolute segmentIndex)
		const getPriorityFromTaskData = (data) => {
			let priority = 0
			if (!data || data.segmentIndex === null || this._targetSegmentIndex === null) {
				return priority
			}
			const taskSegmentIndex = data.segmentIndex
			priority = taskSegmentIndex - this._targetSegmentIndex
			if (priority < 0) {
				if (priorityFactor) {
					priority *= -priorityFactor
					priority = Math.ceil(priority)
				} else {
					priority = -priority
				}
			}
			return priority
		}

		super(maxPriority, allowsParallel, getPriorityFromTaskData)

		this._targetSegmentIndex = null
	}

	updatePriorities(targetSegmentIndex) {
		this._targetSegmentIndex = targetSegmentIndex
		super.updatePriorities()
	}

}