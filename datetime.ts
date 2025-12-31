export function formatDate(date: Date, format: string) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear().toString();
  const yearShort = (date.getFullYear() % 100).toString().padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Replace tokens with actual values
  return format
    .replace('YYYY', year)
    .replace('YY', yearShort)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

export function formatDateNow(format: string) {
  return formatDate(new Date(), format);
}
