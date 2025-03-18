import {SentryServer} from './server.js'

const server = new SentryServer()

server.runSse(3000)
