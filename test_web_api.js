const http = require('http');

// Test the web API directly
async function testWebAPI() {
  console.log('Testing web API...');

  // Start a simple HTTP request to the updates endpoint
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/updates',
    method: 'GET',
    timeout: 60000, // 60 second timeout
  };

  return new Promise((resolve, _reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('API Response:', result);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse response:', error);
          resolve({ error: 'Parse error', data });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error.message);
      resolve({ error: error.message });
    });

    req.on('timeout', () => {
      console.log('Request timed out');
      req.destroy();
      resolve({ error: 'Timeout' });
    });

    req.end();
  });
}

// Test the API
testWebAPI().then(_result => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
