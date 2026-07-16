type FetchFn = (url: string) => Promise<Response>;

/**
 * Fetches the current Shockwave client version from Habbo's public
 * clienturls endpoint — unlike the release token, this value IS checked by
 * the game server, so it can't be a throwaway placeholder. Deliberately
 * never falls back to a hardcoded guess on failure: Habbo ships roughly
 * weekly, so a stale hardcoded version would likely be wrong anyway and
 * would only turn a clear network failure into a confusing "version not
 * correct" rejection later. fetchFn is injectable so tests never touch a
 * real network.
 */
export default class ClientVersionProvider {
  static GAMEDATA_URL = 'https://origins.habbo.com/gamedata/clienturls';

  static async fetchClientVersion(fetchFn: FetchFn = fetch): Promise<number> {
    try {
      const response: Response = await fetchFn(ClientVersionProvider.GAMEDATA_URL);

      if (!response.ok) {
        throw new Error(`Failed to fetch game data URL: ${response.status} ${response.statusText}`);
      }

      const json: Record<string, string> = (await response.json()) as Record<string, string>;

      const version = parseInt(json['shockwave-windows-version'], 10);

      if (!Number.isFinite(version)) {
        throw new Error('Unexpected clienturls response shape.');
      }
      return version;
    } catch (error) {
      throw new Error('Error fetching game data URL.', {
        cause: error,
      });
    }
  }
}
