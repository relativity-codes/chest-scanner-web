import { EventEmitter } from "events";

const globalForEmitter = globalThis as unknown as {
  emitter: EventEmitter | undefined;
};

let emitterInstance: EventEmitter;

if (process.env.NODE_ENV === "production") {
  emitterInstance = new EventEmitter();
} else {
  if (!globalForEmitter.emitter) {
    globalForEmitter.emitter = new EventEmitter();
  }
  emitterInstance = globalForEmitter.emitter;
}

emitterInstance.setMaxListeners(100);

export const eventEmitter = emitterInstance;
export const EVENTS = {
  CHEST_SCANNED: "chest_scanned",
};
