// Online Hall of Fame. Filled in when the Firebase project is created.
// Leave projectId empty to keep scores on each device only.
// The apiKey of a Firebase web app is not a secret: access is controlled by
// firestore.rules.
export const FIREBASE = {
  projectId: '',
  apiKey: '',
};

// Official artwork and fallback cries are loaded from public mirrors at runtime,
// so no Nintendo artwork is copied into this repository.
export const ARTWORK_SOURCES = [
  (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
  (id) => `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${id}.png`,
];

export const FALLBACK_CRY_SOURCES = [
  (p) => `https://play.pokemonshowdown.com/audio/cries/${p.sd}.mp3`,
  (p) => `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${p.id}.ogg`,
];

export const SITE_URL = '';
