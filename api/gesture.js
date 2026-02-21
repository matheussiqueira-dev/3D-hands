// Vercel Serverless Function Example
// This is optional - you can use it for logging, analytics, or data processing

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const { gesture, timestamp, sessionId } = req.body;

            // Here you could:
            // - Log gesture events to a database
            // - Send analytics to a service
            // - Process gesture patterns
            // - Store user sessions

            console.log('Gesture logged:', { gesture, timestamp, sessionId });

            return res.status(200).json({
                success: true,
                message: 'Gesture logged successfully',
                data: {
                    gesture,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error processing gesture:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            name: '3D Hands API',
            version: '1.0.0',
            endpoints: {
                POST: '/api/gesture - Log gesture events',
                GET: '/api/gesture - API information'
            }
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
