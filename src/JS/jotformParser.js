function normalizeJotformSubmission(submission) {
	const typeById = {
		262785031969166: 'release',
		262785002301144: 'enrollment',
		262784995113165: 'adjustment'
	}

	const formId = String(submission.form_id)
	let formType = Object.hasOwn(typeById, formId) ? typeById[formId] : 'unmapped'
	const enrollment = formType === 'enrollment'
	const release = formType === 'release'
	const usesParticipantFields = release || enrollment
	const adjustment = formType === 'adjustment'
	const knownForm = usesParticipantFields || adjustment
	const answers = submission.answers || {}
	const byId = (id) => answers[id]?.answer

	function field(...labels) {
		const hits = Object.values(answers).filter((question) => {
			const label = folded(question.text)
				.replace(/\s*\(required[^)]*\)\s*$/, '')
				.replace(/[:*]+$/, '')
				.trim()

			return question.answer != null && labels.includes(label)
		})

		return hits.length === 1 ? hits[0].answer : null
	}

	function name(value) {
		if (typeof value === 'string') return value.trim()
		return [value?.first, value?.last].filter(Boolean).join(' ').trim()
	}

	function date(value) {
		if (!value?.year || !value.month || !value.day) return auditDate(value)
		return auditDate(
			[
				value.year,
				String(value.month).padStart(2, '0'),
				String(value.day).padStart(2, '0')
			].join('-')
		)
	}

	if (adjustment) {
		const action = folded(
			byId(36) ||
				field(
					'request type',
					'type of request',
					'membership adjustment',
					'adjustment type'
				)
		)
		const stopDate = date(
			byId(38) ||
				field('cancellation date', 'cancel date', 'requested cancellation date')
		)
		const resumeDate = date(byId(39) || field('resume date', 'return date'))

		// The form combines pauses and cancellations. A resume date means a pause.
		const openEndedStop =
			(!action || action === 'pause/cancel membership') &&
			stopDate &&
			!resumeDate
		const explicitCancellation = [
			'cancel',
			'cancellation',
			'cancel membership',
			'membership cancellation'
		].includes(action)

		if (openEndedStop || explicitCancellation) formType = 'cancellation'
	}

	const adjustmentPayer = adjustment ? name(byId(5)) : ''
	const adjustmentStudent = adjustment ? name(byId(30)) : ''

	const student = release
		? name(byId(5))
		: adjustmentStudent ||
			name(
				field(
					'student name',
					"student's name",
					'name of student',
					'participant name',
					'student full name'
				)
			)

	const listed = adjustmentPayer || name(field('name', 'full name'))
	const otherPayer =
		adjustmentPayer && student && !same(adjustmentPayer, student)
	const guardian = name(
		usesParticipantFields
			? byId(9)
			: field(
					'guardian name',
					'parent/guardian name',
					'parent or guardian name',
					'parent/guardian'
				)
	)
	const emailValue =
		(knownForm ? byId(7) : null) ??
		field('email', 'email address', 'contact email')
	const phoneValue =
		(knownForm ? byId(8) : null) ??
		field('phone', 'phone number', 'contact phone')
	const email = typeof emailValue === 'string' ? emailValue.trim() : ''
	const phone =
		typeof phoneValue === 'string' ? phoneValue : phoneValue?.full || ''

	const primary = {
		name:
			student ||
			adjustmentPayer ||
			(!enrollment && !same(listed, guardian) ? listed : ''),
		listed,
		explicitStudent: Boolean(student || adjustmentPayer),
		payer: enrollment ? name(byId(5)) : '',
		guardian,
		email: otherPayer ? '' : email,
		phone: otherPayer ? '' : phone,
		...(otherPayer ? {familyEmail: email, familyPhone: phone} : {}),
		dob: date(
			usesParticipantFields
				? byId(26)
				: field(
						'date of birth',
						'dob',
						'student date of birth',
						"student's date of birth"
					)
		)
	}

	const people = [primary]

	if (usesParticipantFields) {
		for (const [nameId, dobId] of [
			[20, 45],
			[22, 46],
			[23, 47]
		]) {
			const member = {
				name: name(byId(nameId)),
				dob: date(byId(dobId)),
				explicitStudent: true
			}

			if (member.name || member.dob) {
				people.push({
					...member,
					guardian,
					familyEmail: email,
					familyPhone: phone
				})
			}
		}
	}

	return {
		formId,
		submissionId: String(submission.id),
		formType,
		people,
		formDate:
			date(
				(knownForm ? byId(14) : null) ?? field("today's date", 'date signed')
			) || auditDate(submission.created_at),
		program: enrollment ? byId(66) : field('program selection', 'program')
	}
}
