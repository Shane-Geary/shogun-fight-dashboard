const palette = {
	Adult: '#409bea',
	Youth: '#19618b',
	Active: '#3298eb',
	New: '#20856d',
	Deactivated: '#c44b55'
}

// The prototype uses the last completed Monday–Saturday audit week.
// Use the gym's local date so staff in another timezone see the same week.
export function lastCompleteWeek(source, now = new Date()) {
	const localDate = new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now)

	const day = new Date(localDate + 'T12:00:00Z')
	day.setUTCDate(day.getUTCDate() - day.getUTCDay() - 6)

	const dates = Array.from({length: 6}, () => {
		const iso = day.toISOString().slice(0, 10)
		day.setUTCDate(day.getUTCDate() + 1)
		return iso
	})

	return {
		dates,
		joined:
			source.joinsByDate && dates.map((date) => source.joinsByDate[date] || 0),
		undated: source.undated,
		activeAtExport: source.activeAtExport
	}
}

export function enableGraphView(week) {
	const get = (id) => document.getElementById(id)
	const toggle = get('viewToggle')
	const users = document.querySelector('.student-section')
	const panel = get('graphView')
	const title = get('page-title')
	const subtitle = document.querySelector('.page-description')
	const userTitle = title.textContent
	const userSubtitle = subtitle.textContent
	const plots = []

	const dates = week.dates.map((day) => new Date(day + 'T12:00:00Z'))
	const format = (options) =>
		new Intl.DateTimeFormat('en-US', {timeZone: 'UTC', ...options})
	const weekday = format({weekday: 'short'})
	const labels = dates.map((date) => weekday.format(date))

	const sum = (values) => values.reduce((total, value) => total + value, 0)
	const average = (values) => (sum(values) / values.length).toFixed(1)
	const metric = (label, value) =>
		`<div><dt>${label}</dt><dd>${value ?? '—'}</dd></div>`

	get('graphDates').textContent = format({
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).formatRange(dates[0], dates[dates.length - 1])

	function draw(id, series, stacked) {
		const canvas = get(id)
		const available = series.filter((item) => Array.isArray(item.values))

		if (!available.length || !window.Chart) {
			canvas.parentElement.textContent = available.length
				? 'The chart library could not load.'
				: 'Daily check-in history is unavailable in this export.'
			return
		}

		canvas.setAttribute(
			'aria-label',
			available
				.map(
					({label, values}) =>
						label +
						': ' +
						labels.map((day, i) => day + ' ' + values[i]).join(', ')
				)
				.join('. ')
		)

		// Display each day's total above its stacked attendance bar.
		const attendanceTotals = {
			id: 'attendanceTotals',
			afterDatasetsDraw(chart) {
				const {
					ctx,
					scales: {x, y}
				} = chart
				ctx.save()
				ctx.fillStyle = '#17191c'
				ctx.textAlign = 'center'
				ctx.font = '11px Arial'

				labels.forEach((_, i) => {
					const total = available.reduce(
						(count, item, index) =>
							count + (chart.isDatasetVisible(index) ? item.values[i] : 0),
						0
					)
					ctx.fillText(
						total,
						x.getPixelForValue(i),
						y.getPixelForValue(total) - 5
					)
				})

				ctx.restore()
			}
		}

		plots.push(
			new window.Chart(canvas, {
				type: 'bar',
				data: {
					labels,
					datasets: available.map(({label, values}) => ({
						label,
						data: values,
						type: label === 'Active' ? 'line' : 'bar',
						backgroundColor: palette[label],
						borderColor: palette[label],
						borderWidth: label === 'Active' ? 2 : 0,
						pointRadius: 3,
						maxBarThickness: 40,
						order: label === 'Active' ? 0 : 1
					}))
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					animation: false,
					scales: {
						x: {stacked, grid: {display: false}},
						y: {
							stacked,
							beginAtZero: true,
							grace: '12%',
							ticks: {precision: 0},
							grid: {color: '#e6ebf0'}
						}
					},
					plugins: {
						legend: {
							position: 'top',
							align: 'start',
							labels: {boxWidth: 9, boxHeight: 9, padding: 14}
						}
					}
				},
				plugins: stacked ? [attendanceTotals] : []
			})
		)
	}

	function render() {
		const attendance = week.attendance
		const totals =
			attendance &&
			attendance.adult.map((count, i) => count + attendance.youth[i])

		get('attendanceStats').innerHTML =
			metric('Daily average', totals && average(totals)) +
			metric('Adult average', attendance && average(attendance.adult)) +
			metric('Youth average', attendance && average(attendance.youth))

		get('membershipStats').innerHTML =
			metric(
				week.activeByDay ? 'Active at week end' : 'Marked active in export',
				week.activeByDay?.at(-1) ?? week.activeAtExport
			) +
			metric('Recorded new students', week.joined && sum(week.joined)) +
			metric('Churn', week.deactivated && sum(week.deactivated))

		get('attendanceNote').textContent = totals
			? `${sum(totals)} check-ins across ${dates.length} days.`
			: 'Attendance averages require dated class check-ins.'

		get('membershipNote').textContent = [
			week.undated
				? `${week.undated} roster records lack a usable join date.`
				: '',
			week.deactivated
				? ''
				: 'Deactivation history is unavailable in this export.'
		]
			.filter(Boolean)
			.join(' ')

		draw(
			'attendanceChart',
			[
				{label: 'Adult', values: attendance?.adult},
				{label: 'Youth', values: attendance?.youth}
			],
			true
		)

		if (week.joined || week.activeByDay || week.deactivated) {
			draw(
				'membershipChart',
				[
					{label: 'Active', values: week.activeByDay},
					{label: 'New', values: week.joined},
					{label: 'Deactivated', values: week.deactivated}
				],
				false
			)
		} else {
			get('membershipChart').parentElement.textContent =
				'Dated membership activity is unavailable in this export.'
		}
	}

	let rendered = false

	function switchView(event) {
		const button = event.target.closest('button[data-view]')
		if (!button || button.getAttribute('aria-pressed') === 'true') return

		const graphs = button.dataset.view === 'graphs'
		users.hidden = graphs
		get('auditSummary').hidden = graphs
		panel.hidden = !graphs

		get(graphs ? 'graphSwitchSlot' : 'userSwitchSlot').append(toggle)

		for (const item of toggle.querySelectorAll('button')) {
			item.setAttribute('aria-pressed', String(item === button))
		}

		title.textContent = graphs ? 'Weekly audit graphs' : userTitle
		subtitle.textContent = graphs
			? 'Attendance and membership changes for your weekly review.'
			: userSubtitle

		button.focus()

		// Chart.js needs a visible container to measure its initial size.
		if (graphs && !rendered) {
			render()
			rendered = true
		} else if (graphs) {
			plots.forEach((chart) => chart.resize())
		}
	}

	toggle.hidden = false
	toggle.addEventListener('click', switchView)

	document.addEventListener(
		'audit:clear',
		() => {
			toggle.removeEventListener('click', switchView)
			toggle.hidden = true
			plots.forEach((chart) => chart.destroy())
			panel.hidden = true
			panel.replaceChildren()
		},
		{once: true}
	)
}
