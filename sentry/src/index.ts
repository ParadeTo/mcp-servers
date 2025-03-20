import {SentryServer} from './server.js'

const server = new SentryServer()

process.argv.forEach((val, index) => {
  if (val === '--stdio') {
    const sentryBaseUrl = process.argv[index + 1]
    const sentryApiKey = process.argv[index + 2]
    server.runStdio(sentryBaseUrl, sentryApiKey)
  } else if (val === '--sse') {
    const port = parseInt(process.argv[index + 1])
    server.runSse(port)
  }
})
