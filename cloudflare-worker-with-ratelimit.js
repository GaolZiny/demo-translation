/**
 * Enhanced Cloudflare Worker with Rate Limiting
 * 
 * This version includes IP-based rate limiting to prevent abuse
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // 生产环境改为: 'https://your-domain.com'
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

// Rate limiting configuration
const RATE_LIMIT = {
    maxRequests: 10,        // Maximum requests
    windowMs: 60 * 1000,    // Time window (1 minute)
};

/**
 * Check rate limit for an IP address
 */
async function checkRateLimit(ip, env) {
    const key = `ratelimit:${ip}`;
    const now = Date.now();

    // Get current request data as TEXT first, then parse manually
    const dataText = await env.TRANSLATION_KV.get(key);

    let data = null;
    if (dataText) {
        try {
            data = JSON.parse(dataText);
        } catch (error) {
            // If parse fails, treat as if no data exists
            console.error('Failed to parse rate limit data, resetting:', error);
            data = null;
        }
    }

    if (!data) {
        // First request from this IP or corrupted data
        await env.TRANSLATION_KV.put(
            key,
            JSON.stringify({ count: 1, resetTime: now + RATE_LIMIT.windowMs }),
            { expirationTtl: 60 } // Auto-delete after 60 seconds
        );
        return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
    }

    // Check if window has expired
    if (now > data.resetTime) {
        // Reset the counter
        await env.TRANSLATION_KV.put(
            key,
            JSON.stringify({ count: 1, resetTime: now + RATE_LIMIT.windowMs }),
            { expirationTtl: 60 }
        );
        return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
    }

    // Check if limit exceeded
    if (data.count >= RATE_LIMIT.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: data.resetTime
        };
    }

    // Increment counter
    await env.TRANSLATION_KV.put(
        key,
        JSON.stringify({ count: data.count + 1, resetTime: data.resetTime }),
        { expirationTtl: 60 }
    );

    return {
        allowed: true,
        remaining: RATE_LIMIT.maxRequests - data.count - 1
    };
}

/**
 * Handle incoming requests
 */
async function handleRequest(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST
    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            {
                status: 405,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
        );
    }

    try {
        // Get client IP
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

        // Check rate limit
        const rateLimitResult = await checkRateLimit(ip, env);

        if (!rateLimitResult.allowed) {
            const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
            return new Response(
                JSON.stringify({
                    error: 'Too many requests',
                    message: 'サービス混雑中です。時間をあけてからご利用ください。',
                    retryAfter: retryAfter
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
                        'Retry-After': retryAfter.toString(),
                        ...corsHeaders,
                    },
                }
            );
        }

        // Parse request body
        const body = await request.json();

        // Validate input
        if (!body['問い合わせ内容']) {
            return new Response(
                JSON.stringify({ error: 'Missing required field: 問い合わせ内容' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                }
            );
        }

        // Get configuration from KV
        const webhookUrl = await env.TRANSLATION_KV.get('n8n_webhook_url');
        const authHeaderName = await env.TRANSLATION_KV.get('n8n_auth_header_name') || 'Authorization';
        const authToken = await env.TRANSLATION_KV.get('n8n_auth_token');

        if (!webhookUrl) {
            console.error('Webhook URL not configured');
            return new Response(
                JSON.stringify({ error: 'Service configuration error' }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                }
            );
        }

        // Prepare headers
        const headers = { 'Content-Type': 'application/json' };
        // Use custom header name from KV (e.g., webhook-auth-token)
        if (authToken) {
            headers[authHeaderName] = authToken;
        }

        // Call n8n with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const n8nResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Get response text first for better error handling
            const responseText = await n8nResponse.text();

            // Try to parse as JSON
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (parseError) {
                // If response is not JSON, return error with actual response
                console.error('Failed to parse n8n response as JSON:', responseText);
                return new Response(
                    JSON.stringify({
                        error: 'Invalid response from n8n',
                        message: 'n8n returned non-JSON response',
                        details: responseText.substring(0, 200), // First 200 chars
                        status: n8nResponse.status
                    }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders },
                    }
                );
            }

            return new Response(JSON.stringify(responseData), {
                status: n8nResponse.status,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    ...corsHeaders,
                },
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                return new Response(
                    JSON.stringify({
                        error: 'Request timeout',
                        message: 'サービス混雑中です。時間をあけてからご利用ください。'
                    }),
                    {
                        status: 504,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders },
                    }
                );
            }

            throw fetchError;
        }
    } catch (error) {
        console.error('Error:', error);

        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                message: error.message
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
        );
    }
}

export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    },
};
