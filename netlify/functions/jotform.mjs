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
		const response = await fetch(
			'https://api.jotform.com/user/submissions?limit=1',
			{
				headers: {APIKEY: apiKey},
				signal: AbortSignal.timeout(10000)
			}
		)

		const data = await response.json()

		if (!response.ok || data.responseCode !== 200) {
			return jsonResponse(502, {
				error: 'Unable to retrieve Jotform submissions.'
			})
		}

		return jsonResponse(200, {submissions: data.content})
	} catch {
		return jsonResponse(502, {
			error: 'Unable to connect to Jotform.'
		})
	}
}
