// ./services/dataProcessing.js
// Externals
const {
  QueryCommand,
  UpdateCommand,
  QueryCommandInput,
  UpdateCommandInput,
} = require('@aws-sdk/lib-dynamodb')
// Locals
// import type { 
//     ATTACHMENT__POSTMARK,
//     ProcessedInboundEmail,
//     AttachmentMetadata,
//     STORED_OPENAI_URLS__R2,
//     DATA_ANALYSIS_RESULT__OPENAI,
//     ExtractedInboundEmailData,
//     EmailAttachment,
// } from '@/types'
const ddbDocClient = require('../lib/dynamodb.js')
const { getConsoleMetadata } = require('../utils.js')
const { openaiService } = require('./openai.js')
const { dynamoService } = require('./dynamo.js')
const { r2Service } = require('./r2.js')


const LOG_TYPE = 'API_CALL'
const FILE_NAME = 'src/services/data/processing-service/index.ts'

/**
* @dev Data processing service for handling email data
* @notice This service processes incoming email data from Postmark Inbound 
*  webhooks, including:
* - Storing attachments in Cloudflare R2
* - Analyzing content using OpenAI
* - Generating visualizations
* - Storing processed data in DynamoDB
* @example
* ```ts
* const processedInboundEmail: PROCESSED_INBOUND_EMAIL__DYNAMODB = 
*   await dataProcessingService.processInboundEmailData(extractedEmailData)
* ```
*/
class DataProcessingService {
  /**
   * Process data from an email
   * @param extractedEmailData - The extracted inbound email data
   * @returns The processed inbound email data
   */
  async processInboundEmailData (
    extractedEmailData/*: ExtractedInboundEmailData */
  )/*: Promise<ProcessedInboundEmail> */ {
    // Initialize processed data
    const processedInboundEmail/*: ProcessedInboundEmail */ = {
      id: extractedEmailData.projectId,
      sourceEmailId: extractedEmailData.id,
      processedAt: Date.now(),
      fromEmail: extractedEmailData.fromEmail,
      fromName: extractedEmailData.fromName,
      subject: extractedEmailData.subject,
      textContent: extractedEmailData.textBody,
      receivedAt: extractedEmailData.receivedAt,
      summaryFileUrl: '',
      visualizationUrls: [],
      attachmentUrls: [],
      attachments: []
    }

    try {
      // --- A. Prepare attachments for OpenAI (keep original content) ---
      const attachmentsForOpenAI/*: EmailAttachment[] */ = extractedEmailData.attachments.map(
        (attachment) => ({
          name: attachment.name,
          type: attachment.type,
          content: attachment.content,  // base64 as received
          size: attachment.size
        })
      )

      // --- B. Analyze with OpenAI ---
      const analysisResult = await DataProcessingService.OpenAI.analyzeEmail(
        extractedEmailData.textBody,
        attachmentsForOpenAI
      )

      // --- C. Store original attachments in R2 ---
      let processedAttachments/*: AttachmentMetadata[] */ = []

      if (attachmentsForOpenAI.length > 0) {
        processedAttachments = await DataProcessingService.R2.processAttachments(
          extractedEmailData.projectId,
          extractedEmailData.id,
          attachmentsForOpenAI
        )
      }

      processedInboundEmail.attachments = processedAttachments
      processedInboundEmail.attachmentUrls = processedAttachments.map(a => a.url)

      // --- D. Store OpenAI outputs (summary & charts) in R2 ---
      const {
        summaryFileUrl,
        visualizationUrls
      } = await DataProcessingService.R2.storeOpenAIOutputs(
        extractedEmailData.projectId,
        extractedEmailData.id,
        analysisResult
      )

      processedInboundEmail.summaryFileUrl = summaryFileUrl
      processedInboundEmail.visualizationUrls = visualizationUrls

      // --- E. Save processedInboundEmail to DynamoDB ---
      await dynamoService.addEmailToProject(
        extractedEmailData.projectId,
        processedInboundEmail
      )
      await dynamoService.updateProjectStatus(
        extractedEmailData.projectId,
        'Active',
        1
      )

      return processedInboundEmail
    } catch (error) {
      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        false,
        FILE_NAME,
        'processInboundEmailData()'
      )
      console.error(`${ consoleMetadata } Error processing email data: `, error)
      throw error
    }
  }

  /**
   * @dev Generate a unique ID
   * @returns The unique ID
   */
  generateId () {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    )
  }

  // --- Static Subclasses ---
  static R2 = class {
    /**
     * @dev Process attachments
     * @param projectId - The project ID
     * @param emailId - The email ID
     * @param attachments - The attachments
     * @returns The processed attachments
     */
    static async processAttachments (
      projectId/*: string */,
      emailId/*: string */,
      attachments/*: EmailAttachment[] */,
    )/*: Promise<AttachmentMetadata[]> */ {
      const processedAttachments/*: AttachmentMetadata[] */ = []

      for (const attachment of attachments) {
        try {
          const fileContent = Buffer.from(
            attachment.content.replace(/^data:.*?;base64,/, ''),
            'base64'
          )
          const key = `${ projectId }/${ emailId }/${ attachment.name }`

          const url = await r2Service.storeFile(
            key,
            fileContent.toString('base64'),
            attachment.type
          )

          processedAttachments.push({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            url
          })
        } catch (error) {
          const consoleMetadata = getConsoleMetadata(
            LOG_TYPE,
            false,
            FILE_NAME,
            'processAttachments()'
          )
          console.error(`${ consoleMetadata } Error storing attachment: `, error)
        }
      }

      return processedAttachments
    }

    /**
     * @dev Convert base64 to file
     * @param base64 - The base64 string
     * @param contentType - The content type
     * @returns The file
     */
    static base64ToFile (
      base64/*: string*/,
      contentType/*: string*/
    )/*: Buffer */ {
      const base64Data = base64.replace(/^data:.*?;base64,/, '')
      return Buffer.from(base64Data, 'base64')
    }

    /**
     * @dev Store OpenAI outputs
     * @param projectId - The project ID
     * @param emailId - The email ID
     * @param analysisResult - The analysis result
     * @returns The summary file URL and visualization URLs
     */
    static async storeOpenAIOutputs (
      projectId/*: string */,
      emailId/*: string */,
      analysisResult/*: { textContent: string; imageFiles: string[] } */
    )/*: Promise<STORED_OPENAI_URLS__R2> */ {
      const key = `${ projectId }/${ emailId }/summary.txt`
      const textContent = analysisResult.textContent
      const contentType = 'text/plain'
      const summaryFileUrl = await r2Service.storeFile(
        key,
        textContent,
        contentType,
      )

      // Store visualizations in R2 for each image in the analysis result's 
      // `imageFiles` array
      const visualizationUrls = await Promise.all(
        analysisResult.imageFiles.map(
          async (
            image/*: string */,
            index/*: number */
          )/*: Promise<string> */ => {
            return await r2Service.storeFile(
              `${ projectId }/${ emailId }/visualization_${ index }.png`,
              image,
              'image/png'
            )
          }
        )
      )

      const storedOpenAiUrls = { summaryFileUrl, visualizationUrls }
      return storedOpenAiUrls
    }
  }

  static OpenAI = class {
    /**
     * @dev Analyze email data
     * @param textBody - The text body of the email
     * @param attachments - The attachments of the email
     * @returns The analysis result
     */
    static async analyzeEmail (
      textBody, /* string */
      // NOTE: now accepts original attachments, not processed metadata!
      attachments /* { name: string, type: string, content: string }[] */
    ) /*: Promise<DATA_ANALYSIS_RESULT__OPENAI>  */ {
      // Just pass as-is
      return await openaiService.analyzeData(textBody, attachments)
    }
  }
}


const dataProcessingService = new DataProcessingService()

module.exports = dataProcessingService