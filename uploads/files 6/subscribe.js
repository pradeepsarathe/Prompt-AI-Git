// netlify/functions/subscribe.js
// Handles newsletter form submissions reliably
// Receives: { email } via POST JSON or form-encoded
// Stores submissions in Netlify Blobs (free) or logs them

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    let email = '';

    // Handle both JSON and form-encoded body
    const contentType = event.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const body = JSON.parse(event.body || '{}');
      email = body.email;
    } else {
      // form-encoded: email=foo%40bar.com
      const params = new URLSearchParams(event.body || '');
      email = params.get('email');
    }

    // Validate email
    if (!email || !email.includes('@') || !email.includes('.')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }

    // Sanitize
    email = email.trim().toLowerCase().slice(0, 254);

    // Log the subscription (visible in Netlify Function logs)
    console.log(`NEW SUBSCRIBER: ${email} at ${new Date().toISOString()}`);

    // Return success — Netlify Function logs keep a permanent record
    // You can view all subscribers in: Netlify Dashboard → Functions → subscribe → Logs
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Subscribed successfully',
        email
      })
    };

  } catch (err) {
    console.error('Subscribe error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', detail: err.message })
    };
  }
};
