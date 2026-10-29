# One mobile number per account — backend change

## Why

People who give up on a sign-up (wrong email, OTP never entered) sign up again with a new email and the same
mobile number. The admin Users list then shows several accounts for one person, only one of them verified. Example
today: 9789033463 is on three accounts (ks59744@mail.com, ks5976344@gmail.com unverified; kselvi5447@gmail.com
verified).

## What to change

1. **Sign-up (`POST /user/auth/register` and the Google sign-up with `profile`).** Compare mobile numbers on their
   last 10 digits, so `+91 97890 33463` and `9789033463` are the same number.
   - **Number already on a verified account:** refuse the sign-up with 409 and the message
     *"This mobile number is already registered. Sign in with OTP instead."*
   - **Number only on unverified accounts:** let the sign-up go through, and delete or disable those unverified accounts,
     because that person never finished signing up with them.
2. **Profile update (`PATCH` of the user's phone):** apply the same check.
3. **Existing duplicates:** for each number on more than one account, keep the verified account (or the one with
   attempts or payments) and disable the rest. Send the list for review before deleting anything.
4. Optional: a unique index on the normalised number once the data is clean.

## Frontend (done)

- Users page: an account whose email OTP was never entered shows **"Sign-up incomplete"**. It used to show "Not verified".
- A number on more than one account shows **"Duplicate phone (n)"**. Clicking it filters the list to those accounts.
