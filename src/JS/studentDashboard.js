// import {mockStudents} from './mockData.js'
import {enableGraphView, lastCompleteWeek} from './auditGraphs.js'
let students = []

const statusLabels = {
	enrolled: 'Enrolled',
	cancelled: 'Cancelled',
	trial: 'Trial'
}

function escapeHTML(value) {
	return String(value ?? '').replace(/[&<>"']/g, (character) => {
		const entities = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		}
		return entities[character]
	})
}

function formatDate(value) {
	if (!value) {
		return '—'
	}

	const [year, month, day] = String(value).split('-').map(Number)
	if (!year || !month || !day) {
		return escapeHTML(value)
	}

	return new Date(year, month - 1, day).toLocaleDateString('en-US', {
		month: '2-digit',
		day: '2-digit',
		year: 'numeric'
	})
}

function hasCurrentCancellation(jotform) {
	return (
		Boolean(jotform?.cancellationDate) &&
		jotform.cancellationDate >= (jotform.enrollmentDate || '')
	)
}

function renderStudentCard(student) {
	const personal = student.personal || {}
	const guardian = personal.guardian
	const phone = guardian?.phone || personal.studentPhone
	const family = guardian || personal.household
	const familyLabel = guardian ? 'Guardian' : 'Household'
	const martialytics = student.martialytics
	const jotform = student.jotform || {}
	const status = Object.hasOwn(statusLabels, student.status)
		? student.status
		: 'unknown'

	const cancellationDiscrepancy =
		hasCurrentCancellation(jotform) &&
		martialytics?.membershipStatus === 'active'
	const reviewNeeded = Boolean(
		student.review?.needed || cancellationDiscrepancy
	)
	const reviewMessage =
		student.review?.message ||
		(cancellationDiscrepancy
			? `Cancellation submitted on ${formatDate(jotform.cancellationDate)}, but membership is still active.`
			: '')
	// Jotform-only trial students get a manual SMS follow-up button.
	// The phone value prioritizes the guardian's number, if no number is found, it is noted as unavailable.
	const isJotformTrial =
		student.status === 'trial' && student.source === 'Jotform only'

	const followUpMessage =
		"Hi there, this is Shogun Fight Co. We wanted to follow up regarding your trial class you recently completed with us. We would love for you to train with us! Please let us know if there's anything holding you back. We're here for you!"

	const followUpAction = isJotformTrial
		? phone
			? `
			<section class="detail-section follow-up-section" aria-label="Follow-up actions">
				<h3>Follow-up</h3>
				<a
					class="follow-up-button"
					href="sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(followUpMessage)}"
					aria-label="Send text message to ${escapeHTML(phone)}"
				>
					Send Text
				</a>
				<p class="detail-note">Phone: ${escapeHTML(phone)}</p>
			</section>
		`
			: `
			<section class="detail-section follow-up-section" aria-label="Follow-up actions">
				<h3>Follow-up</h3>
				<p class="detail-note">No phone number available for text follow-up.</p>
			</section>
		`
		: ''

	// The Send Text button opens the device's messaging app with the recipient
	// and follow-up message pre-filled for staff to review and send manually.

	return `
		<article class="student-card">
			<details>
				<summary class="student-card__summary">
					<div class="student-card__identity">
						<h2>${escapeHTML(student.name)}</h2>
						${reviewNeeded ? '<span class="review-indicator"><span aria-hidden="true">⚠</span> Review needed</span>' : ''}
						<span class="status-badge status-badge--${status}">${statusLabels[status] || 'Unknown'}</span>
					</div>
					<div class="student-card__overview">
						<span>${escapeHTML(student.program || 'Program not listed')}</span>
						<span>${escapeHTML(student.source || 'Source not listed')}</span>
					</div>
					<span class="expand-indicator" aria-hidden="true"></span>
				</summary>
				${reviewNeeded ? `<p class="review-alert"><span aria-hidden="true">⚠</span> ${escapeHTML(reviewMessage)}</p>` : ''}
				<div class="student-card__details">
					<section class="detail-section" aria-label="Personal and contact details">
						<h3>Personal &amp; contact</h3>
						<dl>
							<div><dt>Date of birth</dt><dd>${formatDate(personal.dateOfBirth)}</dd></div>
							<div><dt>Student email</dt><dd>${escapeHTML(personal.studentEmail || '—')}</dd></div>
							<div><dt>Student phone</dt><dd>${escapeHTML(personal.studentPhone || '—')}</dd></div>
							<div><dt>Guardian</dt><dd>${escapeHTML(guardian?.name || '—')}</dd></div>
							${
								family
									? `
										<div><dt>${familyLabel} email</dt><dd>${escapeHTML(family.email || '—')}</dd></div>
										<div><dt>${familyLabel} phone</dt><dd>${escapeHTML(family.phone || '—')}</dd></div>
									`
									: ''
							}
						</dl>
					</section>
					<section class="detail-section" aria-label="Jotform submission details">
						<h3>Jotform submissions</h3>
						<dl>
							<div><dt>Release date</dt><dd>${formatDate(jotform.releaseDate)}</dd></div>
							<div><dt>Enrollment date</dt><dd>${formatDate(jotform.enrollmentDate)}</dd></div>
							<div><dt>Cancellation date</dt><dd>${formatDate(jotform.cancellationDate)}</dd></div>
						</dl>
						${student.detailNote ? `<p class="detail-note">${escapeHTML(student.detailNote)}</p>` : ''}
					</section>
					<section class="detail-section" aria-label="Martialytics membership details">
						<h3>Martialytics</h3>
						<dl>
							<div><dt>Membership</dt><dd>${escapeHTML(martialytics ? martialytics.membershipStatus || 'Unknown' : 'No record')}</dd></div>
							<div><dt>Start date</dt><dd>${formatDate(martialytics?.startDate)}</dd></div>
							<div><dt>Program</dt><dd>${escapeHTML(martialytics?.program || '—')}</dd></div>
							<div><dt>Last attendance</dt><dd>${formatDate(martialytics?.lastAttendance)}</dd></div>
						</dl>
					</section>
					
					${followUpAction}
				</div>
			</details>
		</article>
	`
}

