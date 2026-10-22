// Registers @opentelemetry/instrumentation-http before Next requires node:http,
// so its incoming-request SERVER span is the root and Next's handleRequest span
// is its child: the shape any platform-created HTTP span has.
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { InMemorySpanExporter, SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
const exporter = new InMemorySpanExporter();
const sdk = new NodeSDK({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
  instrumentations: [new HttpInstrumentation()],
});
sdk.start();
globalThis.__otelExporter = exporter;
