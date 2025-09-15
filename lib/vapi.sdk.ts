import Vapi from "@vapi-ai/web";

export const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);

// Add some debugging
console.log("VAPI SDK initialized with:", {
  hasApiKey: !!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY,
  apiKeyPrefix: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.substring(0, 8) + "..."
});