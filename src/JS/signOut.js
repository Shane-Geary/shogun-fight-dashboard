async function signOut() {
	try {
		const response = await fetch('/.netlify/functions/oauth', {
			method: 'DELETE'
		})
		if (!response.ok) throw new Error('Unable to sign out.')

		auditSession.signedOut()
	} catch (error) {
		console.error('Sign-out failed: ', error)
	}
}

document.querySelectorAll('[data-sign-out]').forEach((button) => {
	button.addEventListener('click', signOut)
})
