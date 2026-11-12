console.log('auth.js loaded')

async function signIn(googleResponse) {
	console.log(googleResponse)
	const statusElement = document.getElementById('auth-status')

	if (!googleResponse?.credential) {
		statusElement.textContent = 'Google did not return a credential.'
		return
	}

	statusElement.textContent = 'Verifying your account…'

	try {
		const httpResponse = await fetch('/.netlify/functions/oauth', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				credential: googleResponse.credential
			})
		})

		const data = await httpResponse.json()
		console.log('data: ' + data.authorized)

		if (!httpResponse.ok) {
			throw new Error(data.error || `HTTP ${httpResponse.status}`)
		}

		if (data.authorized !== true) {
			throw new Error('Access was not authorized.')
		}

		console.log('Account verified and authorized')

		statusElement.style.color = 'green'
		statusElement.textContent = `Welcome, ${data.user.name || 'staff member'}! Your account is authorized.`
	} catch (error) {
		console.error('Sign-in failed:', error)
		statusElement.textContent =
			error.message || 'Sign-in failed. Please try again.'
	}
}
