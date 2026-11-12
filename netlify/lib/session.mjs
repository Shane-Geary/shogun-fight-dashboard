import {SignJWT, jwtVerify} from 'jose'

const COOKIE = 'sfc_session'
const AUDIENCE = 'sfc-dashboard'
const secret = process.env.SESSION_SECRET || ''

if (!/^[a-f0-9]{64}$/i.test(secret)) {
	throw new Error('SESSION_SECRET must contain 64 hexadecimal characters.')
}

const key = Buffer.from(secret, 'hex')

export async function createSession(user, context) {
	const token = await new SignJWT({name: user.name || ''})
		.setProtectedHeader({alg: 'HS256'})
		.setSubject(user.sub)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(key)

	context.cookies.set({
		name: COOKIE,
		value: token,
		httpOnly: true,
		secure: process.env.APP_ORIGIN !== 'http://localhost:8000',
		sameSite: 'lax',
		path: '/'
	})
}

export async function getSession(context) {
	const token = context.cookies.get(COOKIE)
	if (!token) return null

	try {
		const {payload} = await jwtVerify(token, key, {
			algorithms: ['HS256'],
			audience: AUDIENCE,
			requiredClaims: ['sub', 'exp']
		})

		const allowedIds = (process.env.ALLOWED_GOOGLE_SUBS || '')
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean)

		if (!allowedIds.includes(payload.sub)) return null

		return {id: payload.sub, name: payload.name || ''}
	} catch {
		return null
	}
}
