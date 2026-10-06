# Who's That Pokémon?

Gioco web per indovinare i Pokémon dalla sagoma, dedicato a Daniele, che ha registrato i versi.
Fatto per il telefono, gratuito da mantenere: un sito statico (GitHub Pages) più una classifica online
(Firebase Firestore, piano gratuito).

Fan game non ufficiale e senza scopo di lucro. Pokémon e i relativi nomi sono marchi di Nintendo, Creatures e
GAME FREAK. Gli artwork ufficiali non sono copiati in questo repository: il gioco li carica dal mirror pubblico
di PokéAPI.

## Come si gioca

- 493 Pokémon (dalla 1ª alla 4ª generazione), in ordine casuale e sempre diverso a ogni partita.
- 3 vite per partita: ogni nome sbagliato costa una vita, anche un nome inesistente.
  Maiuscole, spazi e simboli non contano ("mr mime" = Mr. Mime).
- 3 suggerimenti per partita: ognuno svela una lettera, la generazione e i tipi.
  La lunghezza del nome è sempre visibile.
- Ogni Pokémon indovinato vale 1 punto, anche con un suggerimento.
- Alla rivelazione parte il verso registrato da Daniele (quello ufficiale se manca la registrazione).
- 5 temi (Night Arena è il predefinito), scelti dalla schermata iniziale e ricordati sul telefono.
- Hall of Fame online con nickname; se la rete non c'è, il punteggio resta salvato sul telefono.

## Struttura

```
index.html                pagina unica
css/app.css               base comune (rivelazione, lettere, schede, animazioni)
css/themes/*.css          i 5 temi: ognuno con la sua disposizione
js/main.js                schermate e collegamenti
js/game.js                regole del gioco (testate in Node)
js/names.js               confronto dei nomi
js/leaderboard.js         Hall of Fame (Firestore REST + copia sul telefono)
js/audio.js               versi, effetti sonori, musica chiptune originale
js/themes/*.js            markup di ogni tema (stessi data-role in tutti)
js/config.js              progetto Firebase e sorgenti esterne
data/pokemon.json         nomi, tipi, generazione dei 493 Pokémon
audio/cries/<n>.mp3       versi di Daniele ripuliti (n = numero del Pokédex)
firestore.rules           regole di sicurezza della classifica
tools/clean_audio.py      pulizia dei versi
tests/                    test (vedi sotto)
```

## Aggiungere o sostituire i versi

Metti tutti gli mp3 originali in una cartella (nomi `1.mp3`, `2.mp3`, …) e lancia:

```
python3 tools/clean_audio.py <cartella_originali> audio/cries tools/audio_report.json 493
```

Poi rigenera il campo `cry` dei dati (lo fa il test `data` se non coincide: vedi l'errore) ed esegui i test.
La pulizia fa: filtro passa-alto a 80 Hz, riduzione del fruscio, taglio dei silenzi iniziali e finali,
volume uniforme (-16 LUFS, picco -1 dB), mp3 mono 80 kbps.

## Test

```
node tests/run-all.mjs          # tutto: logica, audio, browser
node tests/run-all.mjs unit     # solo un gruppo: unit | audio | e2e
```

Il report leggibile finisce in `test-results/REPORT.md`, con ogni test, il tempo e, per quelli falliti,
il messaggio e il punto del codice. L'output completo è in `test-results/<gruppo>.log`.

Servono Node 20+, ffmpeg (per i test audio) e Playwright con Chromium (per i test nel browser).

Per vedere tutti i temi in screenshot: `node tests/e2e/shoot.mjs shots`.

## Debug sul telefono

Aggiungi `?debug=1` all'indirizzo: compare un pannellino con la risposta, vite, suggerimenti, stato dell'audio,
dimensioni dello schermo, ultimi tentativi ed eventuali errori. Tocca il pannello per chiuderlo.

## Pubblicazione

1. GitHub Pages: repository pubblico, Settings › Pages › branch `main`, cartella `/`.
2. Firebase: crea un progetto, aggiungi un'app web, crea il database Firestore e incolla `firestore.rules`
   nelle regole. Copia `projectId` e `apiKey` in `js/config.js`.
