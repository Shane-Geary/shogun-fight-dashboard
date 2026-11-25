const folded = (value) =>
	String(value ?? '')
		.normalize('NFC')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase()

const same = (a, b) => Boolean(folded(a)) && folded(a) === folded(b)

function phoneKey(value) {
	return String(value ?? '')
		.replace(/\D/g, '')
		.replace(/^1(?=\d{10}$)/, '')
}

function auditDate(value) {
	const raw = String(value ?? '').trim()
	const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/)
	const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
	if (!iso && !us) return null

	const day = iso
		? iso.slice(1).join('-')
		: [us[3], us[1].padStart(2, '0'), us[2].padStart(2, '0')].join('-')

	const stamp = Date.parse(day + 'T00:00:00Z')
	return Number.isFinite(stamp) &&
		new Date(stamp).toISOString().slice(0, 10) === day
		? day
		: null
}

function isYouth(dob, onDate) {
	if (!dob || !onDate || dob > onDate) return false

	const years = Number(onDate.slice(0, 4)) - Number(dob.slice(0, 4))
	const beforeBirthday = onDate.slice(5) < dob.slice(5)
	return years - Number(beforeBirthday) < 18
}

function rosterPerson(row) {
	// row is the actual Papa Parse row returned by csvParser.js.
	const fields = new Map(
		Object.entries(row).map(([key, value]) => [
			key.toLowerCase().replace(/[^a-z0-9]/g, ''),
			String(value ?? '').trim()
		])
	)

	const get = (...keys) =>
		keys.map((key) => fields.get(key)).find(Boolean) || ''
	const dob = auditDate(get('dob', 'dateofbirth', 'birthdate', 'birthday'))

	const activeFlag = get('isactive')
	const legacyStatus = get('status').toLowerCase()
	let membershipStatus = ['active', 'inactive'].includes(legacyStatus)
		? legacyStatus
		: null

	if (activeFlag === '1') membershipStatus = 'active'
	if (activeFlag === '0') membershipStatus = 'inactive'

	return {
		id: String(row.ID).trim(),
		name: [row.First, row.Last].filter(Boolean).join(' ').trim(),
		email: row.Email?.trim(),
		phone: get('mobile', 'mobilephone', 'mobilenumber', 'phone', 'phonenumber'),
		dob,
		youth: isYouth(dob, new Date().toISOString().slice(0, 10)),
		emergency: get('emergencycontact', 'emergencycontactname', 'emergencyname'),
		familyEmail: get('emergencycontactemail', 'guardianemail'),
		familyPhone: get(
			'emergencynumber',
			'emergencycontactphone',
			'emergencyphone'
		),
		info: {
			membershipStatus,
			startDate: auditDate(
				get(
					'joinedon',
					'startdate',
					'membershipstartdate',
					'joindate',
					'datejoined',
					'joined'
				)
			),
			program:
				get('stylesranks', 'program', 'membershipprogram', 'classes') || null,
			lastAttendance: auditDate(
				get('lastattended', 'lastattendance', 'lastvisit', 'lastcheckin')
			)
		}
	}
}

// A positive rank identifies usable evidence. A negative rank flags a conflict.
// Zero means the records have no usable connection.
function identityRank(a, b) {
	// A generic “Name” on another form can be the child's listed guardian.
	const aName = !a.explicitStudent && same(a.listed, b.guardian) ? '' : a.name
	const bName = !b.explicitStudent && same(b.listed, a.guardian) ? '' : b.name

	const named = same(aName, bName)
	const birth = same(a.dob, b.dob)
	const mail = same(a.email, b.email)
	const youth = a.youth || b.youth

	const guardian =
		same(a.guardian, b.guardian || b.emergency) ||
		same(a.guardian, b.listed) ||
		same(b.guardian, a.listed)

	const household =
		guardian ||
		same(a.familyEmail, b.familyEmail) ||
		same(phoneKey(a.familyPhone), phoneKey(b.familyPhone)) ||
		same(a.familyEmail, b.email) ||
		same(b.familyEmail, a.email) ||
		same(phoneKey(a.familyPhone), phoneKey(b.phone)) ||
		same(phoneKey(b.familyPhone), phoneKey(a.phone))

	if (a.dob && b.dob && !birth) {
		if (aName && bName && !named) return 0
		return named || (!youth && mail) ? -1 : 0
	}
	if (aName && bName && !named) return !youth && mail ? -1 : 0

	if (named && birth) return mail || household ? 6 : 5

	if (youth) {
		if (household && (named || birth)) return 3
		return named || (household && (!aName || !bName)) ? -1 : 0
	}

	if (!aName || !bName) {
		const payerAgrees = same(a.payer, b.name) || same(b.payer, a.name)
		if ((birth && (mail || payerAgrees)) || (mail && payerAgrees)) return 3
		return mail || payerAgrees ? -1 : 0
	}

	if (mail) return 4
	if (named && a.email && b.email) return -1
	return named ? 1 : 0
}