export function renderStudentCards(container, students) {
	if (!(container instanceof Element)) {
		throw new TypeError('renderStudentCards expects a DOM element container')
	}
	if (!Array.isArray(students)) {
		throw new TypeError(
			'renderStudentCards expects an array of student objects'
		)
	}

	container.innerHTML = students.length
		? students.map(renderStudentCard).join('')
		: '<p class="empty-state">No student records available.</p>'
}

const studentsContainer = document.querySelector('#students')

// renderStudentCards(
// 	studentsContainer,
// 	[...mockStudents].sort((a, b) => a.name.localeCompare(b.name))
// )

// document.querySelector('#studentResultCount').textContent =
// `STUDENTS · ${mockStudents.length} RESULTS`
const studentSearch = document.querySelector('#studentSearch')
const statusFilter = document.querySelector('#statusFilter')
const sourceFilter = document.querySelector('#sourceFilter')
const sortStudents = document.querySelector('#sortStudents')
const resetFilters = document.querySelector('#resetFilters')

studentSearch.addEventListener('input', () => {
	document.querySelector('#sortStudentsLabel').textContent =
		sortStudents.selectedOptions[0].text

	const searchText = studentSearch.value.toLowerCase().trim()

	const filteredStudents = students.filter((student) => {
		const family = student.personal?.guardian || student.personal?.household
		const searchableText = [
			student.name,
			student.id,
			student.personal?.guardian?.name,
			student.personal?.guardian?.email,
			student.personal?.guardian?.phone,
			student.personal?.studentEmail,
			student.personal?.studentPhone,
			family?.email,
			family?.phone
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase()

		const phoneNumbers = [student.personal?.studentPhone, family?.phone]
			.filter(Boolean)
			.map((phone) => phone.replace(/\D/g, ''))

		const searchDigits = searchText.replace(/\D/g, '')

		const matchesSearch =
			searchableText.includes(searchText) ||
			(searchDigits.length >= 3 &&
				phoneNumbers.some((phone) => phone.includes(searchDigits)))

		const matchesStatus =
			statusFilter.value === 'all' ||
			student.status === statusFilter.value ||
			(statusFilter.value === 'cancelled' &&
				hasCurrentCancellation(student.jotform)) ||
			(statusFilter.value === 'jotform' && student.source === 'Jotform only') ||
			(statusFilter.value === 'both' &&
				student.source === 'Martialytics + Jotform')

		const matchesSource =
			sourceFilter.value === 'all' ||
			(sourceFilter.value === 'jotform' && student.source === 'Jotform only') ||
			(sourceFilter.value === 'both' &&
				student.source === 'Martialytics + Jotform')

		return matchesSearch && matchesStatus && matchesSource
	})

	if (sortStudents.value === 'name-asc') {
		filteredStudents.sort((a, b) =>
			a.name
				.trim()
				.split(/\s+/)
				.at(-1)
				.localeCompare(b.name.trim().split(/\s+/).at(-1))
		)
	} else if (sortStudents.value === 'name-desc') {
		filteredStudents.sort((a, b) =>
			b.name
				.trim()
				.split(/\s+/)
				.at(-1)
				.localeCompare(a.name.trim().split(/\s+/).at(-1))
		)
	} else if (
		sortStudents.value === 'oldest' ||
		sortStudents.value === 'newest'
	) {
		filteredStudents.sort((a, b) => {
			const dateA = a.jotform?.enrollmentDate
			const dateB = b.jotform?.enrollmentDate

			if (!dateA && !dateB) return 0
			if (!dateA) return 1
			if (!dateB) return -1

			return sortStudents.value === 'oldest'
				? dateA.localeCompare(dateB)
				: dateB.localeCompare(dateA)
		})
	}

	renderStudentCards(studentsContainer, filteredStudents)
	document.querySelector('#expandAllBtn').textContent = 'Expand All'
	const resultCount = filteredStudents.length

	document.querySelector('#studentResultCount').textContent =
		`STUDENTS · ${resultCount} ${resultCount === 1 ? 'RESULT' : 'RESULTS'}`

	const activeFilters = []

	if (studentSearch.value.trim()) {
		activeFilters.push('Search')
	}

	if (statusFilter.value !== 'all') {
		activeFilters.push(statusFilter.options[statusFilter.selectedIndex].text)
	}

	if (
		sourceFilter.value !== 'all' &&
		statusFilter.value !== 'jotform' &&
		statusFilter.value !== 'both'
	) {
		activeFilters.push(sourceFilter.options[sourceFilter.selectedIndex].text)
	}

	if (sortStudents.value !== 'name-asc') {
		activeFilters.push(sortStudents.options[sortStudents.selectedIndex].text)
	}

	document.querySelector('.student-controls__active').textContent =
		'Active filters: ' +
		(activeFilters.length ? activeFilters.join(', ') : 'None')
})
statusFilter.addEventListener('change', () => {
	studentSearch.dispatchEvent(new Event('input'))
})
sourceFilter.addEventListener('change', () => {
	studentSearch.dispatchEvent(new Event('input'))
})
sortStudents.addEventListener('change', () => {
	studentSearch.dispatchEvent(new Event('input'))
})
resetFilters.addEventListener('click', () => {
	studentSearch.value = ''
	statusFilter.value = 'all'
	sourceFilter.value = 'all'
	sortStudents.value = 'name-asc'

	studentSearch.dispatchEvent(new Event('input'))
})
// T-07: Display selected filters as non-clickable labels
const selectedFilterLabels = document.querySelector('#selectedFilterLabels')

function updateSelectedFilterLabels() {
	selectedFilterLabels.innerHTML = ''

	const filters = [
		{value: 'trial', text: 'Trial'},
		{value: 'enrolled', text: 'Enrolled'},
		{value: 'cancelled', text: 'Cancellations'},
		{value: 'jotform', text: 'Jotform only'}
	]

	filters.forEach((filter) => {
		const label = document.createElement('span')
		label.className = 'filter-label'

		if (statusFilter.value === filter.value) {
			label.classList.add('selected')
		}

		label.textContent = filter.text
		selectedFilterLabels.appendChild(label)
	})
}

statusFilter.addEventListener('change', updateSelectedFilterLabels)
resetFilters.addEventListener('click', updateSelectedFilterLabels)

updateSelectedFilterLabels()

// T-07: Expand or collapse all visible student cards
const expandAllBtn = document.querySelector('#expandAllBtn')

expandAllBtn.addEventListener('click', () => {
	const studentCards = document.querySelectorAll('#students details')
	const shouldExpand = expandAllBtn.textContent === 'Expand All'

	studentCards.forEach((card) => {
		card.open = shouldExpand
	})

	expandAllBtn.textContent = shouldExpand ? 'Collapse All' : 'Expand All'
})
function showMatchReview(messages) {
	const panel = document.querySelector('#matchReview')
	panel.hidden = messages.length === 0
	panel.querySelector('summary').textContent =
		`Records needing a match (${messages.length})`

	const items = messages.map((message) => {
		const item = document.createElement('li')
		item.textContent = message
		return item
	})

	panel.querySelector('ul').replaceChildren(...items)
}

const auditSummary = document.querySelector('#auditSummary')

function renderAuditSummary(students, cancellationCount) {
	const people = students.length
	const matched = students.filter(
		(student) => student.source === 'Martialytics + Jotform'
	).length
	const jotformOnly = students.filter(
		(student) => student.source === 'Jotform only'
	).length

	const metrics = [
		['People', people, 'One record per person'],
		['Jotform + Martialytics', matched, 'Matched across both sources'],
		['Jotform only', jotformOnly, 'No matched Martialytics record'],
		['Cancellations', cancellationCount, 'Cancellation submissions']
	]

	const cards = metrics.map(([label, count, detail]) => {
		const value = Number.isInteger(count) ? String(count).padStart(2, '0') : '—'

		return `
			<div>
				<dt>${label}</dt>
				<dd class="audit-summary__count">${value}</dd>
				<dd class="audit-summary__detail">${detail}</dd>
			</div>`
	})

	auditSummary.innerHTML = `
		<p class="audit-summary__status">
			<span aria-hidden="true">✓</span>
			Processing complete · ${people} ${people === 1 ? 'person' : 'people'} consolidated
		</p>
		<dl class="audit-summary__metrics">${cards.join('')}</dl>`

	auditSummary.hidden = false
}

document.addEventListener('audit:clear', () => {
	auditSummary.hidden = true
	auditSummary.replaceChildren()
	showMatchReview([])
	students = []
	studentSearch.value = ''
	studentsContainer.replaceChildren()
})

document.querySelector('#newAuditButton').addEventListener('click', () => {
	location.replace('/Pages/csvUpload.html')
})

async function loadDashboard() {
	if (!(await auditSession.ready)) return

	const results = auditSession.takeResults()

	if (!results) {
		location.replace('/Pages/csvUpload.html')
		return
	}

	// Temporary checkpoint until T-05 produces matched student records.
	if (!Array.isArray(results.students)) {
		document.querySelector('.student-controls').style.display = 'none'

		studentsContainer.textContent =
			`Martialytics rows: ${results.martialyticsCount} · ` +
			`Jotform submissions: ${results.jotformCount}. Matching pending.`

		return
	}

	showMatchReview(results.matchReview || [])
	students = results.students
	renderAuditSummary(students, results.cancellationCount)
	if (results.graphs) {
		enableGraphView(lastCompleteWeek(results.graphs))
	}
	studentSearch.dispatchEvent(new Event('input'))
}

loadDashboard()
