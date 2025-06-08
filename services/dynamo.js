/**
 * @dev DynamoDB Service – centralised helper for all DynamoDB access
 * @notice Wraps the AWS SDK v3 DocClient commands
 * @notice Gives you strongly-typed helpers for the project + processed-data tables
 * @notice Exposes low-level CRUD helpers you can reuse elsewhere
*/
// Externals
const {
  DeleteCommand,
  DeleteCommandInput,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} = require('@aws-sdk/lib-dynamodb')
// Locals
const {
  ddbDocClient
} = require('../lib/dynamodb.js')
const { DYNAMODB_TABLE_NAMES } = require('../lib/constants.js')
const { getConsoleMetadata } = require('../utils.js')


const FILE_PATH = 'src/services/data/dynamodb/index.ts'
const LOG_TYPE = 'SERVER'



class DynamoService {
  /* -------- CRUD "raw" helpers -------- */

  /**
   * @dev Put an item into DynamoDB
   * @param table - The table name
   * @param item - The item to put
   */
  async putItem/*<T extends DynamoItem> */(
    table/*: string */,
    item/*: T */
  )/*: Promise<void> */ {
    const input/*: PutCommandInput */ = { TableName: table, Item: item }
    const command = new PutCommand(input)

    try {
      await ddbDocClient.send(command)
    } catch (error) {
      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        false,
        FILE_PATH,
        'DynamoService.putItem()'
      )
      const errorMessage = `Failed to PUT item in table '${ table }': `
      console.error(`${ consoleMetadata } ${ errorMessage }`, error)
      throw new Error(error /* as string */)
    }
  }

  /**
   * @dev Get an item from DynamoDB
   * @param table - The table name
   * @param key - The key of the item
   * @returns The item
   */
  async getItem/*<T extends DynamoItem> */(
    table/*: string */,
    key/*: Record<string, any> */
  )/*: Promise<T | undefined> */ {
    const input/*: GetCommandInput */ = { TableName: table, Key: key }
    const command = new GetCommand(input)

    try {
      const { Item } = await ddbDocClient.send(command)
      return Item /* as T | undefined */
    } catch (error) {
      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        false,
        FILE_PATH,
        'DynamoService.getItem()'
      )
      const errorMessage = `Failed to GET item from table '${ table }': `
      console.error(`${ consoleMetadata } ${ errorMessage }`, error)
      throw new Error(error /* as string */)
    }
  }

  /**
   * @dev Query items from DynamoDB
   * @param table - The table name
   * @param keyCondExpr - The key condition expression
   * @param exprAttrVals - The expression attribute values
   * @param indexName - The index name
   * @param limit - The limit of items to return
   * @param scanForward - Whether to scan forward
   * @returns The items
   */
  async queryItems/*<T extends DynamoItem> */(
    table/*: string */,
    indexName/*: string */,
    keyCondExpr/*: string */,
    exprAttrVals/*: Record<string, any> */,
    limit/*: number */,
    scanForward/*: boolean */ = true
  )/*: Promise<T[]> */ {
    const input/*: QueryCommandInput */ = {
      TableName: table,
      IndexName: indexName,
      KeyConditionExpression: keyCondExpr,
      ExpressionAttributeValues: exprAttrVals,
      ScanIndexForward: scanForward,
      ...(limit && { Limit: limit }),
    }
    const command = new QueryCommand(input)

    try {
      const { Items } = await ddbDocClient.send(command)
      return Items || [] /* as T[] */
    } catch (error) {
      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        false,
        FILE_PATH,
        'DynamoService.queryItems()'
      )
      const errorMessage = `Failed to QUERY items from table '${ table }': `
      console.error(`${ consoleMetadata } ${ errorMessage }`, error)
      throw new Error(error /* as string */)
    }
  }

  /**
   * @dev Scan items from DynamoDB
   * @param table - The table name
   * @param filterExpr - The filter expression
   * @param exprAttrVals - The expression attribute values
   * @param limit - The limit of items to return
   * @returns The items
   */
  async scanItems/*<T extends DynamoItem> */(
    table/*: string */,
    filterExpr/*: string */,
    exprAttrVals/*: Record<string, any> */,
    limit/*?: number */,
  )/*: Promise<T[]> */ {
    const input/*: ScanCommandInput */ = {
      TableName: table,
      ...(filterExpr && { FilterExpression: filterExpr }),
      ...(exprAttrVals && { ExpressionAttributeValues: exprAttrVals }),
      ...(limit && { Limit: limit }),
    }
    const command = new ScanCommand(input)

    try {
      const { Items } = await ddbDocClient.send(command)
      return Items || [] /* as T[] */
    } catch (error) {
      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        false,
        FILE_PATH,
        'DynamoService.scanItems()'
      )
      const errorMessage = `Failed to SCAN items from table '${ table }': `
      console.error(`${ consoleMetadata } ${ errorMessage }`, error)
      throw new Error(error /* as string */)
    }
  }

  /**
   * @dev Update an item in DynamoDB
   * @param table - The table name
   * @param key - The key of the item
   * @param updateExpr - The update expression
   * @param exprAttrVals - The expression attribute values
   * @returns The item
   */
  async updateItem (
    table/*: string */,
    key/*: Record<string, any> */,
    updateExpr/*: string */,
    exprAttrVals/*: Record<string, any> */,
  )/*: Promise<void> */ {
    const input/*: UpdateCommandInput */ = {
      TableName: table,
      Key: key,
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: exprAttrVals,
    }
    const command = new UpdateCommand(input)

    try {
      await ddbDocClient.send(command)
    } catch (error) {
      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        false,
        FILE_PATH,
        'DynamoService.updateItem()'
      )
      const errorMessage = `Failed to UPDATE item in table '${ table }': `
      console.error(`${ consoleMetadata } ${ errorMessage }`, error)
      throw new Error(error /* as string */)
    }
  }

  /**
   * @dev Delete an item from DynamoDB
   * @param table - The table name
   * @param key - The key of the item
   * @returns The item
   */
  async deleteItem (
    table/*: string */,
    key/*: Record<string, any> */,
  )/*: Promise<void> */ {
    const input/*: DeleteCommandInput */ = { TableName: table, Key: key }
    const command = new DeleteCommand(input)

    try {
      await ddbDocClient.send(command)
    } catch (error) {
      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        false,
        FILE_PATH,
        'DynamoService.deleteItem()'
      )
      const errorMessage = `Failed to DELETE item from table '${ table }': `
      console.error(`${ consoleMetadata } ${ errorMessage }`, error)
      throw new Error(error /* as string */)
    }
  }

  /* -------- Project-specific helpers -------- */

  /**
   * @dev Get a project from DynamoDB
   * @param projectId - The ID of the project
   * @returns The project
   */
  async getProject (projectId/*: string */) {
    const TableName = DYNAMODB_TABLE_NAMES.projects
    const Key = { id: projectId }
    return this.getItem < PROJECT__DYNAMODB > (TableName, Key) /* as Project__DynamoDB */
  }

  /**
   * @dev Update the status of a project in DynamoDB
   * @param projectId - The ID of the project
   * @param status - The new status
   * @param emailsInc - The number of emails to increment
   */
  async updateProjectStatus (
    projectId/*: string */,
    status/*: 'Active' | 'Inactive' */,
    emailsInc/*: number */ = 1,
  )/*: Promise<void> */ {
    const TableName = DYNAMODB_TABLE_NAMES.projects
    const Key = { id: projectId }

    const emailCount = emailsInc + 1
    const lastActivity = Date.now()

    const updateExpr = 'SET status = :status, emailCount = :emailCount, lastActivity = :lastActivity'
    const exprAttrVals = {
      ':status': status,
      ':emailCount': emailCount,
      ':lastActivity': lastActivity,
    }

    await this.updateItem(TableName, Key, updateExpr, exprAttrVals)
  }

  /* -------- Processed-data helpers -------- */

  /**
   * @dev Add a processed inbound email to a project's `emails` array in DynamoDB
   * @param projectId - The ID of the project
   * @param email - The processed inbound email
   */
  async addEmailToProject (
    projectId/*: string */,
    email/*: ProcessedInboundEmail */
  )/*: Promise<void> */ {
    const TableName = DYNAMODB_TABLE_NAMES.projects
    const Key = { id: projectId }
    // Fetch the project
    const project = await this.getProject(projectId)

    if (!project) throw new Error('Project not found!')

    const emails = project.emails ?? []
    emails.unshift(email) // Add to front for latest first

    const updateExpr = 'SET emails = :emails, emailCount = :emailCount, lastActivity = :lastActivity'
    const exprAttrVals = {
      ':emails': emails,
      ':emailCount': emails.length,
      ':lastActivity': Date.now(),
    }

    await this.updateItem(TableName, Key, updateExpr, exprAttrVals)
  }
}


const dynamoService = new DynamoService()

module.exports = {
  dynamoService
}