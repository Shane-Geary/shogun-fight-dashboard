function normalizeJotformSubmission(submission) {
	const formId = String(submission?.form_id ?? '')
	const reference = {
		formId: formId || null,
		submissionId: submission?.id == null ? null : String(submission.id),
		submittedAt: submission?.created_at ?? null
	}

	// Question IDs belong to a specific form. Preserve other forms for review.
	if (formId !== '262785002301144') {
		return {...reference, formType: 'unmapped'}
	}

	const answer = (id) => submission.answers?.[id]?.answer

	function text(value) {
		return typeof value === 'string' ? value.trim() || null : null
	}

	function name(value) {
		const First = text(value?.first)
		const Last = text(value?.last)
		const middle = text(value?.middle)
		const suffix = text(value?.suffix)

		if (!First && !Last && !middle && !suffix) return null
		return {First, Last, middle, suffix}
	}

	// Return a calendar date in the YYYY-MM-DD format used by the cards.
	function date(value) {
		if (!value?.year || !value.month || !value.day) return null

		const iso = [
			String(value.year),
			String(value.month).padStart(2, '0'),
			String(value.day).padStart(2, '0')
		].join('-')

		if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null

		const parsed = new Date(iso + 'T00:00:00Z')
		if (Number.isNaN(parsed.getTime())) return null

		// Reject impossible dates such as February 30.
		return parsed.toISOString().slice(0, 10) === iso ? iso : null
	}

	// Each additional person's name and DOB have their own question IDs.
	const familyFields = [
		{personNumber: 2, nameId: 20, dobId: 45},
		{personNumber: 3, nameId: 22, dobId: 46},
		{personNumber: 4, nameId: 23, dobId: 47}
	]

	const additionalMembers = []

	for (const {personNumber, nameId, dobId} of familyFields) {
		const memberName = name(answer(nameId))
		const dateOfBirth = date(answer(dobId))

		if (memberName || dateOfBirth) {
			additionalMembers.push({personNumber, name: memberName, dateOfBirth})
		}
	}

	return {
		...reference,
		formType: 'release',
		formDate: date(answer(14)), // “Today's Date” on the form
		paymentRecordName: name(answer(5)),
		guardianName: name(answer(9)),
		primaryDateOfBirth: date(answer(26)),
		contact: {
			Email: text(answer(7)),
			Phone: text(answer(8)?.full)
		},
		program: text(answer(66)),
		additionalMembers
	}
}
