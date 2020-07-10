export default class AsyncTaskQueue {

	get nbOfTasks() { return this._tasksArray.length }

	constructor(maxPriority, allowsParallel, getPriorityFunction) {
		this._maxPriority = maxPriority
		this._allowsParallel = allowsParallel
		this._getPriority = getPriorityFunction || ((task) => (task.priority || 0))

		this._tasksArray = []
		this.reset()

		this._nbOfInitialTasks = 0
		this._doAfterEachInitialTask = null

		this._hasStarted = false
	}

	reset() {
		this._tasksArray.forEach((task) => {
			if (task.isRunning === true && task.kill) {
				task.kill()
			}
		})

		// Useful in serial mode only
		this._isRunning = false
	}

	updatePriorities() {
		this._tasksArray.forEach((task, i) => {
			// Allow the task to have a forced priority, otherwise evaluate the priority
			const priority = (task.forcedPriority !== undefined)
				? task.forcedPriority
				: this._getPriority(task)

			// In serial mode, update task priorities
			if (this._allowsParallel === false) {
				this._tasksArray[i].priority = priority

			// Whereas in parallel mode, remove task if relevant
			} else if (priority > this._maxPriority) {
				if (task.isRunning === true && task.kill) {
					task.kill()
				}
				this._tasksArray.splice(i, 1)
			}
		})
	}

	addOrUpdateTask(task) {
		const fullTask = {
			...task,
			isRunning: false,
		}
		if (this._allowsParallel === true) {
			this._tasksArray.push(fullTask)
			if (this._hasStarted === true) {
				this._runTask(fullTask)
			}
		} else {
			// If in serial mode, only add the task if not already in queue...
			const { id } = fullTask
			const index = this._tasksArray.findIndex((arrayTask) => (arrayTask.id === id))
			if (index < 0) {
				// ...and add it with a priority property
				fullTask.priority = (task.forcedPriority !== undefined)
					? task.forcedPriority
					: this._getPriority(task)
				this._tasksArray.push(fullTask)

				if (this._hasStarted === true && this._isRunning === false) {
					this._runNextTaskInQueue()
				}
			} else { // Otherwise update the task
				this._tasksArray[index] = task
			}
		}
	}

	_runTask(task) {
		const { id, doAsync, doOnEnd } = task

		if (this._allowsParallel === false) {
			this._isRunning = true
		}

		task.isRunning = true

		const callback = () => {
			// Remove task from list
			const index = this._tasksArray.findIndex((arrayTask) => (arrayTask.id === id))
			this._tasksArray.splice(index, 1)

			if (doOnEnd) {
				doOnEnd()
			}

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

		if (doAsync) {
			doAsync()
				.then(callback)
		} else {
			callback()
		}
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
			if (!nextTask || task.priority < nextTask.priority) {
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