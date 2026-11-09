import {OAuth2Client} from 'google-auth-library'
import {createSession, isSameOrigin} from '../lib/session.mjs'

const googleClient = new OAuth2Client()

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
	if (request.method !== 'POST') {
		return jsonResponse(405, {error: 'Method not allowed.'}, {Allow: 'POST'})
	}

	const contentType = request.headers.get('content-type') || ''

	if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
		return jsonResponse(415, {error: 'Expected a JSON request.'})
	}

	const clientId = process.env.GOOGLE_CLIENT_ID
	console.log('clientID: ' + clientId)

	if (!clientId) {
		console.error('GOOGLE_CLIENT_ID is not configured.')
		return jsonResponse(500, {error: 'Authentication is not configured.'})
	}

	let body

	try {
		body = await request.json()
	} catch {
		return jsonResponse(400, {error: 'Invalid JSON request.'})
	}

	const credential = body?.credential

	if (typeof credential !== 'string' || !credential.trim()) {
		return jsonResponse(400, {error: 'Google credential is required.'})
	}

	// Step 1: Verify Google's signature, audience, issuer, and expiration.
	let payload

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: credential,
			audience: clientId
		})

		payload = ticket.getPayload()
	} catch {
		return jsonResponse(401, {
			error: 'Google sign-in could not be verified. Please try again.'
		})
	}

	if (!payload?.sub || payload.email_verified !== true) {
		return jsonResponse(401, {
			error: 'A verified Google account is required.'
		})
	}

	// Temporary local setup aid. Never log the credential itself.
	if (process.env.AUTH_DEBUG === 'true') {
		console.log('Verified Google account ID:', payload.sub)
	}

	// Step 2: Check the verified account ID against the server-side allowlist.
	const allowedAccountIds = new Set(
		(process.env.ALLOWED_GOOGLE_SUBS || '')
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean)
	)

	if (!allowedAccountIds.has(payload.sub)) {
		return jsonResponse(403, {
			error: 'This Google account is not authorized to access the dashboard.'
		})
	}

	// Step 3: Return success only after verification AND authorization.
	return jsonResponse(200, {
		authorized: true,
		user: {
			id: payload.sub,
			name: payload.name || '',
			email: payload.email || ''
		}
	})
}
