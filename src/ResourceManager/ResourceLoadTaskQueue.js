import AsyncTaskQueue from "./AsyncTaskQueue"

export default class ResourceLoadTaskQueue extends AsyncTaskQueue {

	constructor(loadingMode, maxPriority, allowsParallel, priorityFactor) {

		// Task priorities will be evaluated based on segment differences (absolute segmentIndex)
		const getPriorityFromTaskData = (data) => {
			let priority = 0
			if (!data || data.segmentIndex === null || data.pageIndex === null
				|| this._targetIndex === null) {
				return priority
			}
			const taskIndex = (loadingMode === "segment") ? data.segmentIndex : data.pageIndex
			priority = taskIndex - this._targetIndex

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

		this._loadingMode = loadingMode
		this._targetIndex = null
	}

	updatePriorities(targetPageIndex, targetSegmentIndex) {
		this._targetIndex = (this._loadingMode === "segment") ? targetSegmentIndex : targetPageIndex
		super.updatePriorities()
	}

}