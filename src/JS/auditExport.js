const exportButton = document.querySelector('#exportAuditButton')
const exportLabel = exportButton.querySelector('span')
const notice = document.querySelector('#exportNotice')
const noticeText = document.querySelector('#exportNoticeText')
const downloadLink = document.querySelector('#exportDownloadLink')

let busy = false
let auditEnded = false
let exportFrame = null
let downloadURL = null

function clearDownload() {
	if (downloadURL) URL.revokeObjectURL(downloadURL)

	downloadURL = null
	downloadLink.removeAttribute('href')
	downloadLink.hidden = true
}

function showNotice(message) {
	noticeText.textContent = message
	notice.hidden = false
}

document.querySelector('#dismissExportNotice').addEventListener('click', () => {
	notice.hidden = true
	clearDownload()
	exportButton.focus()
})

document.addEventListener('audit:clear', () => {
	auditEnded = true
	clearDownload()
	exportFrame?.remove()
	notice.hidden = true
	noticeText.textContent = ''
	exportButton.disabled = true
})

function checkActive() {
	if (auditEnded) {
		throw new Error('The audit session has ended.')
	}
}

async function loadPDFLibraries() {
	const libraries = [
		[
			window.html2canvas,
			'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
		],
		[
			window.jspdf?.jsPDF,
			'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js'
		]
	]

	await Promise.all(
		libraries.map(([loaded, src]) => {
			if (loaded) return Promise.resolve()

			return new Promise((resolve, reject) => {
				const script = document.createElement('script')

				const fail = () => {
					clearTimeout(timer)
					script.remove()
					reject(
						new Error(
							'The PDF library could not load. Check your connection and try Save Audit as PDF again.'
						)
					)
				}

				const timer = setTimeout(fail, 15000)

				script.src = src
				script.onload = () => {
					clearTimeout(timer)
					resolve()
				}
				script.onerror = fail

				document.head.append(script)
			})
		})
	)
}

function takeSnapshot() {
	const graphs = !document.querySelector('#graphView').hidden
	const source = document.querySelector(
		graphs ? '#graphView' : '.student-table'
	)
	const count = source.querySelectorAll('.student-card').length

	if (!graphs && !count) {
		throw new Error('There are no visible student records to export.')
	}

	if (graphs && !document.querySelector('#graphDates').textContent.trim()) {
		throw new Error('The graphs are not ready to export.')
	}

	const mobile = matchMedia(`(max-width: ${graphs ? 720 : 900}px)`).matches

	const root = source.cloneNode(true)
	root.hidden = false
	root.classList.add('pdf-export')

	root.querySelectorAll('details').forEach((details) => {
		details.open = true
	})

	// Canvas bitmaps are not copied by cloneNode.
	const originalCanvases = source.querySelectorAll('canvas')

	root.querySelectorAll('canvas').forEach((canvas, index) => {
		const image = document.createElement('img')
		image.src = originalCanvases[index].toDataURL('image/png')
		image.alt =
			originalCanvases[index].getAttribute('aria-label') || 'Audit chart'

		canvas.replaceWith(image)
	})

	root
		.querySelectorAll(
			'.student-controls__sort, .graph-status, .graph-toolbar, .follow-up-button'
		)
		.forEach((element) => element.remove())

	const scope = graphs
		? document.querySelector('#graphDates').textContent +
			' | Full audit dataset'
		: `${count} records | All details expanded | ` +
			document.querySelector('#sortStudents').selectedOptions[0].text +
			' | ' +
			document.querySelector('.student-controls__active').textContent

	return {root, graphs, mobile, scope}
}

