// Metrics exports are aggregated in the browser before the audit handoff.
function createMetricsUpload(maxFileSize, onStateChange) {
	const picker = document.getElementById('metricsFiles')
	const choose = document.getElementById('chooseMetrics')
	const clear = document.getElementById('clearMetrics')
	const status = document.getElementById('metricsStatus')
	const localDay = new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	})
	let reports = {}
	let names = {}
	let busy = false
	let generation = 0

	function attendanceReport(headers, rows) {
		const timeColumn = headers.indexOf('Time')
		const styleColumn = headers.indexOf('Style')
		const byDate = {}

		for (const row of rows) {
			if (row.length !== headers.length) {
				throw new Error('Incomplete row in the attendance report.')
			}
			const timestamp = row[timeColumn]?.trim() || ''
			const date = new Date(timestamp)
			const style = row[styleColumn].trim()
			const group = /^(adult|youth)\b/i.exec(style)?.[1].toLowerCase()
			if (
				!/(Z|[+-]\d\d:\d\d)$/i.test(timestamp) ||
				!Number.isFinite(date.getTime())
			) {
				throw new Error(
					'An attendance row is missing a dated check-in with a time zone.'
				)
			}
			if (!group) {
				throw new Error(
					'An attendance style could not be classified as Adult or Youth.'
				)
			}

			const day = localDay.format(date)
			byDate[day] ??= {adult: 0, youth: 0}
			byDate[day][group]++
		}

		return {kind: 'attendance', data: byDate}
	}

	function growthReport(rows) {
		const createdByDate = {}
		let lastActiveCount = 0
		const sections = new Set()
		let section = ''
		let headers = null

		for (const row of rows) {
			if (row.length === 1) {
				section = row[0].trim()
				headers = null
				continue
			}
			if (section !== 'Added Students' && section !== 'Last Active') continue

			if (!headers) {
				headers = row.map((cell) => cell.trim())
				const required = [
					'First',
					'Last',
					section === 'Added Students' ? 'Created' : 'Active'
				]
				if (
					!required.every((name) => headers.includes(name)) ||
					sections.has(section)
				) {
					throw new Error(
						'Unexpected columns or repeated section in the growth report.'
					)
				}
				sections.add(section)
				continue
			}
			if (row.length !== headers.length)
				throw new Error('Incomplete row in the growth report.')
			if (section === 'Last Active') {
				lastActiveCount++
			} else {
				const day = auditDate(row[headers.indexOf('Created')])
				if (!day) {
					throw new Error(
						'A new student in the growth report has no usable Created date.'
					)
				}
				createdByDate[day] = (createdByDate[day] || 0) + 1
			}
		}

		if (sections.size !== 2) {
			throw new Error(
				'The growth report needs Added Students and Last Active sections.'
			)
		}
		return {kind: 'growth', data: {createdByDate, lastActiveCount}}
	}

	async function readReport(file) {
		if (!/\.csv$/i.test(file.name) || file.size > maxFileSize) {
			throw new Error('Choose CSV files up to 10 MB each.')
		}
		const {data: rows, errors} = Papa.parse(await file.text(), {
			delimiter: ',',
			skipEmptyLines: 'greedy'
		})
		if (errors.length)
			throw new Error('The metrics CSV contains a formatting error.')

		const headers = (rows[0] || []).map((cell) => cell.trim())
		if (headers.length === 1 && headers[0] === 'Added Students')
			return growthReport(rows)
		if (['Time', 'Style', 'Student ID'].every((key) => headers.includes(key))) {
			return attendanceReport(headers, rows.slice(1))
		}
		throw new Error(
			'Choose a Martialytics attendance or growth export for the graphs.'
		)
	}

	function showStatus(message = '', isError = false) {
		const selected = Object.values(names)
		status.textContent = [
			message,
			selected.length ? 'Selected: ' + selected.join(', ') : ''
		]
			.filter(Boolean)
			.join(' ')
		status.classList.toggle('is-error', isError)
		clear.hidden = !selected.length
	}

	function reset() {
		generation++
		busy = false
		reports = {}
		names = {}
		picker.value = ''
		showStatus()
		onStateChange()
	}

	choose.addEventListener('click', () => picker.click())
	clear.addEventListener('click', reset)
	document.addEventListener('audit:clear', reset)
	picker.addEventListener('change', async () => {
		const files = Array.from(picker.files)
		picker.value = ''
		if (!files.length || picker.closest('.upload-section').hidden) return
		const current = ++generation
		busy = true
		onStateChange()
		showStatus('Reading metrics…')

		try {
			if (files.length > 2)
				throw new Error('Choose at most one attendance and one growth CSV.')
			const additions = {}
			const filenames = {}
			for (const file of files) {
				const {kind, data} = await readReport(file)
				if (current !== generation) return
				if (kind in additions)
					throw new Error('Choose only one CSV per report type at a time.')
				additions[kind] = data
				filenames[kind] = file.name
			}
			reports = {...reports, ...additions}
			names = {...names, ...filenames}
			showStatus()
		} catch (error) {
			if (current === generation) showStatus(error.message, true)
		} finally {
			if (current === generation) {
				busy = false
				onStateChange()
			}
		}
	})

	return {
		get reports() {
			return reports
		},
		get busy() {
			return busy
		}
	}
}
