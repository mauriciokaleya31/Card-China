// Shim for DigitalPersona WebSdk legacy import
// Some versions of the library expect a global WebSdk or a specific structure

export function WebChannelClient() {
  console.log("WebChannelClient shim constructor called");
}

WebChannelClient.prototype.subscribe = function() { return Promise.resolve(); };
WebChannelClient.prototype.unsubscribe = function() { return Promise.resolve(); };
WebChannelClient.prototype.onConnectionStateChanged = function() {};

export const WebSdk = {
  Status: {
    Completed: 0,
    Canceled: 1,
    Unknown: 2
  },
  QualityCode: {
    Excellent: 0,
    Good: 1,
    Poor: 2,
    Unknown: 3
  },
  ImageFormat: {
    Png: 0,
    Jpeg: 1,
    Bmp: 2
  },
  WebChannelClient: WebChannelClient
};

if (typeof window !== 'undefined') {
  (window as any).WebSdk = WebSdk;
  (window as any).WebChannelClient = WebChannelClient;
}

export default WebSdk;


