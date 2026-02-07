Deploying Cloud Functions

1. Install dependencies in the functions folder:
   cd functions && npm install

2. Deploy the function:
   firebase deploy --only functions:listUsersForAdmin

3. Grant admin access (either use Admin SDK to set custom claims or add your admin UID to RTDB under `/admins/{uid}`):
   In Realtime Database add a node like:
   {
     "admins": {
       "<your-admin-uid>": true
     }
   }

Security notes
- This callable checks `/admins/{uid}` in RTDB to confirm callers are admins. It avoids changing Realtime Database rules to enable listing for admins.
- For more robust production access control use custom claims via Firebase Admin SDK.
