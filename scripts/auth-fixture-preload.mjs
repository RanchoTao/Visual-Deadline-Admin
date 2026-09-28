// Test process only: route the reserved HTTPS fixture hostname to the loopback double.
// No application import, deployment flag, TLS weakening, or production credentials.
const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.origin === "https://auth.example.test") {
    url.protocol = "http:";
    url.hostname = "127.0.0.1";
    url.port = "3304";
    return original(url, init);
  }
  return original(input, init);
};
