const ISO_COUNTRY = /^[A-Za-z]{2}$/

/** Sets the `gl` param on a YouTube url so its content follows `country`.
 * Anything that is not a two-letter code leaves the url untouched. */
export function withContentCountry(url: string, country?: string | null): string {
  if (!country || !ISO_COUNTRY.test(country)) {
    return url
  }
  try {
    const parsed = new URL(url, 'https://m.youtube.com')
    parsed.searchParams.set('gl', country.toUpperCase())
    return parsed.toString()
  } catch {
    return url
  }
}
