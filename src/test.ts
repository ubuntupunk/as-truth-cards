async function testApi() {
  try {
    const response = await fetch('http://localhost:8081/api/cards');
    const data = await response.json();
    console.log('API Response:', data);
  } catch (error) {
    console.error('API Error:', error);
  }
}

testApi();
