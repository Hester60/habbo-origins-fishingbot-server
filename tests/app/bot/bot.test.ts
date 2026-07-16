import { afterEach, describe, expect, it, vi } from 'vitest';
import Bot from '../../../src/app/bot/bot.js';
import Base64Codec from '../../../src/core/wire/base64-codec.js';
import PacketParser from '../../../src/core/wire/packet-parser.js';
import { IncomingHeaders, OutgoingHeaders } from '../../../src/core/protocol/headers.js';
import { FakeSocket } from '../../test-helper.js';
import dial from '../../../src/core/net/dial.js';
import ClientVersionProvider from '../../../src/core/protocol/client-version-provider.js';

vi.mock('../../../src/core/net/dial.js', () => ({
  default: vi.fn(),
}));

const mockedDial = vi.mocked(dial);

function inboundFrame(header: number): Buffer {
  return Buffer.concat([Base64Codec.encodeInt(header, 2), Buffer.from([0x01])]);
}

describe('Bot', () => {
  it('exposes a usable EventBus before connect() is ever called', () => {
    const bot = new Bot('bot@example.com', 'hunter2');

    let received: string | undefined;
    bot.eventBus.on('LOGIN_FAILED', (reason) => {
      received = reason;
    });
    bot.eventBus.emit('LOGIN_FAILED', 'bad credentials');

    expect(received).toBe('bad credentials');
  });

  const noOpMethods: [string, (bot: Bot) => void][] = [
    ['submitOtp()', (bot) => bot.submitOtp('123456')],
    ['moveToRoom()', (bot) => bot.moveToRoom(26)],
    ['requestHeightmap()', (bot) => bot.requestHeightmap()],
    ['requestUsers()', (bot) => bot.requestUsers()],
    ['requestOwnInfo()', (bot) => bot.requestOwnInfo()],
    ['move()', (bot) => bot.move(10, 5)],
    ['startFishing()', (bot) => bot.startFishing(1005)],
    ['requestFishingStats()', (bot) => bot.requestFishingStats()],
  ];

  it.each(noOpMethods)('%s is a silent no-op before connect() has run', (_name, action) => {
    const bot = new Bot('bot@example.com', 'hunter2');

    expect(() => action(bot)).not.toThrow();
  });

  it('isRoomEntered() returns false before connect() has run', () => {
    const bot = new Bot('bot@example.com', 'hunter2');

    expect(bot.isRoomEntered()).toBe(false);
  });

  it('me() returns undefined before connect() has run', () => {
    const bot = new Bot('bot@example.com', 'hunter2');

    expect(bot.me()).toBeUndefined();
  });

  it('getFishingAction() returns undefined before connect() has run', () => {
    const bot = new Bot('bot@example.com', 'hunter2');

    expect(bot.getFishingAction(79)).toBeUndefined();
  });

  it('getMoveAction() returns undefined before connect() has run', () => {
    const bot = new Bot('bot@example.com', 'hunter2');

    expect(bot.getMoveAction(79)).toBeUndefined();
  });

  describe('connect()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      mockedDial.mockReset();
    });

    it('fetches the version and dials the right host/port for the hotel', async () => {
      const socket = new FakeSocket();
      mockedDial.mockResolvedValue(socket);
      const fetchClientVersion = vi
        .spyOn(ClientVersionProvider, 'fetchClientVersion')
        .mockResolvedValue(330);
      const bot = new Bot('bot@example.com', 'hunter2', 'hhous', { logPackets: false });

      await bot.connect();

      expect(fetchClientVersion).toHaveBeenCalledOnce();
      expect(mockedDial).toHaveBeenCalledWith('game-ous.habbo.com', 40001);
    });

    it('does not dial again if already connected', async () => {
      const socket = new FakeSocket();
      mockedDial.mockResolvedValue(socket);
      vi.spyOn(ClientVersionProvider, 'fetchClientVersion').mockResolvedValue(330);
      const bot = new Bot('bot@example.com', 'hunter2', 'hhous', { logPackets: false });

      await bot.connect();
      await bot.connect();

      expect(mockedDial).toHaveBeenCalledOnce();
    });

    it('wires the handshake: a HELLO from the server gets a CLIENT_INIT back', async () => {
      const socket = new FakeSocket();
      mockedDial.mockResolvedValue(socket);
      vi.spyOn(ClientVersionProvider, 'fetchClientVersion').mockResolvedValue(330);
      const bot = new Bot('bot@example.com', 'hunter2', 'hhous', { logPackets: false });

      await bot.connect();
      socket.simulateReceive(inboundFrame(IncomingHeaders.HELLO));

      expect(socket.sent).toHaveLength(1);
      const packet = PacketParser.parse(socket.sent[0].subarray(3));
      expect(packet.header).toBe(OutgoingHeaders.CLIENT_INIT);
    });

    it('logs received packets by default', async () => {
      const socket = new FakeSocket();
      mockedDial.mockResolvedValue(socket);
      vi.spyOn(ClientVersionProvider, 'fetchClientVersion').mockResolvedValue(330);
      const bot = new Bot('bot@example.com', 'hunter2', 'hhous');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await bot.connect();
      socket.simulateReceive(inboundFrame(IncomingHeaders.HELLO));

      expect(logSpy).toHaveBeenCalled();
    });

    it('does not log received packets when logPackets is false', async () => {
      const socket = new FakeSocket();
      mockedDial.mockResolvedValue(socket);
      vi.spyOn(ClientVersionProvider, 'fetchClientVersion').mockResolvedValue(330);
      const bot = new Bot('bot@example.com', 'hunter2', 'hhous', { logPackets: false });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await bot.connect();
      socket.simulateReceive(inboundFrame(IncomingHeaders.HELLO));

      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
