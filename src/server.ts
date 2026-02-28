/**
 * @fileoverview Optional development server for previewing generated documentation.
 */
import express from 'express';
import path from 'path';
import type { Server } from 'http';

/**
 * Starts a local express server serving the `example/public` directory.
 *
 * @param port - The network port to listen on.
 * @returns The active Node HTTP Server instance.
 */
export function startServer(port: number): Server {
    const app = express();
    const PUBLIC_DIR = path.join(__dirname, '..', '..', 'example', 'public');

    app.use(express.static(PUBLIC_DIR));

    return app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
        console.log(`To view the API docs, go to http://localhost:${port}/api/petstore/python/`);
    });
}
