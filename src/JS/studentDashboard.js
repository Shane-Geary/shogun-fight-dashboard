import {mockStudents} from './mockData.js'

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

function renderStudentCard(student) {
	const personal = student.personal || {}
	const guardian = personal.guardian
	const martialytics = student.martialytics
	const jotform = student.jotform || {}
	const status = Object.hasOwn(statusLabels, student.status)
		? student.status
		: 'unknown'
	const contactName = guardian?.name || student.name
	const email = guardian?.email || personal.studentEmail
	const phone = guardian?.phone || personal.studentPhone
	const cancellationDiscrepancy =
		Boolean(jotform.cancellationDate) &&
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
						<span class="status-badge status-badge--${status}">${statusLabels[status] || 'Unknown'}</span>
					</div>
					<div class="student-card__overview">
						<span>${escapeHTML(student.program || 'Program not listed')}</span>
						<span>${escapeHTML(student.source || 'Source not listed')}</span>
					</div>
					<span class="expand-indicator" aria-hidden="true"></span>
				</summary>
				<div class="student-card__details">
					<section class="detail-section" aria-label="Personal and contact details">
						<h3>Personal &amp; contact</h3>
						<dl>
							<div><dt>Date of birth</dt><dd>${formatDate(personal.dateOfBirth)}</dd></div>
							<div><dt>Email</dt><dd>${escapeHTML(email || '—')}</dd></div>
							<div><dt>Phone</dt><dd>${escapeHTML(phone || '—')}</dd></div>
							${guardian ? `<div><dt>Guardian</dt><dd>${escapeHTML(guardian.name || '—')}</dd></div>` : ''}
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
							<div><dt>Membership</dt><dd>${escapeHTML(martialytics?.membershipStatus || 'No record')}</dd></div>
							<div><dt>Start date</dt><dd>${formatDate(martialytics?.startDate)}</dd></div>
							<div><dt>Program</dt><dd>${escapeHTML(martialytics?.program || student.program || '—')}</dd></div>
							<div><dt>Last attendance</dt><dd>${formatDate(martialytics?.lastAttendance)}</dd></div>
						</dl>
					</section>
					
					${followUpAction}
				</div>
				${reviewNeeded ? `<p class="review-alert"><strong>Review needed</strong> ${escapeHTML(reviewMessage)}</p>` : ''}
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

renderStudentCards(document.querySelector('#students'), mockStudents)
