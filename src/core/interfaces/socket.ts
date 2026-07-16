export default interface Socket {
  write(data: Buffer): void;
  onData(callback: (data: Buffer) => void): void;
}
