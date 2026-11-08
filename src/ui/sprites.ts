/**
 * Original 32×32 pixel adventurer for AdaptFit (drawn for this project; no
 * external assets). Layers are composited in order; '.' is transparent.
 * Unlock layers are added as the character levels up.
 */

export const PALETTE: Record<string, string> = {
  o: '#16121c', // outline
  h: '#5b3a24', // hair
  H: '#8a5a34', // hair highlight
  s: '#f2c6a0', // skin
  S: '#d49a74', // skin shade
  e: '#1b1b26', // eye
  w: '#ffffff', // eye glint
  m: '#b4574a', // mouth
  r: '#d8433a', // red headband / scarf
  R: '#9a2b2b', // red shade
  c: '#3e4c60', // shirt
  C: '#2c3646', // shirt shade
  l: '#8c5a35', // leather
  L: '#5f3b22', // leather shade
  b: '#2a1d16', // belt
  g: '#f5b041', // buckle / gold
  G: '#c98a22', // gold shade
  p: '#2a3240', // trousers
  P: '#1d242f', // trousers shade
  k: '#4a2f1d', // boots
  K: '#2e1d12', // boots shade
  a: '#a7b3c2', // armour
  A: '#6e7a8a', // armour shade
  v: '#8e2232', // cape
  V: '#5e1622', // cape shade
  t: '#00d6a3', // teal gem
};

/** Base figure (level 1): headband, shirt, leather vest, belt, trousers, boots. */
export const BASE: string[] = [
  '',
  '...........o..o...o.............',
  '..........oho.oHo.oho...........',
  '.........ohhhohHhohhho..........',
  '........ohhhhhhhhhhhhho.........',
  '........ohHhhhhhhhhhHho.........',
  '........orrrrrrrrrrrrro.rr......',
  '........ohssssssssssshorR.......',
  '........ohsseesssseesho..R......',
  '........oSsswesssswesSo.........',
  '........oSsssssssssssSo.........',
  '.........oSssssmmssssSo.........',
  '..........oSssssssssSo..........',
  '...........oossssssoo...........',
  '.........ooccSssssSccoo.........',
  '........occclllcclllccco........',
  '.......occClllcccclllCcco.......',
  '.......occClLlccccLlLCcco.......',
  '.......occClllcccclllCcco.......',
  '.......ossolllcccclllosso.......',
  '.......oSsollllllllllosSo.......',
  '........ooobbbbggbbbbooo........',
  '..........oppppppppppo..........',
  '..........oppppooppppo..........',
  '..........opPpo..opPpo..........',
  '..........opPpo..opPpo..........',
  '..........opppo..opppo..........',
  '.........okkkko..okkkko.........',
  '.........okKkko..okKkko.........',
  '........okkkkko..okkkkko........',
  '........ooooooo..ooooooo........',
  '',
];

/** Level 3: red scarf around the neck. */
export const SCARF: string[] = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '..........orrrrrrrrrro..........',
  '.........orRrrrrrrrrRro.........',
  '..........oRro....orRo..........',
  '...........oRo....oro...........',
  '............oo.....o............',
];

/** Level 5: bedroll on the shoulders and pack straps. */
export const PACK: string[] = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '.......olllo........olllo.......',
  '.......oLLLo........oLLLo.......',
  '............L......L............',
  '............L......L............',
  '............L......L............',
  '............L......L............',
];

/** Level 10: cape, drawn behind the figure. */
export const CAPE: string[] = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '......ovvvvvvvvvvvvvvvvvvo......',
  '.....ovVvvvvvvvvvvvvvvvvVvo.....',
  '.....ovVvvvvvvvvvvvvvvvvVvo.....',
  '.....ovVvvvvvvvvvvvvvvvvVvo.....',
  '.....ovVvvvvvvvvvvvvvvvvVvo.....',
  '.....ovVvvvvvvvvvvvvvvvvVvo.....',
  '.....ovVvvvvvvvvvvvvvvvvVvo.....',
  '....ovvVvvvvvvvvvvvvvvvVvvo.....',
  '....ovvVvvvvvvvvvvvvvvvVvvo.....',
  '....ovvVvvvvvvvvvvvvvvvVvvo.....',
  '....ovvVvvvvvvvvvvvvvvvVvvo.....',
  '....ovvVvvvvvvvvvvvvvvvVvvo.....',
  '....ovvVvvvvvvvvvvvvvvvVvvo.....',
  '...ovvVvvvvvvvvvvvvvvvvvVvvo....',
  '...ovVVvvvvvvvvvvvvvvvvvVVvo....',
  '....ooVVvvvvvvvvvvvvvvVVoo......',
  '......oooooooooooooooooooo......',
];

/** Level 15: iron pauldrons and chest plate. */
export const ARMOUR: string[] = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '......oaaao..........oaaao......',
  '.....oaAAAao........oaAAAao.....',
  '......oooooooaAaaAaoooooooo.....',
  '............oAaaaaAo............',
  '.............oAaaAo.............',
  '..............oooo..............',
];

/** Level 20: gilded trim and a teal gem. */
export const GILDED: string[] = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '.......ggg............ggg.......',
  '',
  '',
  '..............gttg..............',
  '...............GG...............',
];
