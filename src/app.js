async function checkBackend() {
	const status = document.getElementById('api-status')

	try {
		const response = await fetch('/.netlify/functions/health')

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const data = await response.json()
		status.textContent = `Backend status: ${data.status}`
	} catch (error) {
		console.error('Backend connection failed:', error)
		status.textContent = 'Backend connection failed.'
	}
}

checkBackend()
