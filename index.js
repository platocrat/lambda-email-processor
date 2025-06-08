// index.js
const dataProcessingService = require('./services/dataProcessing.js')
const { getConsoleMetadata } = require('./utils.js')

const LOG_TYPE = 'API_CALL'
const FILE_PATH = 'index.js'

exports.handler = async event => {
  const failures = []

  for (const record of event.Records) {
    try {
      // let consoleMetadata = getConsoleMetadata( 
      //   LOG_TYPE,
      //   true,
      //   FILE_PATH,
      //   'lambda.handler()'
      // )
      // console.log(`${ consoleMetadata } record.body: `, record.body)

      const extractedInboundEmail = JSON.parse(record.body)
      // consoleMetadata = getConsoleMetadata(
      //   LOG_TYPE,
      //   true,
      //   FILE_PATH,
      //   'lambda.handler()'
      // )
      // console.log(`${ consoleMetadata } Extracted email data: `, extractedInboundEmail)

      await dataProcessingService.processInboundEmailData(extractedInboundEmail)
    } catch (error) {
      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        false,
        FILE_PATH,
        'lambda.handler()'
      )
      console.error(
        `${ consoleMetadata } Email processing failed for messageId ${record.messageId}: `, 
        error
      )

      failures.push({ itemIdentifier: record.messageId })
    }
  }

  // SQS deletes records that aren't listed as failures
  const body = { batchItemFailures: failures }
  const response = {
    statusCode: 200,
    body
  }

  return response
}