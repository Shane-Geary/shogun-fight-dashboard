/* =========================================
   T-03: Martialytics CSV Upload
   ========================================= */

// Get page elements
const csvFile = document.getElementById('csvFile')
const startAuditButton = document.getElementById('startAuditButton')
const uploadStatus = document.getElementById('uploadStatus')
const fileStatus = document.getElementById('fileStatus')
const dropZone = document.getElementById('dropZone')
const selectedFile = document.getElementById('selectedFile')
const fileName = document.getElementById('fileName')
const fileSize = document.getElementById('fileSize')

const MAX_FILE_SIZE = 10 * 1024 * 1024

let currentFile = null

let currentValidation = null

// Identifies the latest selection so older async results can be ignored.
let fileSelectionNumber = 0

// Format the selected file's size in KB
function formatFileSize(bytes) {
	return (bytes / 1024).toFixed(1) + ' KB'
}

// Reuse the existing status line for prototype messages and errors.
function setUploadStatus(message, isError = false) {
	uploadStatus.textContent = message
	uploadStatus.classList.toggle('is-error', isError)
}

// Check the selected file, then automatically validate its CSV contents.
async function validateFile(file) {
	// Ignore file changes while the processing view is open.
	if (csvFile.disabled) return

	fileSelectionNumber++
	const selectionNumber = fileSelectionNumber

	// Clear the previous selection and disable auditing until checks finish.
	currentFile = null
	currentValidation = null
	startAuditButton.disabled = true
	selectedFile.hidden = true
	fileStatus.hidden = true
	setUploadStatus('')

	if (!file) {
		setUploadStatus('Choose a report to begin your audit.')
		return
	}

	// Check file type
	if (!file.name.toLowerCase().endsWith('.csv')) {
		setUploadStatus('Please choose a CSV file.', true)
		return
	}

	// Check file size
	if (file.size > MAX_FILE_SIZE) {
		setUploadStatus('CSV files must be 10 MB or smaller.', true)
		return
	}

	try {
		const content = await file.text()

		// Ignore this result if another file was selected while reading.
		if (selectionNumber !== fileSelectionNumber) return

		// Check for an empty file
		if (!content.trim()) {
			setUploadStatus('The selected CSV file is empty.', true)
			return
		}

		// Display the selected file's name and size.
		currentFile = file
		fileName.textContent = file.name
		fileSize.textContent = 'CSV report · ' + formatFileSize(file.size)
		selectedFile.hidden = false

		// Run CSV validation immediately after the basic file checks.
		await validateCSV()
	} catch (error) {
		// An older selection must not overwrite the current file's feedback.
		if (selectionNumber !== fileSelectionNumber) return

		setUploadStatus('Unable to read the CSV file.', true)
		console.error(error)
	}
}

// Validate CSV structure and student records using the existing parser.
async function validateCSV() {
	if (!currentFile) {
		setUploadStatus('Choose a report to begin your audit.')
		return
	}

	const fileBeingValidated = currentFile
	const selectionNumber = fileSelectionNumber

	startAuditButton.disabled = true
	fileStatus.hidden = true

	try {
		const result = await parseMartialyticsCsv(fileBeingValidated)

		// Ignore validation results belonging to an earlier file selection.
		if (selectionNumber !== fileSelectionNumber) return

		const hasBlockingIssues = result.blockingErrors.length > 0

		// Keep the parsed records available for the processing workflow.
		currentValidation = hasBlockingIssues ? null : result

		// Show one issue at a time, prioritizing errors that block the audit.
		const issue = result.blockingErrors[0] || result.errors[0]

		// Preserve the existing rule: only blocking errors prevent auditing.
		startAuditButton.disabled = hasBlockingIssues
		fileStatus.hidden = hasBlockingIssues

		if (issue) {
			setUploadStatus(issue, true)
		} else {
			setUploadStatus(
				"Your report is selected. Start the audit when you're ready."
			)
		}
	} catch (error) {
		if (selectionNumber !== fileSelectionNumber) return

		// Parsing failures keep the audit disabled and the ready badge hidden.
		startAuditButton.disabled = true
		fileStatus.hidden = true
		setUploadStatus(error.message || 'Unable to process the CSV file.', true)
		console.error('CSV validation error:', error)
	}
}

// Populate the desktop and mobile dates.
document.querySelectorAll('[data-audit-date]').forEach((element) => {
	element.textContent = new Date().toLocaleDateString('en-US')
})

// Handle files selected through Choose Files.
csvFile.addEventListener('change', () => {
	validateFile(csvFile.files[0])
})

// Prevent the browser from navigating to files dropped onto the page.
window.addEventListener('dragover', (event) => {
	event.preventDefault()
})

window.addEventListener('drop', (event) => {
	event.preventDefault()
})

// Highlight the drop area while a file is dragged over it.
dropZone.addEventListener('dragover', (event) => {
	event.preventDefault()
	dropZone.classList.add('dragover')
})

// Remove the highlight when the file leaves the drop area.
dropZone.addEventListener('dragleave', () => {
	dropZone.classList.remove('dragover')
})

// Dropped files use the same checks as files selected through the picker.
dropZone.addEventListener('drop', (event) => {
	event.preventDefault()
	dropZone.classList.remove('dragover')
	validateFile(event.dataTransfer.files[0])
})

// Start T-11 only after automatic CSV validation has succeeded.
startAuditButton.addEventListener('click', () => {
	if (currentFile && currentValidation) {
		auditProcessing.start(currentFile, currentValidation)
	}
})
