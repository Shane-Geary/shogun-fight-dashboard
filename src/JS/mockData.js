export const mockStudents = [
	{
		id: 'student-001',
		name: 'Avery Morgan',
		status: 'enrolled',
		source: 'Jotform + Martialytics',
		program: 'Adult BJJ',
		personal: {
			dateOfBirth: '1991-03-12',
			studentEmail: 'avery.morgan@example.com',
			studentPhone: '(000) 000-0000',
			guardian: null
		},
		jotform: {
			releaseDate: '2024-02-02',
			enrollmentDate: '2024-02-03',
			cancellationDate: null
		},
		martialytics: {
			membershipStatus: 'active',
			startDate: '2024-02-03',
			lastAttendance: '2026-10-06'
		},
		detailNote: null,
		review: null
	},
	{
		id: 'student-002',
		name: 'Jordan Ellis',
		status: 'cancelled',
		source: 'Jotform + Martialytics',
		program: 'Muay Thai',
		personal: {
			dateOfBirth: '2008-08-21',
			studentEmail: 'jordan.ellis@example.com',
			studentPhone: '(000) 000-0000',
			guardian: null
		},
		jotform: {
			releaseDate: '2021-04-14',
			enrollmentDate: '2021-04-15',
			cancellationDate: '2026-09-15'
		},
		martialytics: {
			membershipStatus: 'inactive',
			startDate: '2021-04-15',
			lastAttendance: '2026-09-14'
		},
		detailNote: null,
		review: null
	},
	{
		id: 'student-003',
		name: 'Maya Chen',
		status: 'enrolled',
		source: 'Jotform + Martialytics',
		program: 'Kids MMA',
		personal: {
			dateOfBirth: '2016-05-18',
			studentEmail: null,
			studentPhone: null,
			guardian: {
				name: 'Alex Chen',
				email: 'alex.chen@example.com',
				phone: '(000) 000-0000'
			}
		},
		jotform: {
			releaseDate: '2026-08-10',
			enrollmentDate: '2026-08-12',
			cancellationDate: null
		},
		martialytics: {
			membershipStatus: 'active',
			startDate: '2026-08-12',
			lastAttendance: '2026-10-06'
		},
		detailNote: null,
		review: null
	},
	{
		id: 'student-004',
		name: 'Riley Brooks',
		status: 'trial',
		source: 'Jotform only',
		program: null,
		personal: {
			dateOfBirth: '2002-11-09',
			studentEmail: 'riley.brooks@example.com',
			studentPhone: '(000) 000-0000',
			guardian: null
		},
		jotform: {
			releaseDate: '2026-10-06',
			enrollmentDate: null,
			cancellationDate: null
		},
		martialytics: null,
		detailNote:
			'Release submitted for a trial. No enrollment submission is available.',
		review: null
	},
	{
		id: 'student-005',
		name: 'Sam Rivera',
		status: 'enrolled',
		source: 'Jotform + Martialytics',
		program: 'Adult BJJ',
		personal: {
			dateOfBirth: '1998-06-24',
			studentEmail: 'sam.rivera@example.com',
			studentPhone: '(000) 000-0000',
			guardian: null
		},
		jotform: {
			releaseDate: '2025-01-10',
			enrollmentDate: '2025-01-12',
			cancellationDate: '2026-10-05'
		},
		martialytics: {
			membershipStatus: 'active',
			startDate: '2025-01-12',
			lastAttendance: '2026-10-06'
		},
		detailNote: null,
		review: {
			needed: true,
			message:
				'Cancellation submitted · 10/05/2026 — Martialytics account remains Active. Review the discrepancy; enrollment and membership status are shown separately.'
		}
	}
]
