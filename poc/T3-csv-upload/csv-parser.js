// Parse and validate a Martialytics CSV file
async function parseMartialyticsCsv(file) {
	if (!file) {
		throw new Error('No CSV file selected.')
	}

	if (typeof Papa === 'undefined') {
		throw new Error('CSV parser is not available.')
	}

	// Required columns from the Martialytics export
	const requiredColumns = ['ID', 'First', 'Last', 'Email', 'Status']

	return new Promise((resolve, reject) => {
		Papa.parse(file, {
			header: true,
			skipEmptyLines: 'greedy',
			transformHeader: (header) => header.trim(),

			complete: (results) => {
				const headers = results.meta.fields ?? []
				// Block CSV files with no student records
				if (results.data.length === 0) {
					reject(new Error('The CSV contains no student records.'))
					return
				}

				// Check for missing required columns
				const missingColumns = requiredColumns.filter(
					(column) => !headers.includes(column)
				)

				if (missingColumns.length > 0) {
					reject(
						new Error(`Missing required columns: ${missingColumns.join(', ')}`)
					)
					return
				}

				const errors = []
				const blockingErrors = []
				const studentIds = new Map()

				// Check for CSV formatting errors
				results.errors.forEach((error) => {
					const rowNumber =
						typeof error.row === 'number' ? error.row + 2 : 'unknown'

					blockingErrors.push(
						`CSV formatting error near row ${rowNumber}: ${error.message}`
					)
				})

				// Check each student record
				results.data.forEach((student, index) => {
					const rowNumber = index + 2

					// Check for missing primary key (ID)
					const studentId = String(student['ID'] ?? '').trim()

					if (!studentId) {
						blockingErrors.push(`Row ${rowNumber}: Missing ID (primary key).`)
					} else {
						// Check for duplicate IDs
						if (studentIds.has(studentId)) {
							const firstRow = studentIds.get(studentId)

							blockingErrors.push(
								`Duplicate ID ${studentId} found in rows ${firstRow} and ${rowNumber}.`
							)
						} else {
							studentIds.set(studentId, rowNumber)
						}
					}

					// Check for missing required student information
					const informationColumns = ['First', 'Last', 'Email', 'Status']

					informationColumns.forEach((column) => {
						const value = student[column]

						if (
							value === undefined ||
							value === null ||
							String(value).trim() === ''
						) {
							errors.push(`Row ${rowNumber}: Missing ${column}.`)
						}
					})
				})

				// Return validation results
				resolve({
					headers,
					students: results.data,
					totalRecords: results.data.length,
					errors,
					blockingErrors
				})
			},

			error: (error) => {
				reject(error)
			}
		})
	})
}
