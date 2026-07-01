const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby9uH6uVHE6090gmKyqBfvEvc2Q0PD2J2J9nWxl0qqoA6yZFX9_aObsfeePVuf8Snzgow/exec";

const ALLOW_ORIGINS = [
  "https://bdl.dataconnectmail.com",
  "https://jamescluster35.github.io",
  "http://localhost:8788",
  "http://localhost:5173"
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight options request
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      const headers = new Headers();
      if (ALLOW_ORIGINS.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
      }
      headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-requested-with");
      headers.set("Access-Control-Max-Age", "86400");
      return new Response(null, { status: 204, headers });
    }

    // Intercept API routes
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      try {
        // Clone the request for forwarding
        const headers = new Headers(request.headers);
        
        // Remove origin to prevent Google Apps Script CORS warnings
        headers.delete("Origin");
        headers.delete("Referer");

        // Forward request to Google Apps Script Web App
        const googleResponse = await fetch(GOOGLE_SCRIPT_URL + url.search, {
          method: request.method,
          headers: headers,
          body: request.method === "POST" ? await request.text() : undefined,
          redirect: "follow"
        });

        // Create new response with CORS headers
        const responseHeaders = new Headers(googleResponse.headers);
        
        // Expose correct CORS headers to frontend
        const origin = request.headers.get("Origin");
        if (ALLOW_ORIGINS.includes(origin)) {
          responseHeaders.set("Access-Control-Allow-Origin", origin);
        }
        responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        return new Response(googleResponse.body, {
          status: googleResponse.status,
          statusText: googleResponse.statusText,
          headers: responseHeaders
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "API Gateway Error: " + err.message }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    // Serve static asset using Cloudflare Workers Assets fallback binding
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
