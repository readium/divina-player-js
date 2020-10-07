import AsyncTaskQueue from "./AsyncTaskQueue"

export default class ResourceLoadTaskQueue extends AsyncTaskQueue {

	constructor(maxPriority, priorityFactor, allowsParallel) {

		// Task priorities will be evaluated based on page differences
		const getPriorityFromTaskData = (data) => {
			let priority = 0
			if (!data || data.pageIndex === null || this._targetPageIndex === null) {
				return priority
			}
			const taskPageIndex = data.pageIndex
			priority = taskPageIndex - this._targetPageIndex
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

		this._targetPageIndex = null
	}

	updatePriorities(targetPageIndex) {
		this._targetPageIndex = targetPageIndex
		super.updatePriorities()
	}

}