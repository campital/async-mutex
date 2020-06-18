import SemaphoreInterface from './SemaphoreInterface';

class Semaphore implements SemaphoreInterface {
    constructor(private _value: number) {
        if (_value <= 0) {
            throw new Error('semaphore must be initialized to a positive value');
        }
    }

    acquire(): Promise<[number, SemaphoreInterface.Releaser]> {
        const locked = this.isLocked();
        const ticket = new Promise<[number, SemaphoreInterface.Releaser]>((r) => this._queue.push(r));

        if (!locked) this._dispatch();

        return ticket;
    }

    async runExclusive<T>(callback: SemaphoreInterface.Worker<T>): Promise<T> {
        const [value, release] = await this.acquire();

        try {
            return await callback(value);
        } finally {
            release();
        }
    }

    isLocked(): boolean {
        return this._value <= 0;
    }

    release(): void {
        if (this._currentReleaser) {
            this._currentReleaser();
            this._currentReleaser = undefined;
        }
    }

    private _dispatch(): void {
        const nextConsumer = this._queue.shift();

        if (!nextConsumer) return;

        let released = false;
        this._currentReleaser = () => {
            if (released) return;

            released = true;
            this._value++;

            this._dispatch();
        };

        nextConsumer([this._value--, this._currentReleaser]);
    }

    private _queue: Array<(lease: [number, SemaphoreInterface.Releaser]) => void> = [];
    private _currentReleaser: SemaphoreInterface.Releaser | undefined;
}

export default Semaphore;
