const https = require('https');

https.get('https://pl29698487.effectivecpmnetwork.com/66/c3/59/66c3592296a5a47dfcc56ad2915c624d.js', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("LENGTH:", data.length);
    console.log(data.substring(0, 1000));
  });
}).on('error', (err) => {
  console.error("ERROR:", err.message);
});
