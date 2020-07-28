export default class AsyncTaskQueue {

	get nbOfTasks() { return this._tasksArray.length }

	constructor(maxPriority, allowsParallel, getPriorityFromTaskData) {
		this._maxPriority = maxPriority
		this._allowsParallel = allowsParallel
		this._getPriorityFromTaskData = getPriorityFromTaskData

		this._tasksArray = []
		this.reset()

		this._nbOfInitialTasks = 0
		this._doAfterEachInitialTask = null

		this._hasStarted = false
	}

	reset() {
		this._tasksArray.forEach((task) => { task.kill() })

		// Useful in serial mode only
		this._isRunning = false
	}

	updatePriorities() {
		this._tasksArray.forEach((task, i) => {
			const priority = this._getPriorityAndUpdateTaskIfRelevant(task, task.data)

			// In parallel mode, remove task if relevant
			if (this._allowsParallel === true && priority > this._maxPriority) {
				task.kill()
				this._tasksArray.splice(i, 1)
			}
		})
	}

	_getPriorityAndUpdateTaskIfRelevant(task, data) {
		const { priority, forcedPriority } = task
		if (forcedPriority !== null) {
			return forcedPriority
		}
		const possiblyNewPriority = (this._getPriorityFromTaskData)
			? this._getPriorityFromTaskData(data)
			: 0
		if (priority === null || possiblyNewPriority <= priority) {
			task.setData(data)
			task.setPriority(possiblyNewPriority)
		}
		return possiblyNewPriority
	}

	addTask(task) {
		const priority = this._getPriorityAndUpdateTaskIfRelevant(task, task.data)
		if (this._allowsParallel === false) {
			this._tasksArray.push(task)
			if (this._hasStarted === true && this._isRunning === false) {
				this._runNextTaskInQueue()
			}
		} else if (priority <= this._maxPriority) {
			this._tasksArray.push(task)
			if (this._hasStarted === true) {
				this._runTask(task)
			}
		}
	}

	updateTaskWithData(task, data) { // The task cannot be running already at this stage
		this._getPriorityAndUpdateTaskIfRelevant(task, data)
	}

	_runTask(task) {
		if (this._allowsParallel === false) {
			this._isRunning = true
		}

		const callback = () => {
			// Remove task from list
			const { id } = task
			const index = this._tasksArray.findIndex((arrayTask) => (arrayTask.id === id))
			this._tasksArray.splice(index, 1)

			if (this._doAfterEachInitialTask) {
				this._doAfterEachInitialTask()
				this._nbOfInitialTasks -= 1
				if (this._nbOfInitialTasks === 0) {
					this._doAfterEachInitialTask = null
				}
			}

			if (this._allowsParallel === false) {
				this._isRunning = false
				this._runNextTaskInQueue()
			}
		}
		task.run(callback)
	}

	_runNextTaskInQueue() { // In serial mode only
		if (this._tasksArray.length === 0 || this._isRunning === true) {
			return
		}
		const nextTask = this._getTaskWithHighestPriority()
		if (!nextTask) {
			return
		}
		this._runTask(nextTask)
	}

	_getTaskWithHighestPriority() { // Actually the *lowest* possible value for the priority key ;)
		let nextTask = null
		this._tasksArray.forEach((task) => {
			const { priority } = task
			if (!nextTask || priority < nextTask.priority) {
				nextTask = task
			}
		})
		return nextTask
	}

	start(doAfterEachInitialTask) {
		this._doAfterEachInitialTask = doAfterEachInitialTask

		this._nbOfInitialTasks = this._tasksArray.length
		this._hasStarted = true
		if (this._allowsParallel === true) {
			console.log(this._tasksArray)
			this._tasksArray.forEach((task) => {
				this._runTask(task)
			})
		} else {
			this._runNextTaskInQueue()
		}
	}

	getTaskWithId(id) {
		const foundTask = this._tasksArray.find((task) => (task.id === id))
		return foundTask
	}

}