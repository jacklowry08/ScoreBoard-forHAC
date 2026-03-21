const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Supabase's realtime-js imports the Node.js `ws` package which pulls in
// Node built-ins (stream, etc.) that don't exist in React Native.
// Replace it with a shim that uses React Native's built-in WebSocket.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws') {
    return {
      filePath: require.resolve('./ws-shim.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
