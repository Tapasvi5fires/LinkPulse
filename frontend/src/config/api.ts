export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

/**
 * Enhanced fetch wrapper with exponential backoff retries.
 * Specifically handles Render Free Tier cold starts (503/504 errors).
 */
export async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
    let delay = 2000; // Start with 2s
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            
            // If we get a 502, 503, or 504, it's likely the backend waking up
            if ([502, 503, 504].includes(response.status)) {
                throw new Error(`Backend waking up... (${response.status})`);
            }
            
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            
            console.warn(`Retry ${i + 1}/${maxRetries} for ${url} after ${delay}ms due to:`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
    
    throw new Error('Max retries reached');
}
