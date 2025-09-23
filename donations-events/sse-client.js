// sse-client-donated.mjs
// Streams the Donated event SSE from your server and prints incoming chunks.

const url = 'http://localhost:4000/events/Donated/stream';

const res = await fetch(url);
if (!res.ok || !res.body) {
    console.error('Failed to connect to SSE stream:', res.status, res.statusText);
    process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value));
}