function pickMatch(person, candidates) {
	let best = 0
	let hits = []
	let conflict = false

	for (const candidate of candidates) {
		const rank = identityRank(person, candidate)
		if (rank < 0) conflict = true
		if (rank <= 0 || rank < best) continue

		if (rank > best) hits = []
		best = rank
		hits.push(candidate)
	}

	const found = hits.length === 1 && !(best === 1 && conflict) ? hits[0] : null
	return {found, uncertain: !found && (conflict || hits.length > 0)}
}

function graphRosterTotals(roster) {
	const joinsByDate = {}
	let undated = 0
	let knownStatus = 0
	let active = 0

	for (const {info} of roster) {
		if (info.membershipStatus) knownStatus++
		if (info.membershipStatus === 'active') active++

		if (info.startDate) {
			joinsByDate[info.startDate] = (joinsByDate[info.startDate] || 0) + 1
		} else {
			undated++
		}
	}

	return {
		joinsByDate: undated < roster.length ? joinsByDate : null,
		undated,
		activeAtExport: knownStatus ? active : null
	}
}

function buildAuditStudents(rows, forms, completeHistory = false) {
	const roster = rows.map(rosterPerson)
	const groups = []

	const events = forms.flatMap((form) =>
		form.people.map((person, slot) => {
			const participantForm =
				form.formType === 'release' || form.formType === 'enrollment'
			const youth =
				person.dob && form.formDate
					? isYouth(person.dob, form.formDate)
					: Boolean(
							person.guardian ||
							(participantForm && (person.familyEmail || person.familyPhone))
						)

			const identity = {...person, youth}

			if (youth) {
				identity.familyEmail ||= identity.email
				identity.familyPhone ||= identity.phone
				identity.email = ''
				identity.phone = ''
			}

			return {form, identity, slot}
		})
	)

	// Establish named people before trying to attach a signer-only enrollment.
	function strength({identity}) {
		return (
			8 * Boolean(identity.name && identity.explicitStudent) +
			4 * Boolean(identity.name) +
			2 * Boolean(identity.dob) +
			Number(Boolean(identity.guardian || identity.email))
		)
	}

	events.sort(
		(a, b) =>
			strength(b) - strength(a) ||
			a.form.submissionId.localeCompare(b.form.submissionId)
	)

	// First consolidate Jotforms. Two people listed on the same form stay separate.
	for (const {form, identity, slot} of events) {
		const eligible = groups.filter(
			(group) =>
				!group.forms.some(
					(existing) => existing.submissionId === form.submissionId
				)
		)
		const result = pickMatch(identity, eligible)
		const group = result.found || {
			...identity,
			id: 'jf-' + form.submissionId + '-' + slot,
			forms: [],
			notes: []
		}

		if (!result.found) groups.push(group)
		if (result.uncertain)
			group.notes.push('Conflicting or ambiguous identity across forms.')

		for (const [key, value] of Object.entries(identity)) {
			if (
				key === 'name' &&
				!identity.explicitStudent &&
				same(identity.listed, group.guardian)
			)
				continue
			if (!group[key] && value) group[key] = value
		}

		group.forms.push(form)
	}

	// Then attach Martialytics. Two unresolved people cannot claim the same roster row.
	const claims = new Map()

	for (const group of groups) {
		const {found, uncertain} = pickMatch(group, roster)
		if (uncertain) group.notes.push('Check the possible Martialytics match.')
		if (!found) continue

		if (!claims.has(found)) claims.set(found, [])
		claims.get(found).push(group)
	}

	for (const row of roster) {
		const owners = claims.get(row) || []

		if (owners.length === 1) {
			owners[0].row = row
		} else {
			for (const group of owners) {
				group.notes.push(
					'Multiple form identities point to roster ID ' + row.id + '.'
				)
			}
			groups.push({
				id: row.id,
				row,
				forms: [],
				notes: ['No confirmed Jotform link.']
			})
		}
	}

	const familyBilling = new Map()

	const studentGroups = groups.filter((group) => {
		if (group.row || group.name || !group.payer || group.forms.length !== 1) {
			return true
		}

		const [form] = group.forms
		if (
			form.formType !== 'enrollment' ||
			!form.people.slice(1).some((person) => person.name)
		) {
			return true
		}

		const paysForChild = groups.some(
			(member) =>
				member !== group &&
				member.forms.includes(form) &&
				(member.youth || member.row?.youth) &&
				(same(group.payer, member.guardian) ||
					same(group.payer, member.row?.emergency))
		)

		if (!paysForChild) return true

		familyBilling.set(form.submissionId, `Enrollment payer: ${group.payer}.`)
		return false
	})

	const students = []
	const matchReview = []

	for (const group of studentGroups) {
		const row = group.row
		const name = group.name || row?.name
		const submissionIds = [
			...new Set(group.forms.map((form) => form.submissionId))
		]

		if (!name || !group.forms.length || (!row && group.notes.length)) {
			const reference = row
				? `CSV ID ${row.id}`
				: `Jotform ${submissionIds.join(', ')}`

			const reason =
				group.notes.join(' ') || 'Participant identity unconfirmed.'
			matchReview.push(
				`${name || group.payer || 'Unnamed participant'} (${reference}). ${reason}`
			)
			continue
		}

		const dates = {}
		const kinds = new Set(group.forms.map((form) => form.formType))

		for (const form of group.forms) {
			if (!['release', 'enrollment', 'cancellation'].includes(form.formType)) {
				group.notes.push(
					`Review form ${form.formId}, submission ${form.submissionId}.`
				)
				continue
			}

			const key = form.formType + 'Date'
			if (form.formDate && form.formDate > (dates[key] || '')) {
				dates[key] = form.formDate
			}
		}

		const active = row?.info.membershipStatus === 'active'
		const cancelled =
			dates.cancellationDate &&
			dates.cancellationDate >= (dates.enrollmentDate || '')

		let status = 'unknown'

		if (cancelled && active) {
			status = 'enrolled'
			group.notes.push(
				`Cancellation submitted on ${dates.cancellationDate}. Martialytics membership remains active.`
			)
		} else if (cancelled) {
			status = 'cancelled'
		} else if (kinds.has('enrollment') || active) {
			status = 'enrolled'
		} else if (
			kinds.size === 1 &&
			kinds.has('release') &&
			!row &&
			completeHistory &&
			!group.notes.length
		) {
			status = 'trial'
		}

		const minor = group.youth || row?.youth
		const guardianName = group.guardian || (minor && row?.emergency) || ''
		const guardianEmail = group.familyEmail || (minor && row?.familyEmail) || ''
		const guardianPhone = group.familyPhone || (minor && row?.familyPhone) || ''

		const guardian =
			minor && (guardianName || guardianEmail || guardianPhone)
				? {name: guardianName, email: guardianEmail, phone: guardianPhone}
				: null

		const household =
			!minor && (group.familyEmail || group.familyPhone)
				? {email: group.familyEmail, phone: group.familyPhone}
				: null

		students.push({
			id: row?.id || group.id,
			name,
			source: row ? 'Martialytics + Jotform' : 'Jotform only',
			status,
			program:
				row?.info.program ||
				group.forms.find((form) => form.program)?.program ||
				null,
			personal: {
				dateOfBirth: group.dob || row?.dob,
				studentEmail:
					[group.email, row?.email].find(
						(email) => email && !same(email, guardianEmail)
					) || null,
				studentPhone:
					[group.phone, row?.phone].find(
						(phone) => phone && !same(phoneKey(phone), phoneKey(guardianPhone))
					) || null,
				guardian,
				household
			},
			martialytics: row?.info || null,
			jotform: dates,
			submissionIds,
			detailNote:
				status === 'trial'
					? 'Release submitted for a trial. No enrollment submission is available.'
					: group.forms
							.map((form) => familyBilling.get(form.submissionId))
							.filter(Boolean)
							.join(' ') || null,
			review: group.notes.length
				? {needed: true, message: [...new Set(group.notes)].join(' ')}
				: null
		})
	}

	return {students, matchReview, graphs: graphRosterTotals(roster)}
}
