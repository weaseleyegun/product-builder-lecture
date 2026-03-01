// cors.js - CORS headers and response helper utilities

// Standard CORS headers for API responses
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight OPTIONS request
function handleOptions() {
    return new Response("OK", { headers: corsHeaders });
}

// Create a JSON response with CORS headers
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

// Create an error response with CORS headers
function errorResponse(message, status = 500) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

export { corsHeaders, handleOptions, jsonResponse, errorResponse };
