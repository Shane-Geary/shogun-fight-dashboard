import {SignJWT, jwtVerify} from 'jose'

const COOKIE_NAME = 'sfc_session'
const ISSUER = 'sfc-dashboard'
const AUDIENCE = 'sfc-staff'

const secret = process.env.SESSION_SECRET || ''
const origin = new URL(process.env.APP_ORIGIN)
const secure = origin.protocol === 'https:'
const local = ['localhost', '127.0.0.1'].includes(origin.hostname)

if (!/^[a-f0-9]{64}$/i.test(secret)) {
	throw new Error('SESSION_SECRET must contain 64 hexadecimal characters.')
}

if (
	origin.origin !== process.env.APP_ORIGIN ||
	(!secure && !(local && origin.protocol === 'http:'))
) {
	throw new Error(
		'APP_ORIGIN must be HTTPS, or local HTTP, without a path or trailing slash.'
	)
}

const key = Buffer.from(secret, 'hex')
const allowedIds = new Set(
	(process.env.ALLOWED_GOOGLE_SUBS || '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean)
)

export function isSameOrigin(request) {
	return request.headers.get('origin') === origin.origin
}

export async function createSession(user, context) {
	const token = await new SignJWT({name: user.name || ''})
		.setProtectedHeader({alg: 'HS256'})
		.setSubject(user.sub)
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(key)

	context.cookies.set({
		name: COOKIE_NAME,
		value: token,
		httpOnly: true,
		secure,
		sameSite: 'lax',
		path: '/'
	})
}

export async function getSession(context) {
	const token = context.cookies.get(COOKIE_NAME)
	if (!token) return null

	try {
		const {payload} = await jwtVerify(token, key, {
			algorithms: ['HS256'],
			issuer: ISSUER,
			audience: AUDIENCE,
			requiredClaims: ['sub', 'iat', 'exp']
		})

		if (typeof payload.sub !== 'string' || !allowedIds.has(payload.sub))
			return null

		return {
			id: payload.sub,
			name: typeof payload.name === 'string' ? payload.name : ''
		}
	} catch {
		return null
	}
}
