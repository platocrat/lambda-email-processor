
// ./lib/dynamodb.js
// Externals
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({})          // region & creds are auto‑detected
)

module.exports = ddbDocClient