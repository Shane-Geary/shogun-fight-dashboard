import {getSession} from '../lib/session.mjs'

function jsonResponse(status, body, extraHeaders = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
			...extraHeaders
		}
	})
}

export default async function handler(request, context) {
	if (request.method !== 'GET') {
		return jsonResponse(405, {error: 'Method not allowed.'}, {Allow: 'GET'})
	}

	const user = await getSession(context)

	if (!user) {
		return jsonResponse(401, {error: 'Please sign in to continue.'})
	}

	if (!user) {
		return jsonResponse(401, {error: 'Please sign in to continue.'})
	}

	const apiKey = process.env.JOTFORM_API_KEY

	if (!apiKey) {
		return jsonResponse(500, {error: 'Jotform API key is not configured.'})
	}

	try {
		const formIds = ['262785031969166', '262785002301144', '262784995113165']
		const submissions = new Map()

		for (const formId of formIds) {
			let offset = 0

			while (true) {
				const url = new URL(
					`https://api.jotform.com/form/${formId}/submissions`
				)
				url.search = new URLSearchParams({
					limit: '100',
					offset: String(offset),
					orderby: 'id',
					filter: JSON.stringify({status: 'ACTIVE'})
				}).toString()

				const response = await fetch(url, {
					headers: {APIKEY: apiKey},
					signal: AbortSignal.timeout(10000)
				})
				const data = await response.json()

				if (
					!response.ok ||
					Number(data.responseCode) !== 200 ||
					!Array.isArray(data.content)
				) {
					throw new Error('Incomplete Jotform audit.')
				}

				const page = data.content
				if (!page.length) break

				const previousSize = submissions.size

				for (const entry of page) {
					if (!entry.id || String(entry.form_id) !== formId) {
						throw new Error('Unexpected Jotform submission.')
					}
					submissions.set(String(entry.id), entry)
				}

				if (submissions.size === previousSize)
					throw new Error('Repeated Jotform page.')
				offset += page.length
			}
		}

		return jsonResponse(200, {
			submissions: [...submissions.values()],
			completeHistory: true
		})
	} catch {
		return jsonResponse(502, {
			error: 'Unable to connect to Jotform.'
		})
	}
}
