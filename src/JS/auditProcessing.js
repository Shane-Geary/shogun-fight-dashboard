// T-11 processing UI.
// T-03 still validates immediately after file selection.
const auditProcessing = (() => {
	const panel = document.getElementById('processingPanel')
	const main = document.querySelector('.dashboard-container')
	const heading = document.querySelector('.dashboard-heading h1')
	const subtitle = document.querySelector('.dashboard-heading > p')
	const upload = document.querySelector('.upload-section')
	const integration = document.querySelector('.integration-info')
	const input = document.getElementById('csvFile')

	const steps = [...document.querySelectorAll('#processingSteps > li')]

	const overview = [
		...document.querySelectorAll('.audit-progress .progress-step')
	]

	const get = (id) => document.getElementById(id)

	const initialHeading = heading.textContent
	const initialSubtitle = subtitle.textContent

	// Runs alongside each operation. runStep also enforces a 1000ms cap.
	const STEP_DELAY_MS = 750

	const phases = [
		{
			title: 'Files are uploading',
			description:
				'Your weekly audit is underway. Keep this window open while we prepare your data.',
			percent: 38,
			detail: 'Reading your CSV export',
			note: 'Your Martialytics data and Jotform data get pulled together for one complete member view.',
			error:
				'Unable to read your report. Return to upload and choose the CSV file again.'
		},
		{
			title: 'Validating your files',
			description:
				'Please ensure that the correct file was chosen and keep this window open while we validate your files.',
			percent: 52,
			detail: 'Validating columns and member records',
			note: 'The respective files are being cross-checked and validated at this time.',
			error:
				'Unable to validate your report. Return to upload and choose a new Martialytics export.'
		},
		{
			title: 'Bringing it together',
			description:
				'Retrieving data from your Martialytics export and Jotform submissions.',
			percent: 76,
			detail: 'Retrieving and combining member records',
			note: 'Automatically retrieving Jotform release, enrollment and cancellation submissions, then combining memberships, contact details and forms per person.',
			mobileNote:
				'Matching memberships, contact details and Jotform records by member.',
			error:
				'Unable to retrieve or combine the records. Check your connection and try again. If this continues, contact your dashboard administrator.'
		},
		{
			title: 'Preparing your results',
			description: 'Building your weekly member audit.',
			percent: 95,
			detail: 'Preparing your weekly member audit',
			note: 'Preparing your consolidated member view.',
			error:
				'Unable to prepare your results. Try again. If this continues, contact your dashboard administrator.'
		}
	]

	async function retrieveJotform(data, signal) {
		// A retry after a later stage failed can reuse this audit's response.
		if (Array.isArray(data.jotformSubmissions)) return data

		const response = await fetch('/.netlify/functions/jotform', {
			method: 'GET',
			cache: 'no-store',
			signal
		})

		if (response.status === 401) {
			auditSession.end()
			throw new Error('Your session expired.')
		}

		if (!response.ok) {
			throw new Error('Unable to retrieve Jotform submissions.')
		}

		const {submissions, completeHistory} = await response.json()

		if (!Array.isArray(submissions) || completeHistory !== true) {
			throw new Error('The complete Jotform history could not be retrieved.')
		}

		return {...data, jotformSubmissions: submissions}
	}

	function prepareAuditData(data) {
		const rows = data.validation.students
		const forms = data.jotformSubmissions.map(normalizeJotformSubmission)
		const {students, matchReview, graphs} = buildAuditStudents(
			rows,
			forms,
			true
		)

		// This also returns the counts needed for the audit summaries UI elements
		return {
			...data,
			dashboard: {
				martialyticsCount: rows.length,
				jotformCount: forms.length,
				cancellationCount: forms.filter(
					(form) => form.formType === 'cancellation'
				).length,
				students,
				graphs,
				matchReview
			}
		}
	}

	const auditTasks = [
		(data) => data, // The selected File is already in memory.
		(data) => data, // T-03 already validated and parsed the CSV.
		retrieveJotform,
		prepareAuditData
	]

	let controller = null
	let lastRequest = null

	// Run actual work and its display delay together.
	// A slower operation gets no additional delay.
	// Failure or cancellation stops waiting immediately.
	function runStep(task, data, signal, minimumDuration) {
		return new Promise((resolve, reject) => {
			if (signal.aborted) {
				reject(signal.reason)
				return
			}

			let settled = false
			let timer

			const finish = (settle, value) => {
				if (settled) return

				settled = true
				clearTimeout(timer)
				signal.removeEventListener('abort', cancel)
				settle(value)
			}

			const cancel = () => finish(reject, signal.reason)

			signal.addEventListener('abort', cancel, {once: true})

			const visibleDelay = new Promise((done) => {
				timer = setTimeout(done, Math.min(1000, Math.max(0, minimumDuration)))
			})

			const work = Promise.resolve().then(() => {
				if (signal.aborted) throw signal.reason

				return task(data, signal)
			})

			Promise.all([work, visibleDelay]).then(
				([result]) => finish(resolve, result),
				(error) => finish(reject, error)
			)
		})
	}

	// Update the three existing desktop overview cards.
	function setOverview(activeIndex) {
		overview.forEach((step, index) => {
			step.classList.toggle('active', index === activeIndex)
			step.classList.toggle('is-complete', index < activeIndex)

			step.querySelector('.step-number').textContent =
				index < activeIndex ? '✓' : String(index + 1).padStart(2, '0')

			if (index === activeIndex) {
				step.setAttribute('aria-current', 'step')
			} else {
				step.removeAttribute('aria-current')
			}
		})
	}

	// Desktop and mobile share the same four stage elements.
	function setSteps(activeIndex, state = 'running') {
		steps.forEach((step, index) => {
			const complete = state === 'complete' || index < activeIndex
			const active = !complete && index === activeIndex
			const failed = active && state === 'error'

			const status = complete
				? 'Complete'
				: failed
					? 'Failed'
					: active
						? 'In progress'
						: 'Waiting'

			step.classList.toggle('is-complete', complete)
			step.classList.toggle('is-active', active && !failed)
			step.classList.toggle('is-error', failed)

			step.querySelector('.processing-marker').textContent = complete
				? '✓'
				: failed
					? '!'
					: String(index + 1).padStart(2, '0')

			step.querySelector('small').textContent = status

			step.setAttribute(
				'aria-label',
				step.querySelector('strong').textContent + ': ' + status
			)

			if (active) {
				step.setAttribute('aria-current', 'step')
			} else {
				step.removeAttribute('aria-current')
			}
		})
	}

	function setProgress(percent, detail) {
		get('processingPercent').textContent = percent + '%'
		get('processingFill').style.width = percent + '%'

		get('processingBar').setAttribute('aria-valuenow', percent)
		get('processingBar').setAttribute('aria-valuetext', detail)

		get('processingDetail').textContent = detail
	}

	function showPhase(index, data) {
		const phase = phases[index]

		heading.textContent = phase.title
		subtitle.textContent = phase.description

		setOverview(index < 2 ? 0 : 1)
		setSteps(index)

		// These are staged UI estimates, not measured network progress.
		let detail = phase.detail

		setProgress(phase.percent, detail + ' · Step ' + (index + 1) + '/4')

		get('processingNote').classList.toggle('is-merging', index === 2)
		get('processingNoteDesktop').textContent = phase.note

		get('processingNoteMobile').textContent = phase.mobileNote || phase.note
	}

	async function start(
		file,
		validation,
		tasks = auditTasks,
		jotformSubmissions
	) {
		if (controller) return

		lastRequest = {file, validation, tasks, jotformSubmissions}

		const run = new AbortController()
		controller = run

		let stage = 0
		let data = {file, validation, jotformSubmissions}

		upload.hidden = true
		integration.hidden = true
		panel.hidden = false
		input.disabled = true

		main.classList.add('is-processing')
		panel.dataset.state = 'running'

		get('processingError').hidden = true
		get('processingError').textContent = ''
		get('retryProcessing').hidden = true
		get('processingNote').hidden = false
		get('processingHint').hidden = false

		get('cancelProcessing').textContent = 'Cancel'
		get('processingMessage').textContent = 'Please Wait...'

		get('processingFileName').textContent = file.name
		get('processingFileSize').textContent =
			'CSV report · ' + (file.size / 1024).toFixed(1) + ' KB'

		try {
			for (stage = 0; stage < phases.length; stage++) {
				if (run.signal.aborted) return

				showPhase(stage, data)

				if (stage === 0) {
					heading.focus({preventScroll: true})
				}

				data = await runStep(tasks[stage], data, run.signal, STEP_DELAY_MS)

				// A canceled run must never update a newer run's screen.
				if (controller !== run || run.signal.aborted) return

				// Save the successful Jotform response for this audit's Retry button.
				if (stage === 2) {
					lastRequest.jotformSubmissions = data.jotformSubmissions
				}
			}

			// Reach 100% only after the final operation and display gate finish.
			panel.dataset.state = 'complete'

			heading.textContent = 'Processing complete'
			subtitle.textContent = 'Your file has finished processing.'

			get('processingMessage').textContent = 'Complete'
			get('processingNote').hidden = true
			get('processingHint').hidden = true
			get('cancelProcessing').textContent = 'Back to upload'

			setProgress(100, '4 of 4 steps complete.')
			setSteps(3, 'complete')
			setOverview(2)

			// Keep the completion screen briefly visible and allow cancellation.
			await runStep((value) => value, data, run.signal, STEP_DELAY_MS)

			if (!(await auditSession.ready)) return
			if (controller !== run || run.signal.aborted) return

			auditSession.openDashboard(data.dashboard)
			lastRequest = null
		} catch (error) {
			if (controller !== run || run.signal.aborted) return

			panel.dataset.state = 'error'

			heading.textContent = 'Unable to complete your audit'
			subtitle.textContent = 'Try again or return to your file.'

			get('processingMessage').textContent = 'Processing stopped'
			get('processingNote').hidden = true
			get('processingHint').hidden = true

			get('retryProcessing').hidden = false
			get('cancelProcessing').textContent = 'Back to upload'

			const failedStage = Math.min(stage, phases.length - 1)

			setSteps(failedStage, 'error')

			get('processingDetail').textContent =
				'Stopped at step ' + (failedStage + 1) + '/4'

			get('processingBar').setAttribute(
				'aria-valuetext',
				get('processingDetail').textContent
			)

			const message = get('processingError')

			// Only deliberately user-facing errors override the recovery guidance.
			message.textContent = error?.userMessage || phases[failedStage].error

			message.hidden = false
			message.focus({preventScroll: true})
		} finally {
			if (controller === run) controller = null
		}
	}

	// Return to the existing upload screen, preserving the selected valid file.
	function cancel() {
		const active = controller
		controller = null
		active?.abort()

		if (panel.hidden) return

		panel.hidden = true
		upload.hidden = false
		integration.hidden = false
		input.disabled = false

		main.classList.remove('is-processing')

		heading.textContent = initialHeading
		subtitle.textContent = initialSubtitle

		setOverview(0)
		lastRequest = null

		get('startAuditButton').focus({preventScroll: true})
	}

	get('cancelProcessing').addEventListener('click', cancel)

	get('retryProcessing').addEventListener('click', () => {
		if (lastRequest) {
			start(
				lastRequest.file,
				lastRequest.validation,
				lastRequest.tasks,
				lastRequest.jotformSubmissions
			)
		}
	})

	// Stop pending work before signing out or leaving this page.
	document
		.querySelector('[data-sign-out]')
		?.addEventListener('click', cancel, {capture: true})

	window.addEventListener('pagehide', cancel)

	return {start, cancel}
})()
