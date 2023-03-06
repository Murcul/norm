export const quoteAndJoin = (list: Array<string | number | symbol>): string => {
  return list.map((el) => `"${String(el)}"`).join(', ');
};
