ROSCA & DOWNLINE COMMUNITY - PWA (dika voalohany)

INONA NO AO ANATY
- Fisoratana anarana sy fidirana amin'ny Supabase Auth.
- Pejy membre: mijery épargne, commission, fangatahana dépôt/retrait.
- Pejy Admin: mijery fangatahana sy mpikambana; manova sata amin'ny RPC efa misy.
- PWA: manifest, service worker, icon.

ZAVA-DEHIBE ALOHAN'NY AMPIASANA AMIN'NY VOLA TENA IZY
1. Ity dia dika voalohany (starter) fa tsy mbola voasedra amin'ny kaonty tena izy.
2. Tsy misy FaucetPay API integration ato. Ny TxID ampidirina dia tsy porofo fa voaloa.
3. Ny fanekena dépôt dia manova sata ho approved fotsiny; tsy mampiditra vola amin'ny balance.
4. Ny fanekena retrait dia tsy mandefa vola. Mila backend/server function azo antoka sy API FaucetPay voamarina.
5. Aza ampidirina eto mihitsy ny service_role key, database password na FaucetPay secret key.
6. Mila HTTPS rehefa apetraka amin'ny hosting.

FOMBA FANOKAFANA EO AN-TOERANA
- Sokafy amin'ny navigateur ny index.html raha hijery ny endrika; mety tsy mandeha tsara ny Auth noho ny fepetra HTTPS.
- Aleo apetraka amin'ny hosting HTTPS (Netlify/Vercel/hosting hafa) rehefa vita ny fanamarinana.

SUPABASE
- Ny URL sy publishable key dia efa ao amin'ny app.js.
- Ataovy azo antoka fa mbola mandeha ny RLS sy policies.
- Supabase Auth > URL Configuration: ampidiro ny URL tena izy rehefa avy manao deploy.
- Aza mampiasa service_role key amin'ny navigateur.

FILES
index.html, styles.css, app.js, manifest.webmanifest, sw.js, icon.svg
