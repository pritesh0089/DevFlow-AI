import axios from 'axios';
import Bottleneck from 'bottleneck';
import { TSBComponent } from '../utils/types.js';
import { normalizeComponent } from '../utils/normalize.js';

const baseURL = 'https://mapi.storyblok.com/v1';

// Plan-aware rate limiting: 3 RPS for free plans, configurable via env
const maxRps = Number(process.env.DF_MAX_RPS || 3);
const limiter = new Bottleneck({ minTime: Math.ceil(1000 / maxRps) });

/**
 * Retries a function with exponential backoff and jitter
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 5)
 * @param baseDelay - Base delay in milliseconds (default: 400)
 * @returns Promise with the result or throws on final failure
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, baseDelay = 400): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on rate limit errors (429)
      if (!axios.isAxiosError(error) || error.response?.status !== 429) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter: delay = base * 2^attempt + random(0..250ms)
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 250;
      console.log(`⏳ Rate limited. Retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

function client(token: string) {
  return axios.create({
    baseURL,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    timeout: 10000
  });
}

export async function listSpaces(token: string) {
  const res = await withRetry(() => 
    limiter.schedule(() => client(token).get('/spaces/'))
  );
  return res.data?.spaces ?? res.data;
}

export async function createSpace(token: string, name: string) {
  const res = await withRetry(() => 
    limiter.schedule(() => client(token).post('/spaces/', { space: { name } }))
  );
  return res.data?.space ?? res.data;
}

/**
 * Fetches all components in a space
 */
export async function getComponents(token: string, spaceId: string | number) {
  const res = await withRetry(() => 
    limiter.schedule(() => client(token).get(`/spaces/${spaceId}/components/`))
  );
  return res.data?.components ?? res.data ?? [];
}

/**
 * Updates an existing component
 */
export async function updateComponent(token: string, spaceId: string | number, componentId: number, raw: any) {
  const component: TSBComponent = normalizeComponent(raw);
  const payload = { component };

  try {
    const res = await withRetry(() => 
      limiter.schedule(() => client(token).put(`/spaces/${spaceId}/components/${componentId}`, payload))
    );
    return res.data?.component ?? res.data;
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      console.error('[storyblok] 422 Unprocessable Entity. Payload was:\n', JSON.stringify(payload, null, 2));
      console.error('[storyblok] Response data:\n', JSON.stringify(err.response.data, null, 2));
    }
    throw err;
  }
}

/**
 * Creates a new component
 */
export async function createComponent(token: string, spaceId: string | number, raw: any) {
  // 🔧 normalize + validate + strip unknowns
  const component: TSBComponent = normalizeComponent(raw);
  const payload = { component };

  try {
    const res = await withRetry(() => 
      limiter.schedule(() => client(token).post(`/spaces/${spaceId}/components/`, payload))
    );
    return res.data?.component ?? res.data;
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      console.error('[storyblok] 422 Unprocessable Entity. Payload was:\n', JSON.stringify(payload, null, 2));
      console.error('[storyblok] Response data:\n', JSON.stringify(err.response.data, null, 2));
    }
    throw err;
  }
}

/**
 * Explains Storyblok API errors in human-friendly terms
 */
export function explainStoryblokWriteError(err: any): { message: string; isPlanRequired: boolean } {
  if (!axios.isAxiosError(err)) {
    return { message: err?.message || 'Unknown error', isPlanRequired: false };
  }

  const status = err.response?.status;
  const data = err.response?.data;
  const message = data?.error || data?.message || err.message;

  if (status === 422) {
    if (message?.toLowerCase().includes('plan') || message?.toLowerCase().includes('trial')) {
      return {
        message: 'Storyblok requires a paid plan to create components. You can:\n' +
                '  1. Enable a plan in your Storyblok space settings\n' +
                '  2. Use --no-post mode to generate JSON files instead',
        isPlanRequired: true
      };
    }
    return { message: `Validation error: ${message}`, isPlanRequired: false };
  }

  if (status === 401 || status === 403) {
    return { message: 'Authentication failed. Check your Storyblok token.', isPlanRequired: false };
  }

  return { message, isPlanRequired: false };
}

/**
 * Upserts a component (creates if missing, updates if exists)
 */
export async function upsertComponent(token: string, spaceId: string | number, raw: any) {
  const existingComponents = await getComponents(token, spaceId);
  const componentName = raw.name;
  const existingComponent = existingComponents.find((c: any) => c.name === componentName);

  if (existingComponent) {
    return {
      component: await updateComponent(token, spaceId, existingComponent.id, raw),
      action: 'updated' as const,
      existingComponent
    };
  } else {
    return {
      component: await createComponent(token, spaceId, raw),
      action: 'created' as const,
      existingComponent: null
    };
  }
}
