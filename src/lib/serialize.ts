
export function serializeForServer(value: any) {
  return JSON.parse(JSON.stringify(value));
}
