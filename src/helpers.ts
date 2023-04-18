export const quoteAndJoin = (
  list: Array<string | number | symbol>,
  prefix?: string,
): string => {
  return list.map((el) =>
    prefix ? `${prefix}."${String(el)}"` : `"${String(el)}"`
  ).join(', ');
};
