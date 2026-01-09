
export function serializeForServer(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
