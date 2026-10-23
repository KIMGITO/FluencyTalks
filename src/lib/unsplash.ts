import { constants } from '@/lib/constants';

export async function searchUnsplash(query: string) {
  try {
    // This is a placeholder for the actual Unsplash API call logic
    // We assume the environment variable for the Unsplash access key is available
    const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: {
        'Authorization': `Client-ID ${import.meta.env.VITE_UNSPLASH_ACCESS_KEY}`
      }
    });
    const data = await response.json();
    return data.results[0]?.urls?.regular || null;
  } catch (error) {
    console.error('Error fetching from Unsplash:', error);
    return null;
  }
}