async function createPDF(snapshot) {
	const {root, graphs, mobile, scope} = snapshot
	const width = mobile ? 420 : 1100
	const orientation = mobile ? 'portrait' : 'landscape'

	const pdf = new window.jspdf.jsPDF({
		orientation,
		unit: 'pt',
		format: 'letter',
		compress: true
	})

	const pageWidth = pdf.internal.pageSize.getWidth()
	const pageHeight = pdf.internal.pageSize.getHeight()
	const margin = 24
	const contentWidth = pageWidth - margin * 2
	const title = graphs ? 'Weekly audit graphs' : 'Student and prospect audit'

	const exportedAt = new Date().toLocaleString('en-US', {
		timeZoneName: 'short'
	})

	pdf.setFontSize(9)

	const scopeLines = pdf.splitTextToSize(
		scope.replace(/[–—]/g, '-'),
		contentWidth
	)
	const contentTop = 62 + scopeLines.length * 11
	const contentHeight = pageHeight - contentTop - 30
	const maxHeight = (contentHeight * width) / contentWidth

	const response = await fetch(
		new URL('../Styles/studentDashboard.css', import.meta.url)
	)

	if (!response.ok) {
		throw new Error('The dashboard styles could not load. Please try again.')
	}

	const css = await response.text()
	checkActive()

	// Render an isolated copy with the dashboard's existing styles.
	exportFrame = document.createElement('iframe')
	exportFrame.title = 'Preparing audit PDF'
	exportFrame.setAttribute('aria-hidden', 'true')
	exportFrame.tabIndex = -1
	exportFrame.style.cssText = `
		position: fixed;
		left: -10000px;
		top: 0;
		width: ${width}px;
		height: 1000px;
		border: 0;
		pointer-events: none;
	`

	document.body.append(exportFrame)

	const frameDocument = exportFrame.contentDocument
	const style = frameDocument.createElement('style')

	style.textContent =
		css +
		`
		html, body {
			margin: 0;
			min-width: 0;
			background: #fff;
		}

		.pdf-export {
			border: 0;
			border-radius: 0;
		}

		.pdf-export .student-card__toggle,
		.pdf-export .student-table__head > :last-child {
			visibility: hidden;
		}

		.pdf-export .graph-plot img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	`

	frameDocument.head.append(style)
	frameDocument.body.append(root)

	await frameDocument.fonts.ready
	await Promise.all(
		[...root.querySelectorAll('img')].map((image) => image.decode())
	)

	checkActive()

	// Desktop graphs stay together. Mobile graphs and student cards
	// are added individually to keep page breaks between records.
	const holder = graphs
		? mobile
			? root.querySelector('.graph-grid')
			: root
		: root.querySelector('.student-grid')

	const items = [...holder.children]
	holder.replaceChildren()

	let pages = 0

	async function addPage() {
		checkActive()

		const canvas = await window.html2canvas(root, {
			backgroundColor: '#ffffff',
			scale: 2,
			windowWidth: width,
			windowHeight: Math.max(
				1000,
				Math.ceil(root.getBoundingClientRect().height)
			),
			scrollX: 0,
			scrollY: 0,
			logging: false
		})

		checkActive()

		if (!canvas.width || !canvas.height) {
			throw new Error('The PDF image could not be rendered.')
		}

		if (pages++) {
			pdf.addPage('letter', orientation)
		}

		pdf.setTextColor(23, 25, 28)
		pdf.setFontSize(14)
		pdf.text('Shogun Fight Collective - ' + title, margin, 30)

		pdf.setTextColor(89, 101, 117)
		pdf.setFontSize(9)
		pdf.text(scopeLines, margin, 46)

		pdf.setFontSize(8)
		pdf.text('Exported ' + exportedAt, margin, contentTop - 10)

		// Fit an unusually tall individual card onto its own page.
		const scale = Math.min(
			contentWidth / canvas.width,
			contentHeight / canvas.height
		)
		const imageWidth = canvas.width * scale
		const imageHeight = canvas.height * scale

		pdf.addImage(
			canvas.toDataURL('image/png'),
			'PNG',
			(pageWidth - imageWidth) / 2,
			contentTop,
			imageWidth,
			imageHeight,
			undefined,
			'FAST'
		)

		canvas.width = canvas.height = 0
	}

	for (const item of items) {
		checkActive()
		holder.append(item)

		if (
			root.getBoundingClientRect().height > maxHeight &&
			holder.children.length > 1
		) {
			item.remove()
			await addPage()
			holder.replaceChildren(item)
		}
	}

	if (holder.children.length) {
		await addPage()
	}

	for (let page = 1; page <= pages; page++) {
		pdf.setPage(page)
		pdf.setFontSize(8)
		pdf.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 12, {
			align: 'right'
		})
	}

	pdf.setProperties({
		title: 'Shogun Fight Collective - ' + title
	})

	return pdf.output('blob')
}

exportButton.addEventListener('click', async () => {
	if (busy || auditEnded) return

	busy = true
	exportButton.disabled = true
	exportLabel.textContent = 'Preparing PDF…'
	notice.hidden = true
	clearDownload()

	try {
		if (!(await auditSession.ready) || auditEnded) return

		const snapshot = takeSnapshot()

		await loadPDFLibraries()
		checkActive()

		const blob = await createPDF(snapshot)
		checkActive()

		downloadURL = URL.createObjectURL(blob)
		downloadLink.href = downloadURL
		downloadLink.download =
			`shogun-${snapshot.graphs ? 'graphs' : 'students'}-` +
			`${new Date().toISOString().slice(0, 10)}.pdf`
		downloadLink.hidden = false

		showNotice(
			'Your PDF is ready. You are responsible for securely storing, sharing, and deleting exported data. Clearing the audit or signing out does not delete downloaded copies. If the download did not start, select Download PDF.'
		)

		downloadLink.click()
	} catch (error) {
		if (!auditEnded) {
			console.error('PDF export failed:', error)
			showNotice(
				error.message || 'The PDF could not be created. Please try again.'
			)
		}
	} finally {
		exportFrame?.remove()
		exportFrame = null
		busy = false
		exportButton.disabled = auditEnded
		exportLabel.textContent = 'Save Audit as PDF'
	}
})
