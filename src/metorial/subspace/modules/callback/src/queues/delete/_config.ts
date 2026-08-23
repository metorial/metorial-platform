export let getCutoffDate = () => {
  let date = new Date();
  date.setDate(date.getDate() - 14);
  return date;
};
