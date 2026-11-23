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

	const action = field(
		'request type',
		'type of request',
		'membership adjustment',
		'adjustment type'
	)
	const cancelDate = date(
		field('cancellation date', 'cancel date', 'requested cancellation date')
	)
	const resumeDate = date(field('resume date', 'return date'))

	if (formType === 'adjustment') {
		const cancellation = action
			? /^(cancel|cancellation|cancel membership|membership cancellation)$/i.test(
					String(action).trim()
				)
			: cancelDate && !resumeDate

		if (cancellation) formType = 'cancellation'
	}

	const student = release
		? name(byId(5))
		: name(
				field(
					'student name',
					"student's name",
					'name of student',
					'participant name',
					'student full name'
				)
			)
	const listed = name(field('name', 'full name'))
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
	const emailValue = usesParticipantFields
		? byId(7)
		: field('email', 'email address', 'contact email')
	const phoneValue = usesParticipantFields
		? byId(8)
		: field('phone', 'phone number', 'contact phone')
	const email = typeof emailValue === 'string' ? emailValue.trim() : ''
	const phone =
		typeof phoneValue === 'string' ? phoneValue : phoneValue?.full || ''

	const primary = {
		name: student || (!enrollment && !same(listed, guardian) ? listed : ''),
		listed,
		explicitStudent: Boolean(student),
		payer: enrollment ? name(byId(5)) : '',
		guardian,
		email,
		phone,
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
				usesParticipantFields ? byId(14) : field("today's date", 'date signed')
			) || auditDate(submission.created_at),
		program: enrollment ? byId(66) : field('program selection', 'program')
	}
}
