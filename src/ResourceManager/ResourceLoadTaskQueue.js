import AsyncTaskQueue from "./AsyncTaskQueue"

export default class ResourceLoadTaskQueue extends AsyncTaskQueue {

	constructor(maxPriority, priorityFactor, allowsParallel) {

		// Task priorities will be evaluated based on page differences
		const getPriority = (task) => {
			if (!task.data || task.data.pageIndex === undefined
				|| this._targetPageIndex === undefined) {
				return task.priority || 0
			}
			const taskPageIndex = task.data.pageIndex
			let { priority } = task
			if (priority === undefined
				|| Math.abs(taskPageIndex - this._targetPageIndex) < Math.abs(priority)) {
				priority = taskPageIndex - this._targetPageIndex
			}
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

		super(maxPriority, allowsParallel, getPriority)
	}

	updatePriorities(targetPageIndex) {
		this._targetPageIndex = targetPageIndex
		super.updatePriorities()
	}

}