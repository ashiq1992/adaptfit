/** The app's single source of "now". Tests and Playwright can control it. */
export const clock = {
  now: (): Date => new Date(),
};
