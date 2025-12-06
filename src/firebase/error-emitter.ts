// A simple event emitter to decouple error handling from the data layer.
// Components can subscribe to events and react to them.
type Listener<T> = (data: T) => void;

class EventEmitter<Events extends Record<string, any>> {
  private listeners: { [K in keyof Events]?: Listener<Events[K]>[] } = {};

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event]!.filter(l => l !== listener);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event]!.forEach(listener => listener(data));
  }
}

// Define the events that can be emitted.
interface AppEvents {
  'permission-error': Error;
}

// Create a singleton instance of the event emitter.
export const errorEmitter = new EventEmitter<AppEvents>();
