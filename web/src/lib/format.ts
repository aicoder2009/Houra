export function formatIsoDate(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return parsed.toISOString().slice(0, 10);
}

export function formatIsoDateTime(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return `${parsed.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function formatIsoTime(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return parsed.toISOString().slice(11, 19);
}
