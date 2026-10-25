import axios from 'axios'

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.VITE_API_URL ??
  'http://localhost:3000'

export const api = axios.create({
  baseURL,
  timeout: 90_000,
})

// ── Automatic retry with exponential backoff for timeout / network errors ──
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 2_000

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config
    if (!config) return Promise.reject(err)

    // Track retry count on the request config
    config.__retryCount = config.__retryCount ?? 0

    // Only retry on timeout or network errors (not 4xx/5xx business errors)
    const isRetryable =
      err.code === 'ECONNABORTED' || // axios timeout
      err.code === 'ERR_NETWORK' ||  // network failure
      err.message?.includes('timeout') ||
      err.message?.includes('Network Error')

    if (!isRetryable || config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(err)
    }

    config.__retryCount += 1
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, config.__retryCount - 1)
    console.warn(
      `[API] Retry ${config.__retryCount}/${MAX_RETRIES} after ${delay}ms for ${config.url}`,
    )

    await new Promise((resolve) => setTimeout(resolve, delay))

    return api.request(config)
  },
)
