# StoneForge Reviews & Ratings

Changed files:

## Frontend
- `index.html`
- `index.css`
- `StoneForge.js`

## Backend
- `server.js`

### Features
- Public average rating and review count
- Latest 12 reviews displayed
- 1–5 star rating
- Optional review text, max 500 characters
- Login required to submit
- One review per PlayFab account; submitting again updates it
- Backend derives the PlayFab account from the authenticated session
- HTML escaping on displayed review text/names
- Restricted accounts cannot submit reviews
- Admin endpoint to remove a review:
  `DELETE /api/admin/reviews/:playfab_id`

### Important
Do NOT upload or replace your `.env` file with anything from this package.

### Deployment
1. Apply the three frontend files to your frontend repo.
2. Apply `server.js` to your backend repo.
3. Commit both repos separately.
4. Deploy the backend first.
5. Deploy the frontend.
6. Test while logged out: reviews should be visible and submission should ask for sign-in.
7. Test while logged in: submit a rating, refresh, then edit the same review.
