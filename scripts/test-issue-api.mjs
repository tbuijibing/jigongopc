#!/usr/bin/env node

const issueId = process.argv[2] || 'FSD-13';
const port = process.argv[3] || '3101';

console.log(`Testing issue API for: ${issueId}`);
console.log(`Server: http://localhost:${port}\n`);

try {
  const response = await fetch(`http://localhost:${port}/api/issues/${issueId}`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  console.log('Status:', response.status, response.statusText);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));
  
  const text = await response.text();
  console.log('\nResponse body:');
  
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(text);
  }
} catch (error) {
  console.error('Error:', error.message);
}
