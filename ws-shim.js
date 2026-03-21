// React Native has a built-in WebSocket implementation.
// Supabase's realtime-js uses the `ws` npm package when running in Node.js,
// but in React Native we can use the global WebSocket directly.
module.exports = WebSocket;
