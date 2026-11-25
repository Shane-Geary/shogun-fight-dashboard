const auditSession = (() => {
	const key = 'sfc.audit.handoff'
	const channel = new BroadcastChannel('sfc-auth')

	let user = null
	let expiryTimer
	let ended = false

	function discard() {
		try {
			sessionStorage.removeItem(key)
		} catch {
			// Sign-out must still work when browser storage is unavailable.
		}
	}

	function end() {
		if (ended) return

		ended = true
		clearTimeout(expiryTimer)
		discard()

		document.documentElement.hidden = true
		document.dispatchEvent(new Event('audit:clear'))
		location.replace('/Pages/index.html')
	}

	async function check() {
		if (user && user.expiresAt <= Date.now()) return end()

		try {
			const response = await fetch('/.netlify/functions/oauth', {
				cache: 'no-store'
			})

			if (!response.ok) return end()

			const {user: current} = await response.json()
			if (ended) return

			if (
				!current?.id ||
				!Number.isFinite(current.expiresAt) ||
				current.expiresAt <= Date.now()
			)
				return end()

			if (
				user &&
				(user.id !== current.id || user.expiresAt !== current.expiresAt)
			)
				return end()

			user = current
			clearTimeout(expiryTimer)
			expiryTimer = setTimeout(end, user.expiresAt - Date.now())

			return user
		} catch {
			end()
		}
	}

	function openDashboard(results) {
		if (ended || !user || user.expiresAt <= Date.now()) return end()

		const ticket = crypto.randomUUID()

		try {
			sessionStorage.setItem(
				key,
				JSON.stringify({
					ticket,
					owner: user.id,
					expiresAt: user.expiresAt,
					results
				})
			)
		} catch {
			const error = new Error('Audit handoff failed.')
			error.userMessage =
				'The browser could not hold these audit results. Check available site storage.'
			throw error
		}

		location.assign('/Pages/studentDashboard.html#' + ticket)
	}

	function takeResults() {
		try {
			const raw = sessionStorage.getItem(key)
			sessionStorage.removeItem(key)

			if (!raw || ended || !user || user.expiresAt <= Date.now()) return null

			const entry = JSON.parse(raw)
			const navigation = performance.getEntriesByType('navigation')[0]

			if (
				navigation?.type !== 'navigate' ||
				entry.ticket !== location.hash.slice(1) ||
				entry.owner !== user.id ||
				entry.expiresAt !== user.expiresAt
			)
				return null

			history.replaceState(null, '', location.pathname + location.search)
			return entry.results
		} catch {
			return null
		}
	}

	channel.onmessage = ({data}) => {
		if (data === 'signed-out') end()
	}

	document.addEventListener('visibilitychange', () => {
		if (!document.hidden && !ended) check()
	})

	window.addEventListener('pagehide', () => {
		clearTimeout(expiryTimer)
		channel.close()
		document.documentElement.hidden = true
		document.dispatchEvent(new Event('audit:clear'))
	})

	window.addEventListener('pageshow', (event) => {
		if (event.persisted) location.reload()
	})

	return {
		ready: check(),
		openDashboard,
		takeResults,
		discard,
		end,
		signedOut() {
			channel.postMessage('signed-out')
			end()
		}
	}
})()
