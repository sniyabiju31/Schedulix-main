Secure Realtime Database rules and deployment instructions

1) What these rules do
- Require users to be authenticated to read/write their own `/users/{uid}` node.
- Validate that `/users/{uid}` entries include `email`, `name`, `role`, and `createdAt`.
- Block client writes to `/admins` and `/staffs` nodes (intended to be managed server-side or by admins).
- Require authenticated reads/writes for `test_connection/{uid}` used for diagnostics.

2) How to deploy the rules
- You can use `npx` (no global install) or install `firebase-tools` globally.

Using npx (recommended):

1. Login to Firebase:
   npx firebase login

2. Ensure the project is selected (if the project isn't set up locally):
   npx firebase use --add
   # follow prompts to select `schedulix-de3be` project

3. Deploy only the database rules:
   npx firebase deploy --only database --project schedulix-de3be

Alternatively, use the provided npm script:

   npm run deploy:firebase-rules

This will run `npx firebase-tools deploy --only database` and deploy `database.rules.json` to your project.

3) Notes
- After deploying these rules, signup must create a Firebase Auth user first (our app does this), then the app can write to `/users/{uid}` because the user is authenticated.
- If you need different read/write policies (e.g., admins can read many users), update `database.rules.json` accordingly.

4) Rollback/testing
- To test rules without deploying, use the Firebase Console Rules simulator or temporarily set permissive rules and test, then re-deploy secure rules.