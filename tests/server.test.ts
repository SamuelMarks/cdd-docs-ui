import { startServer } from '../src/server';
import http from 'http';

describe('server', () => {
    it('starts the server and listens on the given port', done => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        const server = startServer(8001);

        server.on('listening', () => {
            expect(server).toBeInstanceOf(http.Server);
            expect(logSpy).toHaveBeenCalledWith('Server running at http://localhost:8001/');
            expect(logSpy).toHaveBeenCalledWith(
                'To view the API docs, go to http://localhost:8001/api/petstore/python/',
            );

            server.close(() => {
                logSpy.mockRestore();
                done();
            });
        });
    });
});
