# CreativEx 2026 Application Form

Static vanilla `HTML + CSS + JS` application form module for CreativEx 2026.

## Files
- `index.html` contains the branded standalone page and form markup.
- `styles.css` contains the responsive visual system and theme styling.
- `app.js` contains validation, payload normalization, mock submission, and API-ready form logic.

## Local usage
Open `index.html` in a browser.

## API configuration
The page initializes the module with:

```js
window.CreativExApplyForm.init({
  apiBaseUrl: "",
  submitPath: "/applications",
  mockMode: true,
  timeoutMs: 15000,
  extraHeaders: {},
  onSuccess: null,
  onError: null
});
```

To connect a real backend, set:
- `mockMode: false`
- `apiBaseUrl` to your API origin, for example `https://api.example.com`
- `submitPath` to your application route

## Submitted payload keys
- `firstNameTh`
- `lastNameTh`
- `firstNameEn`
- `lastNameEn`
- `nicknameTh`
- `nicknameEn`
- `email`
- `phone`
- `lineId`
- `jobTitle`
- `organization`
- `educationHistory`
- `executivePrograms`
- `coordinatorInfo`
- `birthDate`
- `additionalInfo`
- `marketingConsent`
- `photoFile`
- `resumeFile`

The module submits with `FormData` so file uploads are already compatible with a future API.
