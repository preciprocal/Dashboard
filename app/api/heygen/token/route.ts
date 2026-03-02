import { NextResponse } from "next/server";

export async function POST() {
  try {
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

    console.log("=== HEYGEN TOKEN REQUEST DEBUG ===");
    console.log("API Key exists:", !!HEYGEN_API_KEY);
    console.log("API Key length:", HEYGEN_API_KEY?.length);
    console.log("API Key prefix:", HEYGEN_API_KEY?.substring(0, 10) + "...");

    if (!HEYGEN_API_KEY) {
      console.error("❌ No HeyGen API key found");
      return NextResponse.json(
        { error: "HeyGen API key not configured" },
        { status: 500 }
      );
    }

    // Test 1: Try to get account info first
    console.log("🔍 Testing API key validity...");
    const testResponse = await fetch("https://api.heygen.com/v2/avatars", {
      method: "GET",
      headers: {
        "X-Api-Key": HEYGEN_API_KEY,
      },
    });

    console.log("Test response status:", testResponse.status);
    
    if (!testResponse.ok) {
      const testError = await testResponse.text();
      console.error("❌ API key test failed:", testError);
      
      return NextResponse.json(
        { 
          error: "Invalid HeyGen API key or insufficient permissions",
          details: testError,
          suggestion: "Please verify your API key and check if Streaming Avatar API is enabled in your HeyGen account"
        },
        { status: 401 }
      );
    }

    const avatars = await testResponse.json();
    console.log("✅ API key valid, available avatars:", avatars.data?.length || 0);

    // Test 2: Try to create streaming token
    console.log("🎫 Attempting to create streaming token...");
    const tokenResponse = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: {
        "X-Api-Key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log("Token response status:", tokenResponse.status);
    console.log("Token response headers:", Object.fromEntries(tokenResponse.headers.entries()));

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("❌ Token creation failed:", errorText);
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { raw: errorText };
      }

      return NextResponse.json(
        { 
          error: "Failed to create streaming token",
          status: tokenResponse.status,
          details: errorDetails,
          suggestion: "Your account may not have access to Streaming Avatar API. This feature requires a paid HeyGen plan."
        },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("✅ Token created successfully");
    console.log("Token structure:", Object.keys(tokenData));
    
    return NextResponse.json({
      success: true,
      token: tokenData.data?.token || tokenData.token,
      debug: {
        hasToken: !!(tokenData.data?.token || tokenData.token),
        availableAvatars: avatars.data?.length || 0
      }
    });

  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Add a GET endpoint for testing
export async function GET() {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  
  return NextResponse.json({
    configured: !!HEYGEN_API_KEY,
    keyLength: HEYGEN_API_KEY?.length,
    keyPrefix: HEYGEN_API_KEY?.substring(0, 15) + "...",
    endpoint: "/api/heygen/token",
    note: "Use POST to generate token"
  });
}