import { describe, expect, it } from 'vitest';
import ClientVersionProvider from '../../../src/core/protocol/client-version-provider.js';

function fakeResponse(body: unknown, ok: boolean = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe('ClientVersion.fetchClientVersion', () => {
  it('resolves with the version parsed from a valid response', async () => {
    const fakeFetch = async () => fakeResponse({ 'shockwave-windows-version': '330' });

    const version = await ClientVersionProvider.fetchClientVersion(fakeFetch);

    expect(version).toBe(330);
  });

  it('rejects when the underlying fetch itself fails', async () => {
    const fakeFetch = async (): Promise<Response> => {
      throw new Error('network down');
    };

    await expect(ClientVersionProvider.fetchClientVersion(fakeFetch)).rejects.toThrow();
  });

  it('rejects when the response is not ok', async () => {
    const fakeFetch = async () => fakeResponse({}, false);

    await expect(ClientVersionProvider.fetchClientVersion(fakeFetch)).rejects.toThrow();
  });

  it('rejects when the expected field is missing from the JSON', async () => {
    const fakeFetch = async () => fakeResponse({ 'something-else': 'nope' });

    await expect(ClientVersionProvider.fetchClientVersion(fakeFetch)).rejects.toThrow();
  });

  it('rejects when the expected field is not a valid number', async () => {
    const fakeFetch = async () => fakeResponse({ 'shockwave-windows-version': 'not-a-number' });

    await expect(ClientVersionProvider.fetchClientVersion(fakeFetch)).rejects.toThrow();
  });
});
