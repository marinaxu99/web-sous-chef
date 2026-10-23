# Web Sous-Chef

Real recipes from the cooks you already watch and read, cleaned up and ready to cook.
Plain HTML, CSS and JavaScript. No build step, no server.

## Put it online

Upload the whole folder to the same place your current site lives (GitHub Pages with the
`CNAME` file, or any static host). Open the site, tap the key button, and paste your Gemini key.

The old `airecipe.html` link now forwards to the new home page.

## Your Gemini key

- Get a free key at https://aistudio.google.com/apikey
- It is stored only in the browser you paste it into (localStorage) and sent to Google in the
  `x-goog-api-key` request header, never in a URL.
- Anyone using that browser can read it in developer tools. That is fine while the site is
  private. Two quick protections in Google Cloud Console → APIs & Services → Credentials:
  1. Restrict the key to websites: add `https://souschef.marinamingnanxu.com/*`.
  2. Stay on the free tier, or set a budget alert, so a leaked key can't run up a bill.
- Models are tried in order: `gemini-3.5-flash-lite`, `gemini-2.5-flash`, `gemini-3.5-flash`. If one is
  missing, busy or over its free limit, the next one answers. Change the list under Keys → Models.

## Videos (YouTube key)

Video results come straight from YouTube's own search, so links, thumbnails and dates are real,
and only videos from the last 3 years are shown. This needs "YouTube Data API v3":

1. Google Cloud Console → APIs & Services → Library → search "YouTube Data API v3" → Enable
   (in the same project as your Gemini key).
2. Either allow that API on your Gemini key (Credentials → your key → API restrictions), or
   create a second key and paste it into "YouTube key" in the site's settings.

Without it, search still works with blogs and classics, and the site tells you videos are off.
The free quota is about 100 searches a day.

## How recipes work

| Source  | How Sous-Chef gets it                                             |
|---------|-------------------------------------------------------------------|
| Video   | Gemini watches the public YouTube video directly                  |
| Blog    | Gemini reads the page with its URL tool                           |
| Classic | Gemini writes a well-known dish only; it refuses invented dishes  |
| Post    | You paste text and/or a screenshot (for RedNote and similar apps) |

Blogs are found with Gemini's built-in Google Search. Google returns temporary redirect links,
so Sous-Chef then opens each page with Gemini to get its real address, photo and publish date.
Pages older than 3 years, or whose real address can't be confirmed, are left out. Results are
capped at 6.

If something fails, the error box has a "Details" line with Google's own message.

Rules every recipe follows: amounts, times and heat are copied from the source; steps are
rewritten short; the cook is credited and linked. Safe meat temperatures come from the USDA
table in `js/data.js`, never from the AI.

## Files

```
index.html        page shell, dialogs
css/style.css     all styles
js/app.js         screens, routing, buttons
js/ai.js          every Gemini call (the only file to change when you add a server)
js/timers.js      named timers that survive reloads
js/data.js        pantry, cup-to-gram weights, swaps, safe temperatures (hand-checked)
js/util.js        helpers: escaping, fractions, units, share links
js/vendor/qrcode.js   QR code library (MIT, Kazuhiko Arase)
```

## Send to phone

The QR code carries the whole recipe inside the link, compressed. No server or account
needed, and the phone doesn't need a key to cook it. "Copy link" does the same thing.

## Going public later

1. Make a small server (for example a Cloudflare Worker) that holds the Gemini key and
   forwards requests to `generativelanguage.googleapis.com`.
2. In `js/ai.js`, change `callGemini()` to post to your server and drop the key header.
3. Remove the key button, the `robots.txt` file and the `robots` meta tag in `index.html`.
