export default async function handler(request) {
	return new Response(JSON.stringify({status: 'connected'}), {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		}
	})
}
